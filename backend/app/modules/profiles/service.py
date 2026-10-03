import unicodedata
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.modules.plots.models import Plot, PlotSlot, Row
from app.modules.profiles.models import (
    Customer,
    CustomerDeceasedRelation,
    DeathCertificate,
    DeceasedProfile,
)
from app.modules.profiles.schemas import (
    BurialSlotBrief,
    CustomerCreate,
    CustomerRelationBrief,
    CustomerResponse,
    CustomerUpdate,
    DeathCertificateCreate,
    DeathCertificateResponse,
    DeathCertificateVerifyRequest,
    DeceasedProfileCreate,
    DeceasedProfileResponse,
    DeceasedProfileUpdate,
    DeceasedPublicLookupResponse,
    DeceasedRelationBrief,
    RelationCreate,
)


def _strip_accents(text: str) -> str:
    """Normalize and strip accents for Vietnamese fulltext comparison."""
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


class ProfileService:
    # ==========================================================================
    # Customer Methods
    # ==========================================================================
    @staticmethod
    def create_customer(db: Session, data: CustomerCreate) -> CustomerResponse:
        # Check duplicate citizen_id (CCCD)
        existing_citizen = db.execute(
            select(Customer).where(Customer.citizen_id == data.citizen_id.strip())
        ).scalar_one_or_none()
        if existing_citizen:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Số CCCD '{data.citizen_id}' đã tồn tại trong hệ thống (Khách hàng: {existing_citizen.full_name})",
            )

        # Generate customer_code if not supplied: KH-YYYY-XXXX
        code = data.customer_code
        if not code:
            year = datetime.now(timezone.utc).year
            count = db.execute(select(Customer)).scalars().all()
            code = f"KH-{year}-{len(count) + 1:04d}"

        # Ensure code is unique
        while db.execute(
            select(Customer).where(Customer.customer_code == code)
        ).scalar_one_or_none():
            year = datetime.now(timezone.utc).year
            import random

            code = f"KH-{year}-{random.randint(1000, 9999)}"

        customer = Customer(
            customer_code=code,
            full_name=data.full_name.strip(),
            citizen_id=data.citizen_id.strip(),
            phone_number=data.phone_number.strip(),
            email=str(data.email).strip() if data.email else None,
            address=data.address.strip(),
            date_of_birth=data.date_of_birth,
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
        return ProfileService._to_customer_response(customer)

    @staticmethod
    def update_customer(db: Session, customer_id: int, data: CustomerUpdate) -> CustomerResponse:
        customer = db.get(Customer, customer_id)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khách hàng"
            )

        if data.full_name is not None:
            customer.full_name = data.full_name.strip()
        if data.phone_number is not None:
            customer.phone_number = data.phone_number.strip()
        if data.email is not None:
            customer.email = str(data.email).strip() if data.email else None
        if data.address is not None:
            customer.address = data.address.strip()
        if data.date_of_birth is not None:
            customer.date_of_birth = data.date_of_birth

        customer.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(customer)
        return ProfileService._to_customer_response(customer)

    @staticmethod
    def get_customer(db: Session, customer_id: int) -> CustomerResponse:
        customer = (
            db.execute(
                select(Customer)
                .options(
                    joinedload(Customer.relations).joinedload(CustomerDeceasedRelation.deceased)
                )
                .where(Customer.customer_id == customer_id)
            )
            .unique()
            .scalar_one_or_none()
        )
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khách hàng"
            )
        return ProfileService._to_customer_response(customer)

    @staticmethod
    def list_customers(
        db: Session, search: str | None = None, limit: int = 100
    ) -> list[CustomerResponse]:
        query = (
            select(Customer)
            .options(joinedload(Customer.relations).joinedload(CustomerDeceasedRelation.deceased))
            .order_by(Customer.created_at.desc())
        )

        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Customer.full_name.ilike(term),
                    Customer.customer_code.ilike(term),
                    Customer.citizen_id.ilike(term),
                    Customer.phone_number.ilike(term),
                )
            )

        customers = db.execute(query.limit(limit)).unique().scalars().all()
        return [ProfileService._to_customer_response(c) for c in customers]

    # ==========================================================================
    # Deceased Profile Methods (G07 & G08)
    # ==========================================================================
    @staticmethod
    def create_deceased_profile(
        db: Session, data: DeceasedProfileCreate, user_id: int | None = None
    ) -> DeceasedProfileResponse:
        # G07 Invariants check
        if data.date_of_birth and data.date_of_death:
            if data.date_of_birth > data.date_of_death:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ngày sinh không thể sau ngày mất",
                )
        if data.birth_year and data.date_of_death:
            if data.birth_year > data.date_of_death.year:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Năm sinh không thể lớn hơn năm mất",
                )

        # Generate deceased_code: NM-YYYY-XXXX
        code = data.deceased_code
        if not code:
            year = datetime.now(timezone.utc).year
            count = db.execute(select(DeceasedProfile)).scalars().all()
            code = f"NM-{year}-{len(count) + 1:04d}"

        while db.execute(
            select(DeceasedProfile).where(DeceasedProfile.deceased_code == code)
        ).scalar_one_or_none():
            year = datetime.now(timezone.utc).year
            import random

            code = f"NM-{year}-{random.randint(1000, 9999)}"

        # G07: Determine birth_year and precision
        b_year = data.birth_year
        if not b_year and data.date_of_birth:
            b_year = data.date_of_birth.year

        has_cert = False
        if data.death_certificate:
            has_cert = True

        profile = DeceasedProfile(
            deceased_code=code,
            full_name=data.full_name.strip(),
            gender=data.gender.upper(),
            date_of_birth=data.date_of_birth,
            date_of_death=data.date_of_death,
            birth_year=b_year,
            birth_date_precision=data.birth_date_precision,
            hometown=data.hometown.strip() if data.hometown else None,
            religion=data.religion.strip() if data.religion else None,
            has_death_certificate=has_cert,
        )
        db.add(profile)
        db.flush()

        # Link to Customer if provided
        if data.customer_id:
            customer = db.get(Customer, data.customer_id)
            if not customer:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Không tìm thấy khách hàng thân nhân",
                )
            rel = CustomerDeceasedRelation(
                customer_id=customer.customer_id,
                deceased_id=profile.deceased_id,
                relationship_type=data.relationship_type.strip()
                if data.relationship_type
                else "Thân nhân",
                is_primary_contact=data.is_primary_contact,
            )
            db.add(rel)

        # Create death certificate record if provided (G08: default is_verified=False)
        if data.death_certificate:
            cert = DeathCertificate(
                deceased_id=profile.deceased_id,
                certificate_number=data.death_certificate.certificate_number.strip(),
                issuing_authority=data.death_certificate.issuing_authority.strip(),
                issue_date=data.death_certificate.issue_date,
                scan_file_url=data.death_certificate.scan_file_url,
                file_id=data.death_certificate.file_id,
                notes=data.death_certificate.notes,
                is_verified=False,
                verified_at=None,
                verified_by=None,
            )
            db.add(cert)

        db.commit()
        return ProfileService.get_deceased_profile(db, profile.deceased_id)

    @staticmethod
    def update_deceased_profile(
        db: Session, deceased_id: int, data: DeceasedProfileUpdate
    ) -> DeceasedProfileResponse:
        profile = db.get(DeceasedProfile, deceased_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy hồ sơ người mất"
            )

        if data.full_name is not None:
            profile.full_name = data.full_name.strip()
        if data.gender is not None:
            profile.gender = data.gender.upper()
        if data.date_of_death is not None:
            profile.date_of_death = data.date_of_death
        if data.date_of_birth is not None:
            profile.date_of_birth = data.date_of_birth
        if data.birth_year is not None:
            profile.birth_year = data.birth_year
        if data.birth_date_precision is not None:
            profile.birth_date_precision = data.birth_date_precision
        if data.hometown is not None:
            profile.hometown = data.hometown.strip() if data.hometown else None
        if data.religion is not None:
            profile.religion = data.religion.strip() if data.religion else None

        # Re-validate dates
        if (
            profile.date_of_birth
            and profile.date_of_death
            and profile.date_of_birth > profile.date_of_death
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Ngày sinh không thể sau ngày mất"
            )
        if (
            profile.birth_year
            and profile.date_of_death
            and profile.birth_year > profile.date_of_death.year
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Năm sinh không thể lớn hơn năm mất"
            )

        profile.updated_at = datetime.now(timezone.utc)
        db.commit()
        return ProfileService.get_deceased_profile(db, profile.deceased_id)

    @staticmethod
    def get_deceased_profile(db: Session, deceased_id: int) -> DeceasedProfileResponse:
        profile = (
            db.execute(
                select(DeceasedProfile)
                .options(
                    joinedload(DeceasedProfile.death_certificate).joinedload(
                        DeathCertificate.verifier
                    ),
                    joinedload(DeceasedProfile.relations).joinedload(
                        CustomerDeceasedRelation.customer
                    ),
                )
                .where(DeceasedProfile.deceased_id == deceased_id)
            )
            .unique()
            .scalar_one_or_none()
        )

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy hồ sơ người mất"
            )

        # Query burial slot if any
        slot = (
            db.execute(
                select(PlotSlot)
                .options(joinedload(PlotSlot.plot).joinedload(Plot.row).joinedload(Row.zone))
                .where(PlotSlot.current_deceased_id == deceased_id)
            )
            .unique()
            .scalar_one_or_none()
        )

        return ProfileService._to_deceased_response(profile, slot)

    @staticmethod
    def list_deceased_profiles(
        db: Session, search: str | None = None, limit: int = 100
    ) -> list[DeceasedProfileResponse]:
        query = (
            select(DeceasedProfile)
            .options(
                joinedload(DeceasedProfile.death_certificate).joinedload(DeathCertificate.verifier),
                joinedload(DeceasedProfile.relations).joinedload(CustomerDeceasedRelation.customer),
            )
            .order_by(DeceasedProfile.created_at.desc())
        )

        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.where(
                or_(
                    DeceasedProfile.full_name.ilike(term),
                    DeceasedProfile.deceased_code.ilike(term),
                    DeceasedProfile.hometown.ilike(term),
                )
            )

        profiles = db.execute(query.limit(limit)).unique().scalars().all()

        # Batch query burial slots for these deceased
        dec_ids = [p.deceased_id for p in profiles]
        slots_map = {}
        if dec_ids:
            slots = (
                db.execute(
                    select(PlotSlot)
                    .options(joinedload(PlotSlot.plot).joinedload(Plot.row).joinedload(Row.zone))
                    .where(PlotSlot.current_deceased_id.in_(dec_ids))
                )
                .scalars()
                .all()
            )
            for s in slots:
                if s.current_deceased_id:
                    slots_map[s.current_deceased_id] = s

        return [
            ProfileService._to_deceased_response(p, slots_map.get(p.deceased_id)) for p in profiles
        ]

    # ==========================================================================
    # Death Certificate & Verification Workflow (G08)
    # ==========================================================================
    @staticmethod
    def attach_or_update_certificate(
        db: Session, deceased_id: int, data: DeathCertificateCreate
    ) -> DeathCertificateResponse:
        profile = db.get(DeceasedProfile, deceased_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy hồ sơ người mất"
            )

        cert = db.execute(
            select(DeathCertificate).where(DeathCertificate.deceased_id == deceased_id)
        ).scalar_one_or_none()

        if cert:
            cert.certificate_number = data.certificate_number.strip()
            cert.issuing_authority = data.issuing_authority.strip()
            cert.issue_date = data.issue_date
            if data.scan_file_url:
                cert.scan_file_url = data.scan_file_url
            if data.file_id:
                cert.file_id = data.file_id
            if data.notes:
                cert.notes = data.notes
            # Modification resets verification for safety
            cert.is_verified = False
            cert.verified_at = None
            cert.verified_by = None
            cert.rejection_reason = None
        else:
            cert = DeathCertificate(
                deceased_id=deceased_id,
                certificate_number=data.certificate_number.strip(),
                issuing_authority=data.issuing_authority.strip(),
                issue_date=data.issue_date,
                scan_file_url=data.scan_file_url,
                file_id=data.file_id,
                notes=data.notes,
                is_verified=False,
                verified_at=None,
                verified_by=None,
            )
            db.add(cert)

        profile.has_death_certificate = True
        db.commit()
        db.refresh(cert)
        return ProfileService._to_certificate_response(cert)

    @staticmethod
    def verify_certificate(
        db: Session, cert_id: int, data: DeathCertificateVerifyRequest, verifier_user_id: int
    ) -> DeathCertificateResponse:
        cert = (
            db.execute(
                select(DeathCertificate)
                .options(
                    joinedload(DeathCertificate.deceased), joinedload(DeathCertificate.verifier)
                )
                .where(DeathCertificate.cert_id == cert_id)
            )
            .unique()
            .scalar_one_or_none()
        )

        if not cert:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy giấy báo tử"
            )

        if data.is_verified:
            cert.is_verified = True
            cert.verified_at = datetime.now(timezone.utc)
            cert.verified_by = verifier_user_id
            cert.rejection_reason = None
            if cert.deceased:
                cert.deceased.has_death_certificate = True
        else:
            cert.is_verified = False
            cert.verified_at = None
            cert.verified_by = verifier_user_id
            cert.rejection_reason = data.rejection_reason or "Giấy tờ chưa đủ điều kiện pháp lý"
            if cert.deceased:
                cert.deceased.has_death_certificate = False

        if data.notes:
            cert.notes = data.notes

        db.commit()
        db.refresh(cert)
        return ProfileService._to_certificate_response(cert)

    @staticmethod
    def check_death_certificate_verified(db: Session, deceased_id: int) -> bool:
        """Domain invariant helper: returns True iff a verified death certificate exists."""
        cert = db.execute(
            select(DeathCertificate).where(
                DeathCertificate.deceased_id == deceased_id,
                DeathCertificate.is_verified == True,  # noqa: E712
            )
        ).scalar_one_or_none()
        return cert is not None

    # ==========================================================================
    # Public Lookup (Zero PII Leakage - G19 & ADR-001)
    # ==========================================================================
    @staticmethod
    def public_lookup_deceased(
        db: Session, query_str: str, limit: int = 20
    ) -> list[DeceasedPublicLookupResponse]:
        if not query_str or len(query_str.strip()) < 2:
            return []

        search_term = f"%{query_str.strip()}%"
        profiles = (
            db.execute(
                select(DeceasedProfile)
                .where(
                    or_(
                        DeceasedProfile.full_name.ilike(search_term),
                        DeceasedProfile.deceased_code.ilike(search_term),
                    )
                )
                .order_by(DeceasedProfile.full_name)
                .limit(limit)
            )
            .scalars()
            .all()
        )

        dec_ids = [p.deceased_id for p in profiles]
        slots_map = {}
        if dec_ids:
            slots = (
                db.execute(
                    select(PlotSlot)
                    .options(joinedload(PlotSlot.plot).joinedload(Plot.row).joinedload(Row.zone))
                    .where(PlotSlot.current_deceased_id.in_(dec_ids))
                )
                .scalars()
                .all()
            )
            for s in slots:
                if s.current_deceased_id:
                    slots_map[s.current_deceased_id] = s

        results = []
        for p in profiles:
            yob = p.birth_year or (p.date_of_birth.year if p.date_of_birth else None)
            slot = slots_map.get(p.deceased_id)

            results.append(
                DeceasedPublicLookupResponse(
                    deceased_code=p.deceased_code,
                    full_name=p.full_name,
                    year_of_birth=yob,
                    date_of_death=p.date_of_death,
                    hometown=p.hometown,
                    zone_name=slot.plot.row.zone.zone_name
                    if slot and slot.plot and slot.plot.row and slot.plot.row.zone
                    else None,
                    row_code=slot.plot.row.row_code
                    if slot and slot.plot and slot.plot.row
                    else None,
                    plot_code=slot.plot.plot_code if slot and slot.plot else None,
                    slot_number=slot.slot_number if slot else None,
                    is_kim_tinh=slot.plot.is_kim_tinh if slot and slot.plot else False,
                )
            )
        return results

    # ==========================================================================
    # Relations Management
    # ==========================================================================
    @staticmethod
    def link_relation(db: Session, data: RelationCreate) -> CustomerRelationBrief:
        customer = db.get(Customer, data.customer_id)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khách hàng"
            )
        deceased = db.get(DeceasedProfile, data.deceased_id)
        if not deceased:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người mất"
            )

        # Check existing link
        existing = db.execute(
            select(CustomerDeceasedRelation).where(
                CustomerDeceasedRelation.customer_id == data.customer_id,
                CustomerDeceasedRelation.deceased_id == data.deceased_id,
            )
        ).scalar_one_or_none()

        if existing:
            existing.relationship_type = data.relationship_type.strip()
            existing.is_primary_contact = data.is_primary_contact
            db.commit()
            db.refresh(existing)
            rel = existing
        else:
            rel = CustomerDeceasedRelation(
                customer_id=data.customer_id,
                deceased_id=data.deceased_id,
                relationship_type=data.relationship_type.strip(),
                is_primary_contact=data.is_primary_contact,
            )
            db.add(rel)
            db.commit()
            db.refresh(rel)

        return CustomerRelationBrief(
            relation_id=rel.relation_id,
            deceased_id=deceased.deceased_id,
            deceased_code=deceased.deceased_code,
            deceased_full_name=deceased.full_name,
            relationship_type=rel.relationship_type,
            is_primary_contact=rel.is_primary_contact,
        )

    @staticmethod
    def remove_relation(db: Session, relation_id: int) -> None:
        rel = db.get(CustomerDeceasedRelation, relation_id)
        if not rel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy mối quan hệ"
            )
        db.delete(rel)
        db.commit()

    # ==========================================================================
    # DTO Mappers
    # ==========================================================================
    @staticmethod
    def _to_customer_response(c: Customer) -> CustomerResponse:
        rels = []
        if c.relations:
            for r in c.relations:
                if r.deceased:
                    rels.append(
                        CustomerRelationBrief(
                            relation_id=r.relation_id,
                            deceased_id=r.deceased.deceased_id,
                            deceased_code=r.deceased.deceased_code,
                            deceased_full_name=r.deceased.full_name,
                            relationship_type=r.relationship_type,
                            is_primary_contact=r.is_primary_contact,
                        )
                    )
        return CustomerResponse(
            customer_id=c.customer_id,
            customer_code=c.customer_code,
            full_name=c.full_name,
            citizen_id=c.citizen_id,
            phone_number=c.phone_number,
            email=c.email,
            address=c.address,
            date_of_birth=c.date_of_birth,
            created_at=c.created_at,
            updated_at=c.updated_at,
            relations=rels,
        )

    @staticmethod
    def _to_deceased_response(
        p: DeceasedProfile, slot: PlotSlot | None = None
    ) -> DeceasedProfileResponse:
        cert_resp = None
        if p.death_certificate:
            cert_resp = ProfileService._to_certificate_response(p.death_certificate)

        rels = []
        if p.relations:
            for r in p.relations:
                if r.customer:
                    rels.append(
                        DeceasedRelationBrief(
                            relation_id=r.relation_id,
                            customer_id=r.customer.customer_id,
                            customer_code=r.customer.customer_code,
                            customer_full_name=r.customer.full_name,
                            citizen_id=r.customer.citizen_id,
                            phone_number=r.customer.phone_number,
                            relationship_type=r.relationship_type,
                            is_primary_contact=r.is_primary_contact,
                        )
                    )

        burial_brief = None
        if slot and slot.plot:
            burial_brief = BurialSlotBrief(
                slot_id=slot.slot_id,
                plot_id=slot.plot_id,
                slot_number=slot.slot_number,
                plot_code=slot.plot.plot_code,
                zone_code=slot.plot.row.zone.zone_code
                if slot.plot.row and slot.plot.row.zone
                else "",
                zone_name=slot.plot.row.zone.zone_name
                if slot.plot.row and slot.plot.row.zone
                else "",
                row_code=slot.plot.row.row_code if slot.plot.row else "",
                status=slot.status,
                is_kim_tinh=slot.plot.is_kim_tinh,
            )

        return DeceasedProfileResponse(
            deceased_id=p.deceased_id,
            deceased_code=p.deceased_code,
            full_name=p.full_name,
            gender=p.gender,
            date_of_birth=p.date_of_birth,
            date_of_death=p.date_of_death,
            birth_year=p.birth_year,
            birth_date_precision=p.birth_date_precision,
            hometown=p.hometown,
            religion=p.religion,
            has_death_certificate=p.has_death_certificate,
            created_at=p.created_at,
            updated_at=p.updated_at,
            death_certificate=cert_resp,
            relations=rels,
            burial_slot=burial_brief,
        )

    @staticmethod
    def _to_certificate_response(c: DeathCertificate) -> DeathCertificateResponse:
        v_name = None
        if c.verifier:
            v_name = c.verifier.full_name

        return DeathCertificateResponse(
            cert_id=c.cert_id,
            deceased_id=c.deceased_id,
            certificate_number=c.certificate_number,
            issuing_authority=c.issuing_authority,
            issue_date=c.issue_date,
            scan_file_url=c.scan_file_url,
            file_id=c.file_id,
            is_verified=c.is_verified,
            verified_at=c.verified_at,
            verified_by=c.verified_by,
            verifier_name=v_name,
            rejection_reason=c.rejection_reason,
            notes=c.notes,
        )
