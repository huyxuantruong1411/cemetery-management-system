import json
import unicodedata
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.modules.audit.models import AuditLog
from app.modules.documents.models import FileObject
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
    RelationDetailResponse,
)


def _strip_accents(text: str) -> str:
    """Normalize and strip accents for Vietnamese fulltext comparison."""
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


# =============================================================================
# MODULE QUẢN LÝ HỒ SƠ KHÁCH HÀNG & NGƯỜI MẤT (PROFILE SERVICE)
# =============================================================================
# Module này quản lý toàn bộ dữ liệu thực thể con người trong hệ thống nghĩa trang:
# 1. Hồ sơ Khách hàng (Customer Profile):
#    - Đại diện cho thân nhân, người ký hợp đồng mua đất, hợp đồng chăm sóc, dịch vụ.
#    - Định danh duy nhất bằng Số CCCD (citizen_id) và Mã khách hàng (customer_code: KH-YYYY-XXXX).
# 2. Hồ sơ Người mất (Deceased Profile):
#    - Quản lý danh tính người quá cố, thông tin sinh mất (ngày sinh, ngày mất, quê quán, tôn giáo).
#    - Invariants G07: Ngày sinh <= Ngày mất; Năm sinh <= Năm mất; độ chính xác ngày sinh (EXACT/YEAR_ONLY).
# 3. Cổng Giấy báo tử (Death Certificate Gate - G08):
#    - Ràng buộc pháp lý tối thượng: Không một ô mộ hoặc dịch vụ an táng/hỏa táng nào được kích hoạt
#      nếu người mất chưa có Giấy báo tử được nhân viên xác minh hợp lệ (is_verified=True, file_id READY).
# 4. Quan hệ Khách hàng - Người mất (CustomerDeceasedRelation):
#    - Liên kết quan hệ gia đình (vợ/chồng, con, cháu, anh em), cờ người liên hệ chính (is_primary_contact).
# 5. Tra cứu tưởng niệm công khai (Public Lookup - G19 & ADR-001):
#    - Hỗ trợ thân nhân/khách viếng tra cứu vị trí mộ (Khu, Dãy, Lô, Slot) và link chỉ đường Google Maps.
#    - Triệt tiêu hoàn toàn nguy cơ rò rỉ thông tin cá nhân (Zero PII Leakage): Không lộ CCCD, SĐT, ngày sinh cụ thể.
# =============================================================================


class ProfileService:
    # ==========================================================================
    # QUẢN LÝ HỒ SƠ KHÁCH HÀNG (CUSTOMER PROFILE MANAGEMENT)
    # ==========================================================================

    @staticmethod
    def create_customer(db: Session, data: CustomerCreate) -> CustomerResponse:
        """
        Tạo mới hồ sơ khách hàng (người mua đất, người thân ký hợp đồng).
        
        Kiểm tra nghiệp vụ:
        - Kiểm tra trùng lặp Số CCCD (citizen_id): Mỗi công dân chỉ có một hồ sơ duy nhất trên hệ thống.
        - Tự động sinh mã khách hàng chuẩn định dạng: KH-YYYY-XXXX (năm hiện tại kèm số thứ tự).
        - Đảm bảo mã sinh ra không bị xung đột trùng lặp trong CSDL.
        """
        # Kiểm tra tính hợp lệ của số CCCD/CMND
        citizen_id = data.citizen_id.strip() if data.citizen_id else ""
        if not citizen_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số CCCD/CMND không được để trống",
            )

        if not citizen_id.isdigit():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Số CCCD '{citizen_id}' không hợp lệ: chỉ được chứa các chữ số (0-9)",
            )

        if len(citizen_id) not in (9, 12):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Số CCCD '{citizen_id}' không hợp lệ: độ dài phải chính xác 9 chữ số (CMND) hoặc 12 chữ số (CCCD/Căn cước)",
            )

        if citizen_id == "0" * len(citizen_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số CCCD không hợp lệ: không thể toàn chữ số 0",
            )

        # Kiểm tra trùng lặp số CCCD
        existing_citizen = db.execute(
            select(Customer).where(Customer.citizen_id == citizen_id)
        ).scalar_one_or_none()

        if existing_citizen:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Số CCCD '{citizen_id}' đã tồn tại trong hệ thống (Khách hàng: {existing_citizen.full_name})",
            )

        # Ràng buộc công dân từ đủ 16 tuổi mới đủ điều kiện đứng ra ký hợp đồng
        if data.date_of_birth:
            today = date.today()
            age = (
                today.year
                - data.date_of_birth.year
                - ((today.month, today.day) < (data.date_of_birth.month, data.date_of_birth.day))
            )
            if age < 16:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Khách hàng chưa đủ 16 tuổi (sinh ngày {data.date_of_birth.strftime('%d/%m/%Y')}, hiện tại {age} tuổi). Theo quy định, công dân từ đủ 16 tuổi mới đủ điều kiện đăng ký hồ sơ và đứng tên ký hợp đồng.",
                )

        # Tự động sinh mã khách hàng theo mẫu: KH-YYYY-XXXX
        code = data.customer_code
        if not code:
            year = datetime.now(timezone.utc).year
            count = db.execute(select(Customer)).scalars().all()
            code = f"KH-{year}-{len(count) + 1:04d}"

        # Đảm bảo mã khách hàng không trùng lặp
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
    def update_customer(
        db: Session, customer_id: int, data: CustomerUpdate, user_id: int | None = None
    ) -> CustomerResponse:
        """
        Cập nhật thông tin khách hàng kèm ghi vết nhật ký kiểm toán (Audit Log).
        
        Bảo mật & Kiểm toán:
        - Lưu trữ toàn bộ giá trị trước sửa đổi (pre_change_values) và sau sửa đổi (post_change_values).
        - Ghi vết người thực hiện (user_id) vào bảng AuditLog để đối soát khi có khiếu nại.
        """
        customer = db.get(Customer, customer_id)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy khách hàng"
            )

        pre_values = {
            "full_name": customer.full_name,
            "phone_number": customer.phone_number,
            "email": customer.email,
            "address": customer.address,
            "date_of_birth": customer.date_of_birth.isoformat() if customer.date_of_birth else None,
        }

        if data.full_name is not None:
            customer.full_name = data.full_name.strip()
        if data.phone_number is not None:
            customer.phone_number = data.phone_number.strip()
        if data.email is not None:
            customer.email = str(data.email).strip() if data.email else None
        if data.address is not None:
            customer.address = data.address.strip()
        if data.date_of_birth is not None:
            today = date.today()
            age = (
                today.year
                - data.date_of_birth.year
                - ((today.month, today.day) < (data.date_of_birth.month, data.date_of_birth.day))
            )
            if age < 16:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Khách hàng chưa đủ 16 tuổi (sinh ngày {data.date_of_birth.strftime('%d/%m/%Y')}, hiện tại {age} tuổi). Theo quy định, công dân từ đủ 16 tuổi mới đủ điều kiện đăng ký hồ sơ và đứng tên ký hợp đồng.",
                )
            customer.date_of_birth = data.date_of_birth

        customer.updated_at = datetime.now(timezone.utc)

        post_values = {
            "full_name": customer.full_name,
            "phone_number": customer.phone_number,
            "email": customer.email,
            "address": customer.address,
            "date_of_birth": customer.date_of_birth.isoformat() if customer.date_of_birth else None,
        }

        # Ghi vết kiểm toán lịch sử thay đổi thông tin khách hàng
        audit = AuditLog(
            user_id=user_id,
            action_type="UPDATE",
            target_entity="Customer",
            target_id=str(customer.customer_id),
            pre_change_values=json.dumps(pre_values),
            post_change_values=json.dumps(post_values),
        )
        db.add(audit)

        db.commit()
        db.refresh(customer)
        return ProfileService._to_customer_response(customer)

    @staticmethod
    def get_customer(db: Session, customer_id: int) -> CustomerResponse:
        """
        Lấy thông tin chi tiết khách hàng cùng toàn bộ thân nhân quá cố liên kết.
        Sử dụng joinedload để tránh N+1 query.
        """
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
        """
        Tìm kiếm danh sách khách hàng theo tên, mã KH, số CCCD hoặc số điện thoại.
        """
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
    # QUẢN LÝ HỒ SƠ NGƯỜI MẤT (DECEASED PROFILE - G07 & G08)
    # ==========================================================================

    @staticmethod
    def create_deceased_profile(
        db: Session, data: DeceasedProfileCreate, user_id: int | None = None
    ) -> DeceasedProfileResponse:
        """
        Khởi tạo hồ sơ người quá cố.
        
        Quy tắc nghiệp vụ & Bất biến miền (Domain Invariants - G07):
        1. Tính logic thời gian: Ngày sinh không được sau ngày mất (date_of_birth <= date_of_death).
        2. Năm sinh không được lớn hơn năm mất (birth_year <= date_of_death.year).
        3. Tự động sinh mã người mất: NM-YYYY-XXXX (chống trùng lặp tuyệt đối).
        4. Độ chính xác ngày sinh (birth_date_precision): Phục vụ lưu trữ chính xác thông tin lịch sử
           (nhiều cụ già thời chiến tranh chỉ nhớ năm sinh, không rõ ngày tháng).
        5. Liên kết thân nhân (CustomerDeceasedRelation): Tự động tạo quan hệ với khách hàng nếu cung cấp.
        6. Giấy báo tử đính kèm (DeathCertificate): Nếu có gửi kèm file chứng từ, kiểm tra file phải READY.
        """
        # G07 Invariants check: Kiểm tra tính hợp lệ của ngày sinh và ngày mất
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

        # Tự động sinh mã người mất chuẩn: NM-YYYY-XXXX
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

        # G07: Xác định năm sinh và độ chính xác
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

        # Tự động liên kết với khách hàng thân nhân đại diện nếu có truyền customer_id
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

        # Khởi tạo bản ghi giấy báo tử nếu có đính kèm chứng từ
        if data.death_certificate:
            has_valid_file = False
            if data.death_certificate.file_id:
                file_obj = db.get(FileObject, data.death_certificate.file_id)
                if not file_obj or file_obj.state != "READY":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Tệp đính kèm chưa sẵn sàng hoặc không tồn tại",
                    )
                has_valid_file = True

            cert = DeathCertificate(
                deceased_id=profile.deceased_id,
                certificate_number=data.death_certificate.certificate_number.strip(),
                issuing_authority=data.death_certificate.issuing_authority.strip(),
                issue_date=data.death_certificate.issue_date,
                scan_file_url=data.death_certificate.scan_file_url,
                file_id=data.death_certificate.file_id,
                notes=data.death_certificate.notes,
                is_verified=has_valid_file,
                verified_at=datetime.now(timezone.utc) if has_valid_file else None,
                verified_by=user_id if has_valid_file else None,
            )
            db.add(cert)
            profile.has_death_certificate = has_valid_file

        db.commit()
        return ProfileService.get_deceased_profile(db, profile.deceased_id)

    @staticmethod
    def update_deceased_profile(
        db: Session, deceased_id: int, data: DeceasedProfileUpdate, user_id: int | None = None
    ) -> DeceasedProfileResponse:
        """
        Cập nhật hồ sơ người mất kèm kiểm tra Invariant và ghi vết Audit Log.
        """
        profile = db.get(DeceasedProfile, deceased_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy hồ sơ người mất"
            )

        pre_values = {
            "full_name": profile.full_name,
            "gender": profile.gender,
            "date_of_birth": profile.date_of_birth.isoformat() if profile.date_of_birth else None,
            "date_of_death": profile.date_of_death.isoformat() if profile.date_of_death else None,
            "birth_year": profile.birth_year,
            "birth_date_precision": profile.birth_date_precision,
            "hometown": profile.hometown,
            "religion": profile.religion,
        }

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

        # Tái thẩm định Invariants ngày sinh và ngày mất sau khi chỉnh sửa
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

        post_values = {
            "full_name": profile.full_name,
            "gender": profile.gender,
            "date_of_birth": profile.date_of_birth.isoformat() if profile.date_of_birth else None,
            "date_of_death": profile.date_of_death.isoformat() if profile.date_of_death else None,
            "birth_year": profile.birth_year,
            "birth_date_precision": profile.birth_date_precision,
            "hometown": profile.hometown,
            "religion": profile.religion,
        }

        # Ghi vết kiểm toán lịch sử thay đổi thông tin người mất
        audit = AuditLog(
            user_id=user_id,
            action_type="UPDATE",
            target_entity="DeceasedProfile",
            target_id=str(profile.deceased_id),
            pre_change_values=json.dumps(pre_values),
            post_change_values=json.dumps(post_values),
        )
        db.add(audit)

        profile.updated_at = datetime.now(timezone.utc)
        db.commit()
        return ProfileService.get_deceased_profile(db, profile.deceased_id)

    @staticmethod
    def get_deceased_profile(db: Session, deceased_id: int) -> DeceasedProfileResponse:
        """
        Xem chi tiết hồ sơ người mất kèm:
        - Giấy báo tử và thông tin nhân viên kiểm duyệt.
        - Danh sách thân nhân liên kết.
        - Vị trí huyệt mộ hiện đang an táng (nếu có).
        """
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

        # Truy vấn huyệt mộ đang an táng người mất này (nếu có)
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
        """
        Danh sách hồ sơ người mất có tối ưu hóa truy vấn:
        - Sử dụng eager loading cho giấy báo tử và thân nhân.
        - Batch loading truy vấn vị trí mộ (PlotSlot) một lần qua toán tử IN để loại bỏ N+1 query.
        """
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

        # Batch query nạp hàng loạt thông tin huyệt mộ an táng (chống N+1 query)
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
    # QUẢN LÝ & KIỂM DUYỆT GIẤY BÁO TỬ (DEATH CERTIFICATE - G08)
    # ==========================================================================

    @staticmethod
    def attach_or_update_certificate(
        db: Session, deceased_id: int, data: DeathCertificateCreate, user_id: int | None = None
    ) -> DeathCertificateResponse:
        """
        Đính kèm hoặc cập nhật Giấy báo tử cho hồ sơ người mất.
        
        Kiểm tra tính hợp lệ của tệp:
        - Nếu có truyền file_id, bắt buộc file phải tồn tại trong FileObject và ở trạng thái 'READY' (đã upload xong lên MinIO).
        - Trạng thái xác minh (is_verified) ban đầu phụ thuộc vào việc tệp đã sẵn sàng hay chưa.
        """
        profile = db.get(DeceasedProfile, deceased_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy hồ sơ người mất"
            )

        has_valid_file = False
        if data.file_id:
            file_obj = db.get(FileObject, data.file_id)
            if not file_obj or file_obj.state != "READY":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Tệp đính kèm chưa sẵn sàng hoặc không tồn tại",
                )
            has_valid_file = True

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

            target_file_id = data.file_id or cert.file_id
            target_file_obj = db.get(FileObject, target_file_id) if target_file_id else None
            is_ready = bool(target_file_obj and target_file_obj.state == "READY")
            cert.is_verified = is_ready
            cert.verified_at = datetime.now(timezone.utc) if is_ready else None
            cert.verified_by = user_id if is_ready else None
            cert.rejection_reason = None
            profile.has_death_certificate = is_ready
        else:
            cert = DeathCertificate(
                deceased_id=deceased_id,
                certificate_number=data.certificate_number.strip(),
                issuing_authority=data.issuing_authority.strip(),
                issue_date=data.issue_date,
                scan_file_url=data.scan_file_url,
                file_id=data.file_id,
                notes=data.notes,
                is_verified=has_valid_file,
                verified_at=datetime.now(timezone.utc) if has_valid_file else None,
                verified_by=user_id if has_valid_file else None,
            )
            db.add(cert)
            profile.has_death_certificate = has_valid_file

        db.commit()
        db.refresh(cert)
        return ProfileService._to_certificate_response(cert)

    @staticmethod
    def verify_certificate(
        db: Session, cert_id: int, data: DeathCertificateVerifyRequest, verifier_user_id: int
    ) -> DeathCertificateResponse:
        """
        [CỔNG KIỂM DUYỆT PHÁP LÝ GIẤY BÁO TỬ - G08 GATE]
        Nhân viên có thẩm quyền kiểm tra tính pháp lý và phê duyệt hoặc từ chối giấy báo tử.
        
        Quy tắc Gate:
        - Khi phê duyệt (is_verified=True):
          + Bắt buộc phải có tệp scan chứng từ (file_id).
          + Trạng thái file trên MinIO phải là 'READY'.
          + Ghi nhận người phê duyệt (verifier_user_id) và thời điểm phê duyệt (verified_at).
          + Đồng bộ cờ profile.has_death_certificate = True để mở khóa cho các luồng an táng/hỏa táng.
        - Khi từ chối (is_verified=False):
          + Bắt buộc lưu lý do từ chối (rejection_reason) để thông báo cho khách hàng bổ sung.
          + Đóng cờ profile.has_death_certificate = False để chặn các giao dịch liên quan.
        """
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
            if not cert.file_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Không thể xác minh giấy báo tử khi chưa tải lên tệp chứng từ scan.",
                )
            file_obj = db.get(FileObject, cert.file_id)
            if not file_obj or file_obj.state != "READY":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Tệp chứng từ '{cert.file_id}' chưa tải lên xong.",
                )
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
        """
        [CHỐT CHẶN PHÁP LÝ TỐI THƯỢNG - DOMAIN INVARIANT HELPER]
        Trả về True nếu và chỉ nếu:
        1. Người mất có bản ghi Giấy báo tử (DeathCertificate) với cờ is_verified == True.
        2. Bản ghi có đính kèm tệp chứng từ hợp lệ (file_id) ở trạng thái 'READY' trên MinIO.
        
        Hàm này được gọi từ:
        - ContractService.create_burial_annex(): Chặn tạo phụ lục an táng nếu chưa có giấy báo tử.
        - ContractService.create_cremation_contract(): Chặn tạo hợp đồng hỏa táng nếu chưa có giấy báo tử.
        """
        cert = db.execute(
            select(DeathCertificate).where(
                DeathCertificate.deceased_id == deceased_id,
                DeathCertificate.is_verified == True,  # noqa: E712
            )
        ).scalar_one_or_none()
        if not cert or not cert.file_id:
            return False
        file_obj = db.get(FileObject, cert.file_id)
        if not file_obj or file_obj.state != "READY":
            return False
        return True

    # ==========================================================================
    # TRA CỨU CÔNG KHAI & BẢO MẬT DỮ LIỆU CÁ NHÂN (ZERO PII - G19)
    # ==========================================================================

    @staticmethod
    def public_lookup_deceased(
        db: Session, query_str: str, limit: int = 20
    ) -> list[DeceasedPublicLookupResponse]:
        """
        Tra cứu thông tin người mất phục vụ khách viếng thăm (Cổng tra cứu công khai).
        
        Nguyên tắc bảo vệ dữ liệu cá nhân (Zero PII Leakage - G19 & ADR-001):
        - Cho phép tìm kiếm theo: Tên người mất, Mã người mất, Mã ô mộ (plot_code), Mã dãy (row_code).
        - Tuyệt đối KHÔNG trả về các thông tin nhạy cảm: Số CCCD, Số điện thoại, Địa chỉ nhà, ngày sinh chi tiết.
        - Chỉ trả về: Năm sinh (year_of_birth), Ngày mất, Quê quán, Vị trí mộ (Khu/Dãy/Lô/Slot),
          Tọa độ GPS (latitude, longitude), Chuỗi hướng dẫn đường đi (navigation_guidance) và
          Link Google Maps trực tiếp giúp khách tìm đường tới mộ.
        """
        if not query_str or len(query_str.strip()) < 2:
            return []

        search_term = f"%{query_str.strip()}%"

        # Tìm kiếm theo tên/mã người mất, hoặc theo mã ô đất/mã dãy mộ
        matching_plot_dec_ids = (
            db.execute(
                select(PlotSlot.current_deceased_id)
                .join(Plot, PlotSlot.plot_id == Plot.plot_id)
                .join(Row, Plot.row_id == Row.row_id)
                .where(
                    PlotSlot.current_deceased_id.isnot(None),
                    or_(
                        Plot.plot_code.ilike(search_term),
                        Row.row_code.ilike(search_term),
                    ),
                )
            )
            .scalars()
            .all()
        )

        query_conditions = [
            DeceasedProfile.full_name.ilike(search_term),
            DeceasedProfile.deceased_code.ilike(search_term),
        ]
        if matching_plot_dec_ids:
            query_conditions.append(DeceasedProfile.deceased_id.in_(matching_plot_dec_ids))

        profiles = (
            db.execute(
                select(DeceasedProfile)
                .where(or_(*query_conditions))
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

            zone_name = (
                slot.plot.row.zone.zone_name
                if slot and slot.plot and slot.plot.row and slot.plot.row.zone
                else None
            )
            row_code = slot.plot.row.row_code if slot and slot.plot and slot.plot.row else None
            plot_code = slot.plot.plot_code if slot and slot.plot else None
            slot_num = slot.slot_number if slot else None

            lat = (
                float(slot.plot.latitude)
                if slot and slot.plot and slot.plot.latitude is not None
                else None
            )
            lng = (
                float(slot.plot.longitude)
                if slot and slot.plot and slot.plot.longitude is not None
                else None
            )

            navigation_guidance = None
            if slot and slot.plot:
                z = zone_name or "Chưa phân khu"
                r = row_code or "-"
                navigation_guidance = f"Khu {z} - Dãy {r} - Lô {plot_code} (Slot {slot_num})"

            maps_url = (
                f"https://www.google.com/maps/search/?api=1&query={lat},{lng}"
                if lat is not None and lng is not None
                else None
            )

            # Chuẩn hóa dữ liệu trả về theo schema bảo vệ PII (Zero PII Leakage)
            results.append(
                DeceasedPublicLookupResponse(
                    deceased_code=p.deceased_code,
                    full_name=p.full_name,
                    year_of_birth=yob,
                    date_of_death=p.date_of_death,
                    hometown=p.hometown,
                    zone_name=zone_name,
                    row_code=row_code,
                    plot_id=slot.plot.plot_id if slot and slot.plot else None,
                    plot_code=plot_code,
                    slot_number=slot_num,
                    is_kim_tinh=slot.plot.is_kim_tinh if slot and slot.plot else False,
                    latitude=lat,
                    longitude=lng,
                    navigation_guidance=navigation_guidance,
                    maps_url=maps_url,
                )
            )
        return results

    # ==========================================================================
    # QUẢN LÝ QUAN HỆ KHÁCH HÀNG - NGƯỜI MẤT (RELATIONS MANAGEMENT)
    # ==========================================================================

    @staticmethod
    def link_relation(db: Session, data: RelationCreate) -> CustomerRelationBrief:
        """
        Thiết lập hoặc cập nhật quan hệ giữa khách hàng và người mất.
        - Quản lý kiểu quan hệ (Vợ chồng, Con cái, Anh em ruột, v.v.).
        - Gán cờ người liên hệ chính (is_primary_contact).
        """
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

        # Kiểm tra xem quan hệ giữa 2 đối tượng này đã tồn tại chưa
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
        """Xóa mối quan hệ giữa khách hàng và người mất."""
        rel = db.get(CustomerDeceasedRelation, relation_id)
        if not rel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy mối quan hệ"
            )
        db.delete(rel)
        db.commit()

    @staticmethod
    def list_relations(
        db: Session, search: str | None = None, limit: int = 200
    ) -> list[RelationDetailResponse]:
        """
        Truy vấn danh sách mối quan hệ khách hàng - người mất với đầy đủ thông tin:
        Họ tên khách hàng, SĐT, người mất, vị trí ô huyệt mộ đang an táng.
        """
        query = (
            select(CustomerDeceasedRelation)
            .join(Customer, CustomerDeceasedRelation.customer_id == Customer.customer_id)
            .join(
                DeceasedProfile, CustomerDeceasedRelation.deceased_id == DeceasedProfile.deceased_id
            )
            .options(
                joinedload(CustomerDeceasedRelation.customer),
                joinedload(CustomerDeceasedRelation.deceased)
                .joinedload(DeceasedProfile.current_slot)
                .joinedload(PlotSlot.plot),
            )
            .order_by(CustomerDeceasedRelation.relation_id.desc())
        )
        if search:
            s = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Customer.full_name.ilike(s),
                    Customer.customer_code.ilike(s),
                    Customer.citizen_id.ilike(s),
                    Customer.phone_number.ilike(s),
                    DeceasedProfile.full_name.ilike(s),
                    DeceasedProfile.deceased_code.ilike(s),
                    CustomerDeceasedRelation.relationship_type.ilike(s),
                )
            )
        relations = db.execute(query.limit(limit)).scalars().all()
        results: list[RelationDetailResponse] = []
        for r in relations:
            slot_info = None
            if r.deceased and r.deceased.current_slot and r.deceased.current_slot.plot:
                slot_info = f"Ô {r.deceased.current_slot.plot.plot_code} (Huyệt #{r.deceased.current_slot.slot_number})"
            results.append(
                RelationDetailResponse(
                    relation_id=r.relation_id,
                    customer_id=r.customer.customer_id,
                    customer_code=r.customer.customer_code,
                    customer_name=r.customer.full_name,
                    citizen_id=r.customer.citizen_id,
                    phone_number=r.customer.phone_number,
                    deceased_id=r.deceased.deceased_id,
                    deceased_code=r.deceased.deceased_code,
                    deceased_name=r.deceased.full_name,
                    date_of_death=r.deceased.date_of_death,
                    relationship_type=r.relationship_type,
                    is_primary_contact=r.is_primary_contact,
                    slot_info=slot_info,
                )
            )
        return results

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
