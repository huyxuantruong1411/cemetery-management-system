import json
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional

import sqlalchemy as sa
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.modules.audit.models import AuditLog
from app.modules.catalog.models import PriceItem, PriceList
from app.modules.contracts.models import (
    BurialAnnex,
    Contract,
    ContractAnnex,
    ContractTemplate,
    CremationContract,
    ExhumationContract,
    LandPurchaseContract,
    TransferContract,
)
from app.modules.contracts.schemas import (
    AnnexActivateRequest,
    BurialAnnexCreate,
    BurialAnnexDetailBrief,
    ContractActivateRequest,
    ContractAnnexResponse,
    ContractBriefResponse,
    ContractDetailResponse,
    CremationContractCreate,
    CremationDetailBrief,
    CustomerBrief,
    ExhumationContractCreate,
    ExhumationDetailBrief,
    LandPurchaseContractCreate,
    LandPurchaseDetailBrief,
    PlotBrief,
    ReceivableBrief,
    TransferContractCreate,
    TransferDetailBrief,
)
from app.modules.documents.models import FileObject
from app.modules.finance.models import Receivable
from app.modules.jobs.models import OutboxEvent
from app.modules.plots.models import BurialHistory, Plot, PlotOwnership, PlotReservation, PlotSlot
from app.modules.profiles.models import Customer, DeceasedProfile
from app.modules.profiles.service import ProfileService
from app.services.pdf_service import PDFService


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ContractService:
    @staticmethod
    def generate_contract_code(db: Session, prefix: str = "HD-MD") -> str:
        """
        Sinh mã số hợp đồng an toàn đa luồng bằng SQL Server Sequence (G09).
        Đảm bảo không bao giờ sinh trùng lặp số khi nhiều giao dịch chạy đồng thời.
        """
        try:
            val = db.execute(sa.text("SELECT NEXT VALUE FOR seq_contract_number")).scalar()
        except Exception:
            count = db.query(Contract).count() + 1001
            val = count
        year = date.today().year
        return f"{prefix}-{year}-{val:06d}"

    @staticmethod
    def generate_annex_code(db: Session, prefix: str = "PL-AT") -> str:
        """
        Sinh mã số phụ lục an toàn đa luồng bằng SQL Server Sequence (G10 seq_annex_number).
        """
        try:
            val = db.execute(sa.text("SELECT NEXT VALUE FOR seq_annex_number")).scalar()
        except Exception:
            count = db.query(ContractAnnex).count() + 1001
            val = count
        year = date.today().year
        return f"{prefix}-{year}-{val:06d}"

    # ==============================================================================
    # 1. HỢP ĐỒNG MUA BÁN ĐẤT (LAND PURCHASE)
    # ==============================================================================
    @classmethod
    def create_land_purchase_contract(
        cls,
        db: Session,
        data: LandPurchaseContractCreate,
        current_user_id: int,
    ) -> Contract:
        customer = db.query(Customer).filter(Customer.customer_id == data.customer_id).first()
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy khách hàng với ID {data.customer_id}",
            )

        plot = db.query(Plot).filter(Plot.plot_id == data.plot_id).with_for_update().first()
        if not plot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy ô mộ với ID {data.plot_id}",
            )

        if plot.status != "EMPTY_UNSOLD":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ô mộ {plot.plot_code} hiện ở trạng thái '{plot.status}', không khả dụng để mở bán.",
            )

        active_res = (
            db.query(PlotReservation)
            .filter(
                PlotReservation.plot_id == plot.plot_id,
                PlotReservation.state == "ACTIVE",
            )
            .first()
        )
        if active_res:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ô mộ {plot.plot_code} hiện đang được giữ chỗ bởi '{active_res.customer_name or 'khách hàng khác'}'.",
            )

        unit_price = data.land_unit_price
        if unit_price is None or unit_price <= 0:
            today = date.today()
            active_price_item = (
                db.query(PriceItem)
                .join(PriceList, PriceList.price_list_id == PriceItem.price_list_id)
                .filter(
                    PriceList.is_active == True,  # noqa: E712
                    PriceList.effective_from_date <= today,
                    PriceList.effective_to_date >= today,
                    PriceItem.item_code == f"LAND_{plot.type_id}",
                )
                .first()
            )
            if not active_price_item:
                active_price_item = (
                    db.query(PriceItem)
                    .join(PriceList, PriceList.price_list_id == PriceItem.price_list_id)
                    .filter(
                        PriceList.is_active == True,  # noqa: E712
                        PriceList.effective_from_date <= today,
                        PriceList.effective_to_date >= today,
                    )
                    .first()
                )

            if active_price_item:
                unit_price = active_price_item.unit_price
            else:
                unit_price = Decimal("50000000.00")

        template_id = data.template_id
        template_version = None
        if template_id:
            tmpl = (
                db.query(ContractTemplate)
                .filter(ContractTemplate.template_id == template_id)
                .first()
            )
            if tmpl:
                template_version = tmpl.version_no

        contract_code = cls.generate_contract_code(db, "HD-MD")
        now = _utc_now_naive()

        contract = Contract(
            contract_code=contract_code,
            contract_type="LAND_PURCHASE",
            customer_id=customer.customer_id,
            status="DRAFT",
            total_amount=unit_price,
            template_id=template_id,
            template_version=template_version,
            notes=data.notes,
            created_by_user_id=current_user_id,
            created_at=now,
            updated_at=now,
        )
        db.add(contract)
        db.flush()

        land_sub = LandPurchaseContract(
            contract_id=contract.contract_id,
            plot_id=plot.plot_id,
            land_unit_price=unit_price,
        )
        db.add(land_sub)

        reservation = PlotReservation(
            plot_id=plot.plot_id,
            reserved_by=current_user_id,
            customer_name=customer.full_name,
            customer_phone=customer.phone_number,
            state="ACTIVE",
            reserved_at=now,
            expires_at=now + timedelta(days=7),
            contract_id=contract.contract_id,
            notes=f"Giữ chỗ theo hợp đồng mua đất {contract.contract_code}",
        )
        db.add(reservation)
        plot.status = "RESERVED"

        audit = AuditLog(
            user_id=current_user_id,
            action_type="CREATE",
            target_entity="Contract",
            target_id=str(contract.contract_id),
            post_change_values=json.dumps(
                {
                    "contract_code": contract.contract_code,
                    "customer_id": contract.customer_id,
                    "plot_id": plot.plot_id,
                    "total_amount": str(unit_price),
                },
                ensure_ascii=False,
            ),
        )
        db.add(audit)
        db.commit()
        db.refresh(contract)
        return contract

    # ==============================================================================
    # 2. HỢP ĐỒNG CẢI TÁNG / CẤT BỐC (EXHUMATION - G20)
    # ==============================================================================
    @classmethod
    def create_exhumation_contract(
        cls,
        db: Session,
        data: ExhumationContractCreate,
        current_user_id: int,
    ) -> Contract:
        customer = db.query(Customer).filter(Customer.customer_id == data.customer_id).first()
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy khách hàng với ID {data.customer_id}",
            )

        plot = db.query(Plot).filter(Plot.plot_id == data.plot_id).with_for_update().first()
        if not plot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy ô mộ với ID {data.plot_id}",
            )

        # Invariant 1: Kim Tĩnh Immutability
        if plot.is_kim_tinh or plot.is_locked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Quy tắc Kim Tĩnh Bất Biến [BR-KIMTINH]: Ô mộ xây kết cấu Kim Tĩnh đã kiên cố vĩnh viễn, nghiêm cấm lập thủ tục bóc mộ/cải táng!",
            )

        # Invariant 2: Ownership verification
        if plot.owner_id != data.customer_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Khách hàng '{customer.full_name}' không phải là chủ sở hữu hiện tại của ô mộ {plot.plot_code}.",
            )

        # Invariant 3: Slot verification
        slot = (
            db.query(PlotSlot)
            .filter(PlotSlot.slot_id == data.slot_id, PlotSlot.plot_id == plot.plot_id)
            .first()
        )
        if not slot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy slot huyệt #{data.slot_id} thuộc ô mộ {plot.plot_code}.",
            )
        if slot.status != "OCCUPIED" or slot.current_deceased_id != data.current_deceased_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Slot huyệt không chứa đúng người quá cố được yêu cầu cải táng!",
            )

        contract_code = cls.generate_contract_code(db, "HD-CT")
        now = _utc_now_naive()
        fee = data.exhumation_fee or Decimal("0.00")

        contract = Contract(
            contract_code=contract_code,
            contract_type="EXHUMATION",
            customer_id=customer.customer_id,
            status="DRAFT",
            total_amount=fee,
            template_id=data.template_id,
            notes=data.notes,
            created_by_user_id=current_user_id,
            created_at=now,
            updated_at=now,
        )
        db.add(contract)
        db.flush()

        ex_sub = ExhumationContract(
            contract_id=contract.contract_id,
            plot_id=plot.plot_id,
            slot_id=slot.slot_id,
            current_deceased_id=data.current_deceased_id,
            exhumation_date=data.exhumation_date,
            exhumation_fee=fee,
            reason=data.reason,
        )
        db.add(ex_sub)

        audit = AuditLog(
            user_id=current_user_id,
            action_type="CREATE",
            target_entity="Contract",
            target_id=str(contract.contract_id),
            post_change_values=json.dumps(
                {
                    "contract_code": contract.contract_code,
                    "contract_type": "EXHUMATION",
                    "plot_id": plot.plot_id,
                    "slot_id": slot.slot_id,
                    "deceased_id": data.current_deceased_id,
                },
                ensure_ascii=False,
            ),
        )
        db.add(audit)
        db.commit()
        db.refresh(contract)
        return contract

    # ==============================================================================
    # 3. HỢP ĐỒNG CHUYỂN NHƯỢNG Ô MỘ (TRANSFER - G18)
    # ==============================================================================
    @classmethod
    def create_transfer_contract(
        cls,
        db: Session,
        data: TransferContractCreate,
        current_user_id: int,
    ) -> Contract:
        if data.seller_id == data.buyer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bên chuyển nhượng và bên nhận chuyển nhượng không được trùng nhau.",
            )

        seller = db.query(Customer).filter(Customer.customer_id == data.seller_id).first()
        buyer = db.query(Customer).filter(Customer.customer_id == data.buyer_id).first()
        if not seller or not buyer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy thông tin khách hàng bên bán hoặc bên mua.",
            )

        plot = db.query(Plot).filter(Plot.plot_id == data.plot_id).with_for_update().first()
        if not plot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy ô mộ."
            )

        # Invariant 1: Kim Tĩnh Immutability
        if plot.is_kim_tinh or plot.is_locked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Quy tắc Kim Tĩnh Bất Biến: Không thể chuyển nhượng ô mộ Kim Tĩnh đã bị khóa vĩnh viễn.",
            )

        # Invariant 2: Seller must be current owner
        if plot.owner_id != data.seller_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Khách hàng '{seller.full_name}' không phải là chủ sở hữu hiện tại của ô mộ {plot.plot_code}.",
            )

        # Invariant 3: Plot must be empty of deceased (no occupied slots)
        occupied_slot = (
            db.query(PlotSlot)
            .filter(PlotSlot.plot_id == plot.plot_id, PlotSlot.status == "OCCUPIED")
            .first()
        )
        if occupied_slot or plot.status == "OCCUPIED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể chuyển nhượng ô mộ {plot.plot_code} đang có người an táng. Toàn bộ slot huyệt phải để trống!",
            )

        contract_code = cls.generate_contract_code(db, "HD-CN")
        now = _utc_now_naive()
        commission = data.commission_fee or Decimal("0.00")

        contract = Contract(
            contract_code=contract_code,
            contract_type="TRANSFER",
            customer_id=seller.customer_id,
            status="DRAFT",
            total_amount=commission,
            template_id=data.template_id,
            notes=data.notes,
            created_by_user_id=current_user_id,
            created_at=now,
            updated_at=now,
        )
        db.add(contract)
        db.flush()

        trans_sub = TransferContract(
            contract_id=contract.contract_id,
            plot_id=plot.plot_id,
            seller_id=seller.customer_id,
            buyer_id=buyer.customer_id,
            commission_fee=commission,
            transfer_reason=data.transfer_reason,
        )
        db.add(trans_sub)

        audit = AuditLog(
            user_id=current_user_id,
            action_type="CREATE",
            target_entity="Contract",
            target_id=str(contract.contract_id),
            post_change_values=json.dumps(
                {
                    "contract_code": contract.contract_code,
                    "contract_type": "TRANSFER",
                    "plot_id": plot.plot_id,
                    "seller_id": seller.customer_id,
                    "buyer_id": buyer.customer_id,
                },
                ensure_ascii=False,
            ),
        )
        db.add(audit)
        db.commit()
        db.refresh(contract)
        return contract

    # ==============================================================================
    # 4. HỢP ĐỒNG HỎA TÁNG (CREMATION - G20)
    # ==============================================================================
    @classmethod
    def create_cremation_contract(
        cls,
        db: Session,
        data: CremationContractCreate,
        current_user_id: int,
    ) -> Contract:
        customer = db.query(Customer).filter(Customer.customer_id == data.customer_id).first()
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy khách hàng với ID {data.customer_id}",
            )

        deceased = (
            db.query(DeceasedProfile)
            .filter(DeceasedProfile.deceased_id == data.deceased_id)
            .first()
        )
        if not deceased:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy hồ sơ người mất với ID {data.deceased_id}",
            )

        # Invariant: Death certificate must be verified (G08)
        if not ProfileService.check_death_certificate_verified(db, data.deceased_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Người quá cố '{deceased.full_name}' chưa có giấy báo tử được xác minh hợp lệ. Không thể lập hợp đồng hỏa táng!",
            )

        contract_code = cls.generate_contract_code(db, "HD-HT")
        now = _utc_now_naive()
        fee = data.service_fee or Decimal("0.00")

        contract = Contract(
            contract_code=contract_code,
            contract_type="CREMATION",
            customer_id=customer.customer_id,
            status="DRAFT",
            total_amount=fee,
            template_id=data.template_id,
            notes=data.notes,
            created_by_user_id=current_user_id,
            created_at=now,
            updated_at=now,
        )
        db.add(contract)
        db.flush()

        cre_sub = CremationContract(
            contract_id=contract.contract_id,
            deceased_id=deceased.deceased_id,
            cremation_date=data.cremation_date,
            package_service_code=data.package_service_code,
            urn_storage_option=data.urn_storage_option,
            service_fee=fee,
        )
        db.add(cre_sub)

        audit = AuditLog(
            user_id=current_user_id,
            action_type="CREATE",
            target_entity="Contract",
            target_id=str(contract.contract_id),
            post_change_values=json.dumps(
                {
                    "contract_code": contract.contract_code,
                    "contract_type": "CREMATION",
                    "deceased_id": deceased.deceased_id,
                    "service_fee": str(fee),
                },
                ensure_ascii=False,
            ),
        )
        db.add(audit)
        db.commit()
        db.refresh(contract)
        return contract

    # ==============================================================================
    # 5. PHỤ LỤC AN TÁNG (BURIAL ANNEX - G10)
    # ==============================================================================
    @classmethod
    def create_burial_annex(
        cls,
        db: Session,
        contract_id: int,
        data: BurialAnnexCreate,
        current_user_id: int,
    ) -> ContractAnnex:
        contract = cls.get_contract(db, contract_id)
        if contract.contract_type != "LAND_PURCHASE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phụ lục an táng chỉ có thể gắn vào hợp đồng mua bán đất (LAND_PURCHASE).",
            )
        if contract.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Hợp đồng gốc {contract.contract_code} chưa ở trạng thái ACTIVE (hiện tại: {contract.status}).",
            )

        # Invariant 1: Death Certificate must be verified (G08)
        deceased = (
            db.query(DeceasedProfile)
            .filter(DeceasedProfile.deceased_id == data.deceased_id)
            .first()
        )
        if not deceased:
            raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ người mất")

        if not ProfileService.check_death_certificate_verified(db, data.deceased_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Người quá cố '{deceased.full_name}' chưa có giấy báo tử được xác minh hợp lệ. Không thể lập phụ lục an táng!",
            )

        # Invariant 2: Deceased cannot be buried concurrently in another slot
        already_buried = (
            db.query(PlotSlot)
            .filter(
                PlotSlot.current_deceased_id == data.deceased_id,
                PlotSlot.status == "OCCUPIED",
            )
            .first()
        )
        if already_buried:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Người quá cố '{deceased.full_name}' hiện đang được an táng tại slot #{already_buried.slot_number} (ID {already_buried.slot_id}). Không thể an táng đồng thời tại 2 vị trí!",
            )

        # Invariant 3: Slot must belong to the contract plot
        land_sub = contract.land_purchase
        if not land_sub:
            raise HTTPException(status_code=400, detail="Hợp đồng đất không có dữ liệu ô mộ")

        plot = db.query(Plot).filter(Plot.plot_id == land_sub.plot_id).with_for_update().first()
        if not plot:
            raise HTTPException(status_code=404, detail="Không tìm thấy ô mộ của hợp đồng")

        # Invariant 4: Plot Kim Tinh & Lock status
        if plot.is_locked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ô mộ đã bị khóa vĩnh viễn, không thể an táng thêm!",
            )
        if plot.is_kim_tinh and plot.status == "OCCUPIED":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Quy tắc Kim Tĩnh Bất Biến: Ô mộ Kim Tĩnh đã hoàn tất an táng và khóa vĩnh viễn!",
            )

        slot = (
            db.query(PlotSlot)
            .filter(PlotSlot.slot_id == data.slot_id, PlotSlot.plot_id == plot.plot_id)
            .with_for_update()
            .first()
        )
        if not slot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy slot huyệt #{data.slot_id} thuộc ô mộ {plot.plot_code}.",
            )
        if slot.status != "EMPTY":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Slot huyệt #{slot.slot_number} hiện ở trạng thái '{slot.status}', không khả dụng để an táng.",
            )

        annex_code = cls.generate_annex_code(db, "PL-AT")
        now = _utc_now_naive()
        amount = data.additional_amount or Decimal("0.00")

        annex = ContractAnnex(
            annex_code=annex_code,
            contract_id=contract.contract_id,
            annex_type="BURIAL",
            status="DRAFT",
            additional_amount=amount,
            valid_from=data.burial_date,
            notes=data.notes,
            created_at=now,
            updated_at=now,
        )
        db.add(annex)
        db.flush()

        burial_sub = BurialAnnex(
            annex_id=annex.annex_id,
            deceased_id=deceased.deceased_id,
            plot_id=plot.plot_id,
            slot_id=slot.slot_id,
            burial_date=data.burial_date,
            is_kim_tinh=data.is_kim_tinh,
            construction_notes=data.construction_notes,
        )
        db.add(burial_sub)

        audit = AuditLog(
            user_id=current_user_id,
            action_type="CREATE_ANNEX",
            target_entity="ContractAnnex",
            target_id=str(annex.annex_id),
            post_change_values=json.dumps(
                {
                    "annex_code": annex.annex_code,
                    "contract_id": contract.contract_id,
                    "plot_id": plot.plot_id,
                    "slot_id": slot.slot_id,
                    "deceased_id": deceased.deceased_id,
                    "is_kim_tinh": data.is_kim_tinh,
                },
                ensure_ascii=False,
            ),
        )
        db.add(audit)
        db.commit()
        db.refresh(annex)
        return annex

    @classmethod
    def submit_annex_for_signing(
        cls,
        db: Session,
        annex_id: int,
        notes: Optional[str],
        current_user_id: int,
    ) -> ContractAnnex:
        annex = db.query(ContractAnnex).filter(ContractAnnex.annex_id == annex_id).first()
        if not annex:
            raise HTTPException(status_code=404, detail="Không tìm thấy phụ lục")

        if annex.status != "DRAFT":
            raise HTTPException(
                status_code=400,
                detail=f"Chỉ có thể chuyển sang PENDING_SIGN khi phụ lục ở trạng thái DRAFT (hiện tại: {annex.status}).",
            )

        annex.status = "PENDING_SIGN"
        if notes:
            annex.notes = f"{annex.notes or ''}\n[Gửi ký]: {notes}".strip()
        annex.updated_at = _utc_now_naive()

        db.commit()
        db.refresh(annex)
        return annex

    @classmethod
    def activate_burial_annex(
        cls,
        db: Session,
        annex_id: int,
        data: AnnexActivateRequest,
        current_user_id: int,
    ) -> ContractAnnex:
        annex = (
            db.query(ContractAnnex)
            .filter(ContractAnnex.annex_id == annex_id)
            .with_for_update()
            .first()
        )
        if not annex:
            raise HTTPException(status_code=404, detail="Không tìm thấy phụ lục")

        if annex.status == "ACTIVE":
            return annex

        if annex.status not in ("DRAFT", "PENDING_SIGN"):
            raise HTTPException(
                status_code=400,
                detail=f"Không thể kích hoạt phụ lục ở trạng thái '{annex.status}'.",
            )

        scan_file = (
            db.query(FileObject).filter(FileObject.file_id == data.signed_scan_file_id).first()
        )
        if not scan_file or scan_file.state != "READY":
            raise HTTPException(
                status_code=400,
                detail="Tệp scan phụ lục đã ký chưa sẵn sàng hoặc không tồn tại.",
            )

        burial = db.query(BurialAnnex).filter(BurialAnnex.annex_id == annex.annex_id).first()
        if not burial:
            raise HTTPException(
                status_code=400, detail="Không tìm thấy thông tin an táng của phụ lục."
            )

        # Invariant checks:
        if not ProfileService.check_death_certificate_verified(db, burial.deceased_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Người quá cố chưa có giấy báo tử được xác minh hợp lệ. Không thể kích hoạt an táng!",
            )

        plot = db.query(Plot).filter(Plot.plot_id == burial.plot_id).with_for_update().first()
        if not plot:
            raise HTTPException(status_code=404, detail="Không tìm thấy ô mộ.")

        if plot.is_locked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ô mộ đã bị khóa vĩnh viễn, không thể an táng thêm!",
            )
        if plot.is_kim_tinh and plot.status == "OCCUPIED":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Quy tắc Kim Tĩnh Bất Biến: Ô mộ Kim Tĩnh đã hoàn tất an táng và khóa vĩnh viễn!",
            )

        slot = (
            db.query(PlotSlot)
            .filter(PlotSlot.slot_id == burial.slot_id, PlotSlot.plot_id == plot.plot_id)
            .with_for_update()
            .first()
        )
        if not slot or slot.status != "EMPTY":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Slot huyệt an táng không còn trống.",
            )

        now = _utc_now_naive()
        signed_date = data.signed_at or date.today()

        annex.status = "ACTIVE"
        annex.signed_scan_file_id = scan_file.file_id
        annex.signed_scan_url = scan_file.object_key
        annex.signed_at = signed_date
        annex.activated_at = now
        annex.activated_by = current_user_id
        annex.activation_notes = data.activation_notes
        annex.updated_at = now

        slot.status = "OCCUPIED"
        slot.current_deceased_id = burial.deceased_id

        plot.status = "OCCUPIED"
        if burial.is_kim_tinh:
            plot.is_kim_tinh = True
            plot.is_locked = True

        history = BurialHistory(
            plot_id=plot.plot_id,
            slot_id=slot.slot_id,
            deceased_id=burial.deceased_id,
            action_type="BURIED",
            action_date=now,
            proof_url=scan_file.object_key,
            proof_file_id=scan_file.file_id,
            performed_by=current_user_id,
            notes=f"An táng theo phụ lục {annex.annex_code}",
            created_at=now,
        )
        db.add(history)

        if annex.additional_amount > 0:
            cls._create_receivable(
                db,
                annex.contract,
                signed_date,
                now,
                annex_id=annex.annex_id,
                amount=annex.additional_amount,
            )

        outbox = OutboxEvent(
            event_id=str(uuid.uuid4()),
            event_type="BURIAL_COMPLETED",
            aggregate_type="ANNEX",
            aggregate_id=str(annex.annex_id),
            payload=json.dumps(
                {
                    "annex_id": annex.annex_id,
                    "annex_code": annex.annex_code,
                    "contract_id": annex.contract_id,
                    "plot_id": plot.plot_id,
                    "slot_id": slot.slot_id,
                    "deceased_id": burial.deceased_id,
                    "is_kim_tinh": burial.is_kim_tinh,
                    "activated_at": now.isoformat(),
                    "activated_by": current_user_id,
                },
                ensure_ascii=False,
            ),
            state="PENDING",
            created_at=now,
        )
        db.add(outbox)

        audit = AuditLog(
            user_id=current_user_id,
            action_type="ACTIVATE_ANNEX",
            target_entity="ContractAnnex",
            target_id=str(annex.annex_id),
            post_change_values=json.dumps(
                {
                    "annex_code": annex.annex_code,
                    "status": annex.status,
                    "plot_id": plot.plot_id,
                    "slot_id": slot.slot_id,
                    "is_kim_tinh": burial.is_kim_tinh,
                },
                ensure_ascii=False,
            ),
        )
        db.add(audit)

        db.commit()
        db.refresh(annex)
        return annex

    # ==============================================================================
    # 6. TRA CỨU DANH SÁCH & CHI TIẾT HỢP ĐỒNG
    # ==============================================================================
    @classmethod
    def get_contract(cls, db: Session, contract_id: int) -> Contract:
        contract = (
            db.query(Contract)
            .options(
                joinedload(Contract.customer),
                joinedload(Contract.land_purchase),
                joinedload(Contract.exhumation),
                joinedload(Contract.transfer),
                joinedload(Contract.cremation),
                joinedload(Contract.creator),
                joinedload(Contract.activator),
                joinedload(Contract.template),
                joinedload(Contract.reservation),
                joinedload(Contract.annexes).joinedload(ContractAnnex.burial),
            )
            .filter(Contract.contract_id == contract_id)
            .first()
        )
        if not contract:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy hợp đồng với ID {contract_id}",
            )
        return contract

    @classmethod
    def list_contracts(
        cls,
        db: Session,
        contract_type: Optional[str] = None,
        status_filter: Optional[str] = None,
        customer_id: Optional[int] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[ContractBriefResponse]:
        query = (
            db.query(Contract)
            .join(Customer, Customer.customer_id == Contract.customer_id)
            .options(
                joinedload(Contract.customer),
                joinedload(Contract.land_purchase),
                joinedload(Contract.exhumation),
                joinedload(Contract.transfer),
                joinedload(Contract.cremation),
            )
        )

        if contract_type:
            query = query.filter(Contract.contract_type == contract_type)
        if status_filter:
            query = query.filter(Contract.status == status_filter)
        if customer_id:
            query = query.filter(Contract.customer_id == customer_id)
        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                sa.or_(
                    Contract.contract_code.ilike(s),
                    Customer.full_name.ilike(s),
                    Customer.phone_number.like(s),
                )
            )

        results = query.order_by(Contract.created_at.desc()).offset(offset).limit(limit).all()

        briefs: List[ContractBriefResponse] = []
        for c in results:
            plot_id_target: Optional[int] = None
            if c.land_purchase:
                plot_id_target = c.land_purchase.plot_id
            elif c.exhumation:
                plot_id_target = c.exhumation.plot_id
            elif c.transfer:
                plot_id_target = c.transfer.plot_id

            plot_obj = None
            if plot_id_target:
                plot_obj = db.query(Plot).filter(Plot.plot_id == plot_id_target).first()

            briefs.append(
                ContractBriefResponse(
                    contract_id=c.contract_id,
                    contract_code=c.contract_code,
                    contract_type=c.contract_type,
                    status=c.status,
                    total_amount=c.total_amount,
                    customer_id=c.customer_id,
                    customer_name=c.customer.full_name if c.customer else "",
                    customer_phone=c.customer.phone_number if c.customer else "",
                    plot_id=plot_obj.plot_id if plot_obj else None,
                    plot_code=plot_obj.plot_code if plot_obj else None,
                    zone_name=plot_obj.row.zone.zone_name
                    if (plot_obj and plot_obj.row and plot_obj.row.zone)
                    else None,
                    signed_at=c.signed_at,
                    activated_at=c.activated_at,
                    created_at=c.created_at,
                )
            )
        return briefs

    @classmethod
    def submit_for_signing(
        cls,
        db: Session,
        contract_id: int,
        template_id: Optional[int],
        notes: Optional[str],
        current_user_id: int,
    ) -> Contract:
        contract = cls.get_contract(db, contract_id)
        if contract.status != "DRAFT":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Chỉ có thể chuyển sang PENDING_SIGN khi hợp đồng ở trạng thái DRAFT (hiện tại: {contract.status}).",
            )

        if template_id:
            tmpl = (
                db.query(ContractTemplate)
                .filter(ContractTemplate.template_id == template_id)
                .first()
            )
            if not tmpl:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Không tìm thấy mẫu hợp đồng với ID {template_id}",
                )
            contract.template_id = tmpl.template_id
            contract.template_version = tmpl.version_no

        contract.status = "PENDING_SIGN"
        if notes:
            contract.notes = f"{contract.notes or ''}\n[Gửi ký]: {notes}".strip()
        contract.updated_at = _utc_now_naive()

        audit = AuditLog(
            user_id=current_user_id,
            action_type="SUBMIT_FOR_SIGNING",
            target_entity="Contract",
            target_id=str(contract.contract_id),
            post_change_values=json.dumps(
                {"contract_code": contract.contract_code, "status": contract.status},
                ensure_ascii=False,
            ),
        )
        db.add(audit)
        db.commit()
        db.refresh(contract)
        return contract

    # ==============================================================================
    # 7. KÍCH HOẠT HỢP ĐỒNG TOÀN DIỆN (ACID DISPATCH)
    # ==============================================================================
    @classmethod
    def activate_contract(
        cls,
        db: Session,
        contract_id: int,
        data: ContractActivateRequest,
        current_user_id: int,
    ) -> Contract:
        contract = (
            db.query(Contract).filter(Contract.contract_id == contract_id).with_for_update().first()
        )
        if not contract:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy hợp đồng với ID {contract_id}",
            )

        # Idempotency:
        if contract.status == "ACTIVE":
            return contract

        if contract.status not in ("DRAFT", "PENDING_SIGN"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể kích hoạt hợp đồng đang ở trạng thái '{contract.status}'.",
            )

        scan_file = (
            db.query(FileObject).filter(FileObject.file_id == data.signed_scan_file_id).first()
        )
        if not scan_file or scan_file.state != "READY":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tệp scan hợp đồng đã ký chưa sẵn sàng hoặc không tồn tại trên hệ thống lưu trữ.",
            )

        now = _utc_now_naive()
        signed_date = data.signed_at or date.today()

        contract.status = "ACTIVE"
        contract.signed_scan_file_id = scan_file.file_id
        contract.signed_scan_url = scan_file.object_key
        contract.signed_at = signed_date
        contract.activated_at = now
        contract.activated_by = current_user_id
        contract.activation_notes = data.activation_notes
        contract.updated_at = now

        # Dispatch by contract_type:
        if contract.contract_type == "LAND_PURCHASE":
            cls._activate_land_purchase(db, contract, scan_file, signed_date, now, current_user_id)
        elif contract.contract_type == "EXHUMATION":
            cls._activate_exhumation(db, contract, scan_file, signed_date, now, current_user_id)
        elif contract.contract_type == "TRANSFER":
            cls._activate_transfer(db, contract, scan_file, signed_date, now, current_user_id)
        elif contract.contract_type == "CREMATION":
            cls._activate_cremation(db, contract, scan_file, signed_date, now, current_user_id)

        audit = AuditLog(
            user_id=current_user_id,
            action_type="ACTIVATE",
            target_entity="Contract",
            target_id=str(contract.contract_id),
            post_change_values=json.dumps(
                {
                    "contract_code": contract.contract_code,
                    "contract_type": contract.contract_type,
                    "signed_scan_file_id": scan_file.file_id,
                    "signed_at": str(signed_date),
                },
                ensure_ascii=False,
            ),
        )
        db.add(audit)

        db.commit()
        db.refresh(contract)
        return contract

    @classmethod
    def _activate_land_purchase(
        cls,
        db: Session,
        contract: Contract,
        scan_file: FileObject,
        signed_date: date,
        now: datetime,
        current_user_id: int,
    ):
        land_sub = (
            db.query(LandPurchaseContract)
            .filter(LandPurchaseContract.contract_id == contract.contract_id)
            .first()
        )
        plot_id_target: Optional[int] = None
        if land_sub:
            plot_id_target = land_sub.plot_id
            plot = db.query(Plot).filter(Plot.plot_id == land_sub.plot_id).with_for_update().first()
            if plot:
                plot.status = "OWNED_EMPTY"
                plot.owner_id = contract.customer_id

                reservation = (
                    db.query(PlotReservation)
                    .filter(
                        PlotReservation.contract_id == contract.contract_id,
                        PlotReservation.state == "ACTIVE",
                    )
                    .first()
                )
                if reservation:
                    reservation.state = "CONVERTED"

                ownership = PlotOwnership(
                    plot_id=plot.plot_id,
                    customer_id=contract.customer_id,
                    basis_contract_id=contract.contract_id,
                    valid_from=now,
                    valid_to=None,
                    transfer_reason=f"Mua đất an táng theo hợp đồng {contract.contract_code}",
                    created_at=now,
                )
                db.add(ownership)

        cls._create_receivable(db, contract, signed_date, now)

        outbox_event = OutboxEvent(
            event_id=str(uuid.uuid4()),
            event_type="CONTRACT_ACTIVATED",
            aggregate_type="CONTRACT",
            aggregate_id=str(contract.contract_id),
            payload=json.dumps(
                {
                    "contract_id": contract.contract_id,
                    "contract_code": contract.contract_code,
                    "contract_type": contract.contract_type,
                    "customer_id": contract.customer_id,
                    "plot_id": plot_id_target,
                    "total_amount": str(contract.total_amount),
                    "activated_at": now.isoformat(),
                    "activated_by": current_user_id,
                },
                ensure_ascii=False,
            ),
            state="PENDING",
            created_at=now,
        )
        db.add(outbox_event)

    @classmethod
    def _activate_exhumation(
        cls,
        db: Session,
        contract: Contract,
        scan_file: FileObject,
        signed_date: date,
        now: datetime,
        current_user_id: int,
    ):
        exhumation = (
            db.query(ExhumationContract)
            .filter(ExhumationContract.contract_id == contract.contract_id)
            .first()
        )
        if not exhumation:
            raise HTTPException(status_code=400, detail="Không tìm thấy chi tiết hợp đồng cải táng")

        plot = db.query(Plot).filter(Plot.plot_id == exhumation.plot_id).with_for_update().first()
        if not plot:
            raise HTTPException(status_code=404, detail="Không tìm thấy ô mộ cần cải táng")

        # Invariant: Kim Tĩnh Immutability
        if plot.is_kim_tinh or plot.is_locked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Quy tắc Kim Tĩnh Bất Biến [BR-KIMTINH]: Ô mộ xây kết cấu Kim Tĩnh đã kiên cố vĩnh viễn, nghiêm cấm lập thủ tục bóc mộ/cải táng!",
            )

        slot = None
        if exhumation.slot_id:
            slot = (
                db.query(PlotSlot)
                .filter(PlotSlot.slot_id == exhumation.slot_id, PlotSlot.plot_id == plot.plot_id)
                .with_for_update()
                .first()
            )
        else:
            slot = (
                db.query(PlotSlot)
                .filter(
                    PlotSlot.plot_id == plot.plot_id,
                    PlotSlot.current_deceased_id == exhumation.current_deceased_id,
                )
                .with_for_update()
                .first()
            )

        if slot:
            slot.status = "EMPTY"
            slot.current_deceased_id = None
            db.flush()

        remaining_occupied = (
            db.query(PlotSlot)
            .filter(PlotSlot.plot_id == plot.plot_id, PlotSlot.status == "OCCUPIED")
            .count()
        )
        if remaining_occupied > 0:
            plot.status = "OCCUPIED"
        else:
            plot.status = "OWNED_EMPTY"

        history = BurialHistory(
            plot_id=plot.plot_id,
            slot_id=slot.slot_id if slot else None,
            deceased_id=exhumation.current_deceased_id,
            action_type="EXHUMED",
            action_date=now,
            proof_url=scan_file.object_key,
            proof_file_id=scan_file.file_id,
            performed_by=current_user_id,
            notes=f"Cải táng theo hợp đồng {contract.contract_code}. Lý do: {exhumation.reason or 'Theo nguyện vọng thân nhân'}",
            created_at=now,
        )
        db.add(history)

        if contract.total_amount > 0:
            cls._create_receivable(db, contract, signed_date, now)

        outbox = OutboxEvent(
            event_id=str(uuid.uuid4()),
            event_type="EXHUMATION_COMPLETED",
            aggregate_type="CONTRACT",
            aggregate_id=str(contract.contract_id),
            payload=json.dumps(
                {
                    "contract_id": contract.contract_id,
                    "contract_code": contract.contract_code,
                    "plot_id": plot.plot_id,
                    "slot_id": slot.slot_id if slot else None,
                    "deceased_id": exhumation.current_deceased_id,
                    "activated_at": now.isoformat(),
                    "activated_by": current_user_id,
                },
                ensure_ascii=False,
            ),
            state="PENDING",
            created_at=now,
        )
        db.add(outbox)

    @classmethod
    def _activate_transfer(
        cls,
        db: Session,
        contract: Contract,
        scan_file: FileObject,
        signed_date: date,
        now: datetime,
        current_user_id: int,
    ):
        transfer = (
            db.query(TransferContract)
            .filter(TransferContract.contract_id == contract.contract_id)
            .first()
        )
        if not transfer:
            raise HTTPException(
                status_code=400, detail="Không tìm thấy chi tiết hợp đồng chuyển nhượng"
            )

        plot = db.query(Plot).filter(Plot.plot_id == transfer.plot_id).with_for_update().first()
        if not plot:
            raise HTTPException(status_code=404, detail="Không tìm thấy ô mộ cần chuyển nhượng")

        if plot.is_kim_tinh or plot.is_locked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Quy tắc Kim Tĩnh Bất Biến: Không thể chuyển nhượng ô mộ Kim Tĩnh đã bị khóa vĩnh viễn.",
            )

        occupied_slot = (
            db.query(PlotSlot)
            .filter(PlotSlot.plot_id == plot.plot_id, PlotSlot.status == "OCCUPIED")
            .first()
        )
        if occupied_slot or plot.status == "OCCUPIED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể chuyển nhượng ô mộ đang có người an táng.",
            )

        prior_ownership = (
            db.query(PlotOwnership)
            .filter(PlotOwnership.plot_id == plot.plot_id, PlotOwnership.valid_to.is_(None))
            .first()
        )
        if prior_ownership:
            prior_ownership.valid_to = now

        new_ownership = PlotOwnership(
            plot_id=plot.plot_id,
            customer_id=transfer.buyer_id,
            basis_contract_id=contract.contract_id,
            valid_from=now,
            valid_to=None,
            transfer_reason=transfer.transfer_reason
            or f"Nhận chuyển nhượng từ hợp đồng {contract.contract_code}",
            created_at=now,
        )
        db.add(new_ownership)
        plot.owner_id = transfer.buyer_id

        if contract.total_amount > 0:
            cls._create_receivable(db, contract, signed_date, now)

        outbox = OutboxEvent(
            event_id=str(uuid.uuid4()),
            event_type="PLOT_TRANSFERRED",
            aggregate_type="CONTRACT",
            aggregate_id=str(contract.contract_id),
            payload=json.dumps(
                {
                    "contract_id": contract.contract_id,
                    "contract_code": contract.contract_code,
                    "plot_id": plot.plot_id,
                    "seller_id": transfer.seller_id,
                    "buyer_id": transfer.buyer_id,
                    "activated_at": now.isoformat(),
                    "activated_by": current_user_id,
                },
                ensure_ascii=False,
            ),
            state="PENDING",
            created_at=now,
        )
        db.add(outbox)

    @classmethod
    def _activate_cremation(
        cls,
        db: Session,
        contract: Contract,
        scan_file: FileObject,
        signed_date: date,
        now: datetime,
        current_user_id: int,
    ):
        cremation = (
            db.query(CremationContract)
            .filter(CremationContract.contract_id == contract.contract_id)
            .first()
        )
        if not cremation:
            raise HTTPException(status_code=400, detail="Không tìm thấy chi tiết hợp đồng hỏa táng")

        if contract.total_amount > 0:
            cls._create_receivable(db, contract, signed_date, now)

        outbox = OutboxEvent(
            event_id=str(uuid.uuid4()),
            event_type="CREMATION_ACTIVATED",
            aggregate_type="CONTRACT",
            aggregate_id=str(contract.contract_id),
            payload=json.dumps(
                {
                    "contract_id": contract.contract_id,
                    "contract_code": contract.contract_code,
                    "deceased_id": cremation.deceased_id,
                    "activated_at": now.isoformat(),
                    "activated_by": current_user_id,
                },
                ensure_ascii=False,
            ),
            state="PENDING",
            created_at=now,
        )
        db.add(outbox)

    @classmethod
    def _create_receivable(
        cls,
        db: Session,
        contract: Contract,
        signed_date: date,
        now: datetime,
        annex_id: Optional[int] = None,
        amount: Optional[Decimal] = None,
    ) -> Receivable:
        if annex_id is not None:
            existing = db.query(Receivable).filter(Receivable.annex_id == annex_id).first()
            cid = None
        else:
            existing = (
                db.query(Receivable)
                .filter(
                    Receivable.contract_id == contract.contract_id,
                    Receivable.annex_id.is_(None),
                )
                .first()
            )
            cid = contract.contract_id

        if existing:
            return existing

        total = amount if amount is not None else contract.total_amount
        due_date = signed_date + timedelta(days=30)
        rec = Receivable(
            contract_id=cid,
            annex_id=annex_id,
            customer_id=contract.customer_id,
            original_amount=total,
            discount_amount=Decimal("0.00"),
            final_payable_amount=total,
            total_paid_amount=Decimal("0.00"),
            status="UNPAID",
            due_date=due_date,
            created_at=now,
        )
        db.add(rec)
        return rec

    @classmethod
    def cancel_contract(
        cls,
        db: Session,
        contract_id: int,
        reason: str,
        current_user_id: int,
    ) -> Contract:
        contract = cls.get_contract(db, contract_id)
        if contract.status == "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hợp đồng đã kích hoạt không thể hủy trực tiếp. Vui lòng thực hiện thủ tục thanh lý hoặc chuyển nhượng.",
            )

        if contract.status == "CANCELLED":
            return contract

        now = _utc_now_naive()
        contract.status = "CANCELLED"
        contract.notes = f"{contract.notes or ''}\n[HỦY HỢP ĐỒNG]: {reason}".strip()
        contract.updated_at = now

        if contract.contract_type == "LAND_PURCHASE" and contract.land_purchase:
            plot = (
                db.query(Plot)
                .filter(Plot.plot_id == contract.land_purchase.plot_id)
                .with_for_update()
                .first()
            )
            if plot:
                plot.status = "EMPTY_UNSOLD"

            res = (
                db.query(PlotReservation)
                .filter(
                    PlotReservation.contract_id == contract.contract_id,
                    PlotReservation.state == "ACTIVE",
                )
                .first()
            )
            if res:
                res.state = "CANCELLED"

        audit = AuditLog(
            user_id=current_user_id,
            action_type="CANCEL",
            target_entity="Contract",
            target_id=str(contract.contract_id),
            post_change_values=json.dumps(
                {"contract_code": contract.contract_code, "reason": reason},
                ensure_ascii=False,
            ),
        )
        db.add(audit)
        db.commit()
        db.refresh(contract)
        return contract

    @classmethod
    def generate_contract_pdf(cls, db: Session, contract_id: int) -> bytes:
        contract = cls.get_contract(db, contract_id)
        customer = contract.customer

        plot_code = "Chưa chỉ định"
        target_plot_id = None
        if contract.land_purchase:
            target_plot_id = contract.land_purchase.plot_id
        elif contract.exhumation:
            target_plot_id = contract.exhumation.plot_id
        elif contract.transfer:
            target_plot_id = contract.transfer.plot_id

        if target_plot_id:
            plot = db.query(Plot).filter(Plot.plot_id == target_plot_id).first()
            if plot:
                plot_code = plot.plot_code

        pdf_bytes = PDFService.generate_contract_pdf(
            contract_code=contract.contract_code,
            contract_type=contract.contract_type,
            customer_name=customer.full_name if customer else "Khách hàng",
            customer_phone=customer.phone_number if customer else "",
            customer_citizen_id=customer.citizen_id if customer else "",
            plot_code=plot_code,
            total_amount=f"{contract.total_amount:,.0f} VND",
            created_at=contract.created_at,
        )
        return pdf_bytes

    # ==============================================================================
    # 8. DTO SERIALIZATION
    # ==============================================================================
    @classmethod
    def get_contract_detail_dto(cls, db: Session, contract_id: int) -> ContractDetailResponse:
        contract = cls.get_contract(db, contract_id)

        customer_brief = None
        if contract.customer:
            customer_brief = CustomerBrief(
                customer_id=contract.customer.customer_id,
                customer_code=contract.customer.customer_code,
                full_name=contract.customer.full_name,
                citizen_id=contract.customer.citizen_id,
                phone_number=contract.customer.phone_number,
                address=contract.customer.address,
                date_of_birth=contract.customer.date_of_birth,
            )

        land_detail = None
        exhumation_detail = None
        transfer_detail = None
        cremation_detail = None
        plot_brief = None

        if contract.land_purchase:
            plot = db.query(Plot).filter(Plot.plot_id == contract.land_purchase.plot_id).first()
            if plot:
                plot_brief = cls._to_plot_brief(plot)
            land_detail = LandPurchaseDetailBrief(
                plot_id=contract.land_purchase.plot_id,
                land_unit_price=contract.land_purchase.land_unit_price,
                plot=plot_brief,
            )

        if contract.exhumation:
            plot = db.query(Plot).filter(Plot.plot_id == contract.exhumation.plot_id).first()
            if plot:
                plot_brief = cls._to_plot_brief(plot)
            deceased = (
                db.query(DeceasedProfile)
                .filter(DeceasedProfile.deceased_id == contract.exhumation.current_deceased_id)
                .first()
            )
            slot = (
                db.query(PlotSlot).filter(PlotSlot.slot_id == contract.exhumation.slot_id).first()
                if contract.exhumation.slot_id
                else None
            )
            exhumation_detail = ExhumationDetailBrief(
                plot_id=contract.exhumation.plot_id,
                slot_id=contract.exhumation.slot_id,
                current_deceased_id=contract.exhumation.current_deceased_id,
                deceased_name=deceased.full_name if deceased else None,
                plot_code=plot.plot_code if plot else None,
                slot_number=slot.slot_number if slot else None,
                exhumation_date=contract.exhumation.exhumation_date,
                exhumation_fee=contract.exhumation.exhumation_fee,
                reason=contract.exhumation.reason,
            )

        if contract.transfer:
            plot = db.query(Plot).filter(Plot.plot_id == contract.transfer.plot_id).first()
            if plot:
                plot_brief = cls._to_plot_brief(plot)
            seller = (
                db.query(Customer)
                .filter(Customer.customer_id == contract.transfer.seller_id)
                .first()
            )
            buyer = (
                db.query(Customer)
                .filter(Customer.customer_id == contract.transfer.buyer_id)
                .first()
            )
            transfer_detail = TransferDetailBrief(
                plot_id=contract.transfer.plot_id,
                plot_code=plot.plot_code if plot else None,
                seller_id=contract.transfer.seller_id,
                seller_name=seller.full_name if seller else None,
                buyer_id=contract.transfer.buyer_id,
                buyer_name=buyer.full_name if buyer else None,
                commission_fee=contract.transfer.commission_fee,
                transfer_reason=contract.transfer.transfer_reason,
            )

        if contract.cremation:
            deceased = (
                db.query(DeceasedProfile)
                .filter(DeceasedProfile.deceased_id == contract.cremation.deceased_id)
                .first()
            )
            cremation_detail = CremationDetailBrief(
                deceased_id=contract.cremation.deceased_id,
                deceased_name=deceased.full_name if deceased else None,
                cremation_date=contract.cremation.cremation_date,
                package_service_code=contract.cremation.package_service_code,
                urn_storage_option=contract.cremation.urn_storage_option,
                service_fee=contract.cremation.service_fee,
            )

        receivable_brief = None
        rec = (
            db.query(Receivable)
            .filter(Receivable.contract_id == contract.contract_id, Receivable.annex_id.is_(None))
            .first()
        )
        if rec:
            receivable_brief = ReceivableBrief(
                receivable_id=rec.receivable_id,
                contract_id=rec.contract_id or contract.contract_id,
                original_amount=rec.original_amount,
                discount_amount=rec.discount_amount,
                final_payable_amount=rec.final_payable_amount,
                total_paid_amount=rec.total_paid_amount,
                status=rec.status,
                due_date=rec.due_date,
            )

        activator_name = None
        if contract.activator:
            activator_name = contract.activator.full_name

        # Annexes
        annexes_dto: List[ContractAnnexResponse] = []
        for a in contract.annexes:
            burial_dto = None
            if a.burial:
                dec = (
                    db.query(DeceasedProfile)
                    .filter(DeceasedProfile.deceased_id == a.burial.deceased_id)
                    .first()
                )
                b_plot = db.query(Plot).filter(Plot.plot_id == a.burial.plot_id).first()
                b_slot = db.query(PlotSlot).filter(PlotSlot.slot_id == a.burial.slot_id).first()
                burial_dto = BurialAnnexDetailBrief(
                    deceased_id=a.burial.deceased_id,
                    deceased_name=dec.full_name if dec else None,
                    plot_id=a.burial.plot_id,
                    plot_code=b_plot.plot_code if b_plot else None,
                    slot_id=a.burial.slot_id,
                    slot_number=b_slot.slot_number if b_slot else None,
                    burial_date=a.burial.burial_date,
                    is_kim_tinh=a.burial.is_kim_tinh,
                    construction_notes=a.burial.construction_notes,
                )

            annexes_dto.append(
                ContractAnnexResponse(
                    annex_id=a.annex_id,
                    annex_code=a.annex_code,
                    contract_id=a.contract_id,
                    annex_type=a.annex_type,
                    status=a.status,
                    additional_amount=a.additional_amount,
                    signed_scan_file_id=a.signed_scan_file_id,
                    signed_scan_url=a.signed_scan_url,
                    signed_at=a.signed_at,
                    activated_at=a.activated_at,
                    activated_by=a.activated_by,
                    activator_name=a.activator.full_name if a.activator else None,
                    activation_notes=a.activation_notes,
                    valid_from=a.valid_from,
                    valid_to=a.valid_to,
                    notes=a.notes,
                    created_at=a.created_at,
                    updated_at=a.updated_at,
                    burial=burial_dto,
                )
            )

        return ContractDetailResponse(
            contract_id=contract.contract_id,
            contract_code=contract.contract_code,
            contract_type=contract.contract_type,
            status=contract.status,
            total_amount=contract.total_amount,
            signed_at=contract.signed_at,
            activated_at=contract.activated_at,
            activated_by=contract.activated_by,
            activator_name=activator_name,
            activation_notes=contract.activation_notes,
            template_id=contract.template_id,
            template_version=contract.template_version,
            signed_scan_file_id=contract.signed_scan_file_id,
            signed_scan_url=contract.signed_scan_url,
            notes=contract.notes,
            created_at=contract.created_at,
            updated_at=contract.updated_at,
            customer=customer_brief,
            land_purchase=land_detail,
            exhumation=exhumation_detail,
            transfer=transfer_detail,
            cremation=cremation_detail,
            plot=plot_brief,
            receivable=receivable_brief,
            annexes=annexes_dto,
        )

    @classmethod
    def _to_plot_brief(cls, plot: Plot) -> PlotBrief:
        return PlotBrief(
            plot_id=plot.plot_id,
            plot_code=plot.plot_code,
            zone_code=plot.row.zone.zone_code if (plot.row and plot.row.zone) else "",
            zone_name=plot.row.zone.zone_name if (plot.row and plot.row.zone) else "",
            row_code=plot.row.row_code if plot.row else "",
            type_name=plot.plot_type.type_name if plot.plot_type else "",
            status=plot.status,
            is_kim_tinh=plot.is_kim_tinh,
            is_locked=plot.is_locked,
            orientation=plot.orientation,
        )
