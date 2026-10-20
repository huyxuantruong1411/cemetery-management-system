import json
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional

import sqlalchemy as sa
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.modules.audit.models import AuditLog
from app.modules.auth.models import User
from app.modules.care.models import CarePackage
from app.modules.catalog.models import PriceItem, PriceList
from app.modules.contracts.models import (
    BurialAnnex,
    CareAnnex,
    ConstructionAnnex,
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
    CareAnnexCreate,
    CareAnnexDetailBrief,
    ConstructionAnnexCreate,
    ConstructionAnnexDetailBrief,
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
from app.modules.plots.models import (
    BurialHistory,
    Plot,
    PlotOwnership,
    PlotReservation,
    PlotSlot,
    Row,
)
from app.modules.profiles.models import Customer, DeceasedProfile
from app.modules.profiles.service import ProfileService
from app.services.pdf_service import PDFService

# =============================================================================
# PHÂN HỆ QUẢN LÝ HỢP ĐỒNG & PHỤ LỤC GIAO DỊCH (CONTRACTS SERVICE)
# =============================================================================
# Vai trò kiến trúc:
# - Trung tâm điều phối giao dịch pháp lý & thương mại của nghĩa trang.
# - Quản lý 4 loại hợp đồng độc lập:
#   1. Hợp đồng mua bán đất mộ (LAND_PURCHASE)
#   2. Hợp đồng cải táng / cất bốc (EXHUMATION)
#   3. Hợp đồng chuyển nhượng quyền sử dụng (TRANSFER)
#   4. Hợp đồng dịch vụ hỏa táng (CREMATION)
# - Quản lý 3 loại phụ lục giao dịch phát sinh (Contract Annexes):
#   1. Phụ lục an táng (BURIAL) - Cổng kiểm soát Giấy chứng tử & xác nhận thực địa.
#   2. Phụ lục chăm sóc mộ phần định kỳ (CARE)
#   3. Phụ lục xây dựng & thi công lăng mộ (CONSTRUCTION)
# - Các nguyên tắc bất biến sống còn (Core Domain Invariants):
#   1. Cổng kiểm soát giấy báo tử (Death Certificate Gate): Phải có giấy báo tử đã thẩm định
#      hợp lệ mới cho phép lập Hợp đồng Hỏa táng hoặc Phụ lục An táng.
#   2. Quy tắc Kim Tĩnh Bất Biến: Cấm tuyệt đối cải táng (Exhumation) hoặc chuyển nhượng (Transfer)
#      đối với các ô mộ có kết cấu Kim Tĩnh đã an táng/khóa vĩnh viễn.
#   3. Phân tách Pháp lý và Thực địa: Việc kích hoạt phụ lục an táng (Activate Annex) chỉ mang
#      tính pháp lý/tài chính. Ô mộ chỉ chính thức khóa vĩnh viễn khi Quản trang ngoài hiện trường
#      bấm 'Xác nhận an táng' (Confirm Burial) kèm ảnh chụp biên bản thực địa.
#   4. Tự động sinh công nợ (Receivable): Mỗi hợp đồng hoặc phụ lục kích hoạt đều sinh khoản phải thu
#      với ràng buộc loại trừ XOR (Hoặc thuộc Hợp đồng, Hoặc thuộc Phụ lục).
# =============================================================================


def _utc_now_naive() -> datetime:
    """Trả về thời gian UTC hiện tại dạng naive datetime tương thích với kiểu DATETIME của MSSQL."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ContractService:
    @staticmethod
    def generate_contract_code(db: Session, prefix: str = "HD-MD") -> str:
        """
        Sinh mã số hợp đồng an toàn đa luồng bằng SQL Server Sequence (G09):
        - Sử dụng SEQUENCE vật lý 'seq_contract_number' trong CSDL để đảm bảo tính duy nhất tuyệt đối.
        - Chống trùng lặp số hợp đồng khi hàng chục nhân viên lập hợp đồng cùng một thời điểm.
        - Định dạng: {PREFIX}-{NĂM}-{SỐ THỨ TỰ 6 CHỮ SỐ} (Ví dụ: HD-MD-2026-001001).
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
        Sinh mã số phụ lục an toàn đa luồng bằng SQL Server Sequence (seq_annex_number):
        - Định dạng: {PREFIX}-{NĂM}-{SỐ THỨ TỰ 6 CHỮ SỐ} (Ví dụ: PL-AT-2026-001001).
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
        """
        LẬP HỢP ĐỒNG MUA BÁN ĐẤT MỘ (TRẠNG THÁI DRAFT):
        - Bước 1: Kiểm tra khách hàng tồn tại.
        - Bước 2: Khóa dòng ô mộ bằng '.with_for_update()' chống tranh chấp đồng thời.
        - Bước 3: Kiểm tra tính khả dụng của ô đất (chỉ cho phép ô EMPTY_UNSOLD hoặc RESERVED).
        - Bước 4: Kiểm tra lệnh giữ chỗ (Reservation): Nếu ô đang được người khác giữ chỗ,
                  hệ thống sẽ từ chối để bảo vệ quyền ưu tiên của khách giữ chỗ trước đó.
        - Bước 5: Tra cứu đơn giá niêm yết tự động theo bảng giá hiệu lực (PriceList / PriceItem).
        - Bước 6: Khởi tạo hợp đồng ở trạng thái DRAFT, chuyển đổi giữ chỗ sang hợp đồng này (7 ngày),
                  cập nhật trạng thái ô mộ sang RESERVED và ghi nhật ký AuditLog.
        """
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

        if plot.status not in ("EMPTY_UNSOLD", "RESERVED"):
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
            if active_res.contract_id is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Ô mộ {plot.plot_code} không khả dụng vì đã có hợp đồng đang giữ chỗ xử lý.",
                )
            is_matching_reservation = (
                active_res.reserved_by == current_user_id
                or (
                    active_res.customer_phone
                    and customer.phone_number
                    and active_res.customer_phone.strip() == customer.phone_number.strip()
                )
                or (
                    active_res.customer_name
                    and customer.full_name
                    and active_res.customer_name.strip().lower()
                    == customer.full_name.strip().lower()
                )
            )
            if not is_matching_reservation:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Ô mộ {plot.plot_code} hiện đang được giữ chỗ bởi '{active_res.customer_name or 'khách hàng khác'}'.",
                )

        unit_price = data.land_unit_price
        if unit_price is None or unit_price <= 0:
            today = date.today()
            # 1. Look up specific plot_type_id or LAND_{type_id}
            active_price_item = (
                db.query(PriceItem)
                .join(PriceList, PriceList.price_list_id == PriceItem.price_list_id)
                .filter(
                    PriceList.is_active == True,  # noqa: E712
                    PriceList.effective_from_date <= today,
                    or_(
                        PriceList.effective_to_date.is_(None),
                        PriceList.effective_to_date >= today,
                    ),
                    or_(
                        PriceItem.plot_type_id == plot.type_id,
                        PriceItem.item_code == f"LAND_{plot.type_id}",
                    ),
                )
                .first()
            )
            # 2. Look up standard catalog item code by slot count (GIA-DAT-DON, GIA-DAT-DOI, GIA-DAT-GIA-TOC)
            if not active_price_item and plot.plot_type:
                slots = plot.plot_type.default_slots
                slot_code = (
                    "GIA-DAT-DON"
                    if slots == 1
                    else ("GIA-DAT-DOI" if slots == 2 else "GIA-DAT-GIA-TOC")
                )
                active_price_item = (
                    db.query(PriceItem)
                    .join(PriceList, PriceList.price_list_id == PriceItem.price_list_id)
                    .filter(
                        PriceList.is_active == True,  # noqa: E712
                        PriceList.effective_from_date <= today,
                        or_(
                            PriceList.effective_to_date.is_(None),
                            PriceList.effective_to_date >= today,
                        ),
                        PriceItem.item_code == slot_code,
                    )
                    .first()
                )
            if not active_price_item:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Chưa có đơn giá niêm yết hiệu lực cho loại đất mộ '{plot.type_id}'. Vui lòng liên hệ ban quản trị để cấu hình bảng giá.",
                )
            unit_price = active_price_item.unit_price

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

        if not active_res:
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
        else:
            active_res.customer_name = customer.full_name
            active_res.customer_phone = customer.phone_number
            active_res.contract_id = contract.contract_id
            active_res.expires_at = now + timedelta(days=7)
            active_res.notes = (
                f"Chuyển từ giữ chỗ tư vấn sang hợp đồng mua đất {contract.contract_code}"
            )

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
        """
        LẬP HỢP ĐỒNG CẢI TÁNG / CẤT BỐC (CÁC CHỐT CHẶN PHÁP LÝ & TÂM LINH):
        - Chốt chặn 1 [BR-KIMTINH]: Cấm tuyệt đối cải táng ô mộ Kim Tĩnh (is_kim_tinh=True hoặc is_locked=True).
          Đây là quy tắc bất di bất dịch của hệ thống.
        - Chốt chặn 2: Kiểm tra quyền sở hữu - Khách hàng lập hợp đồng phải chính là chủ sở hữu (owner_id) hiện tại của ô mộ.
        - Chốt chặn 3: Kiểm tra huyệt mộ (PlotSlot) - Huyệt chỉ định phải đang có trạng thái 'OCCUPIED'
          và người nằm trong huyệt (current_deceased_id) phải trùng khớp với hồ sơ người mất yêu cầu cải táng.
        """
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

        # Chốt chặn 1: Quy tắc Kim Tĩnh Bất Biến (Nghiêm cấm cải táng mộ Kim Tĩnh)
        if plot.is_kim_tinh or plot.is_locked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Quy tắc Kim Tĩnh Bất Biến [BR-KIMTINH]: Ô mộ xây kết cấu Kim Tĩnh đã kiên cố vĩnh viễn, nghiêm cấm lập thủ tục bóc mộ/cải táng!",
            )

        # Chốt chặn 2: Xác minh quyền sở hữu chính chủ
        if plot.owner_id != data.customer_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Khách hàng '{customer.full_name}' không phải là chủ sở hữu hiện tại của ô mộ {plot.plot_code}.",
            )

        # Chốt chặn 3: Xác minh huyệt mộ và danh tính người quá cố nằm bên trong
        slot = (
            db.query(PlotSlot)
            .filter(PlotSlot.slot_id == data.slot_id, PlotSlot.plot_id == plot.plot_id)
            .first()
        )
        if not slot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy huyệt #{data.slot_id} thuộc ô mộ {plot.plot_code}.",
            )
        if slot.status != "OCCUPIED" or slot.current_deceased_id != data.current_deceased_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Huyệt không chứa đúng người quá cố được yêu cầu cải táng!",
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
        """
        LẬP HỢP ĐỒNG CHUYỂN NHƯỢNG QUYỀN SỬ DỤNG Ô MỘ (SAN NHƯỢNG):
        - Chốt chặn 1: Bên bán (seller) và Bên mua (buyer) không được trùng nhau.
        - Chốt chặn 2: Ô mộ Kim Tĩnh đã khóa vĩnh viễn TUYỆT ĐỐI KHÔNG ĐƯỢC CHUYỂN NHƯỢNG.
        - Chốt chặn 3: Bên bán phải chính là chủ sở hữu hiện tại (plot.owner_id == seller_id).
        - Chốt chặn 4: Ô mộ phải hoàn toàn chưa sử dụng (Không có bất kỳ huyệt nào OCCUPIED).
          Nghĩa trang cấm chuyển nhượng ô mộ khi đã có thi hài người quá cố đang an táng.
        """
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

        # Chốt chặn Kim Tĩnh Bất Biến
        if plot.is_kim_tinh or plot.is_locked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Quy tắc Kim Tĩnh Bất Biến: Không thể chuyển nhượng ô mộ Kim Tĩnh đã bị khóa vĩnh viễn.",
            )

        # Chốt chặn chính chủ bên bán
        if plot.owner_id != data.seller_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Khách hàng '{seller.full_name}' không phải là chủ sở hữu hiện tại của ô mộ {plot.plot_code}.",
            )

        # Chốt chặn ô đất trống: Không cho phép chuyển nhượng ô đã có mộ/thi hài
        occupied_slot = (
            db.query(PlotSlot)
            .filter(PlotSlot.plot_id == plot.plot_id, PlotSlot.status == "OCCUPIED")
            .first()
        )
        if occupied_slot or plot.status == "OCCUPIED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể chuyển nhượng ô mộ {plot.plot_code} đang có người an táng. Toàn bộ huyệt phải để trống!",
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
        """
        LẬP HỢP ĐỒNG DỊCH VỤ HỎA TÁNG (CỔNG KIỂM SOÁT GIẤY BÁO TỬ):
        - Chốt chặn pháp lý sống còn: check_death_certificate_verified(db, deceased_id).
          Bắt buộc hồ sơ người quá cố đã được tải lên và xác minh tính pháp lý của Giấy báo tử/Trích lục khai tử
          do cơ quan có thẩm quyền cấp trước khi được ký kết dịch vụ hỏa táng.
        """
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

        # CHỐT CHẶN PHÁP LÝ: Giấy báo tử bắt buộc phải được thẩm định
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
        """
        LẬP PHỤ LỤC AN TÁNG (BURIAL ANNEX):
        - Hợp đồng gốc phải là hợp đồng Mua đất (LAND_PURCHASE) hoặc Chuyển nhượng (TRANSFER) đang ở trạng thái ACTIVE.
        - CHỐT CHẶN PHÁP LÝ: Bắt buộc Giấy chứng tử của người quá cố đã được thẩm định (Death Certificate Gate).
        - CHỐT CHẶN TRÙNG LẶP: Đảm bảo người quá cố chưa bị an táng tại bất kỳ huyệt mộ nào khác.
        - CHỐT CHẶN Ô MỘ: Ô mộ chưa bị khóa (is_locked=False). Nếu là ô Kim Tĩnh thì chưa được OCCUPIED.
        - CHỐT CHẶN HUYỆT MỘ: Huyệt chỉ định (slot_id) phải có trạng thái EMPTY và chưa có phụ lục an táng nào đang xử lý.
        """
        contract = cls.get_contract(db, contract_id)
        if contract.contract_type not in ("LAND_PURCHASE", "TRANSFER"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phụ lục an táng chỉ có thể gắn vào hợp đồng mua bán đất hoặc chuyển nhượng.",
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
        target_plot_id = None
        if contract.contract_type == "LAND_PURCHASE":
            if not contract.land_purchase:
                raise HTTPException(status_code=400, detail="Hợp đồng đất không có dữ liệu ô mộ")
            target_plot_id = contract.land_purchase.plot_id
        elif contract.contract_type == "TRANSFER":
            if not contract.transfer:
                raise HTTPException(
                    status_code=400, detail="Hợp đồng chuyển nhượng không có dữ liệu ô mộ"
                )
            target_plot_id = contract.transfer.plot_id

        plot = db.query(Plot).filter(Plot.plot_id == target_plot_id).with_for_update().first()
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
                detail=f"Không tìm thấy huyệt #{data.slot_id} thuộc ô mộ {plot.plot_code}.",
            )
        if slot.status != "EMPTY":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Huyệt #{slot.slot_number} hiện ở trạng thái '{slot.status}', không khả dụng để an táng.",
            )

        existing_slot_annex = (
            db.query(BurialAnnex)
            .join(ContractAnnex, ContractAnnex.annex_id == BurialAnnex.annex_id)
            .filter(
                BurialAnnex.slot_id == slot.slot_id,
                ContractAnnex.status.in_(["ACTIVE", "PENDING_ACTIVATION", "DRAFT"]),
            )
            .first()
        )
        if existing_slot_annex:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Huyệt #{slot.slot_number} đã được đăng ký phụ lục an táng, không thể tạo thêm.",
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

    # ==============================================================================
    # 5B. PHỤ LỤC CHĂM SÓC MỘ PHẦN (CARE ANNEX)
    # ==============================================================================
    @classmethod
    def create_care_annex(
        cls,
        db: Session,
        contract_id: int,
        data: CareAnnexCreate,
        current_user_id: int,
    ) -> ContractAnnex:
        """
        LẬP PHỤ LỤC DỊCH VỤ CHĂM SÓC MỘ PHẦN:
        - Gắn trực tiếp vào Hợp đồng mua đất hoặc Chuyển nhượng đang ACTIVE.
        - Kiểm tra gói dịch vụ chăm sóc (CarePackage) tồn tại và đang kích hoạt (is_active=True).
        - Tính toán thời hạn hiệu lực dựa vào chu kỳ (cycle_months: 1, 3, 6, 12 tháng).
        - Trạng thái ban đầu là DRAFT, chờ khách ký và kích hoạt.
        """
        contract = cls.get_contract(db, contract_id)
        if contract.contract_type not in ("LAND_PURCHASE", "TRANSFER"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phụ lục chăm sóc chỉ có thể gắn vào hợp đồng mua bán đất hoặc chuyển nhượng.",
            )
        if contract.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Hợp đồng gốc {contract.contract_code} chưa ở trạng thái ACTIVE (hiện tại: {contract.status}).",
            )

        package = db.query(CarePackage).filter(CarePackage.package_id == data.package_id).first()
        if not package or not package.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Gói dịch vụ chăm sóc không tồn tại hoặc đã ngừng hoạt động.",
            )

        now = _utc_now_naive()
        annex_code = cls.generate_annex_code(db, "PL-CS")
        rec_price = data.recurring_price if data.recurring_price is not None else package.unit_price
        add_amount = data.additional_amount or Decimal("0.00")
        v_from = data.valid_from or date.today()
        v_to = data.valid_to or (v_from + timedelta(days=data.cycle_months * 30))

        annex = ContractAnnex(
            annex_code=annex_code,
            contract_id=contract.contract_id,
            annex_type="CARE",
            status="DRAFT",
            additional_amount=add_amount,
            valid_from=v_from,
            valid_to=v_to,
            notes=data.notes,
            created_at=now,
            updated_at=now,
        )
        db.add(annex)
        db.flush()

        care = CareAnnex(
            annex_id=annex.annex_id,
            package_id=package.package_id,
            cycle_months=data.cycle_months,
            recurring_price=rec_price,
        )
        db.add(care)

        audit = AuditLog(
            user_id=current_user_id,
            action_type="CREATE_CARE_ANNEX",
            target_entity="ContractAnnex",
            target_id=str(annex.annex_id),
            post_change_values=json.dumps(
                {
                    "annex_code": annex.annex_code,
                    "contract_id": contract.contract_id,
                    "package_id": package.package_id,
                    "cycle_months": data.cycle_months,
                    "recurring_price": str(rec_price),
                    "additional_amount": str(add_amount),
                },
                ensure_ascii=False,
            ),
        )
        db.add(audit)
        db.commit()
        db.refresh(annex)
        return annex

    # ==============================================================================
    # 5C. PHỤ LỤC XÂY DỰNG & THI CÔNG LĂNG MỘ (CONSTRUCTION ANNEX)
    # ==============================================================================
    @classmethod
    def create_construction_annex(
        cls,
        db: Session,
        contract_id: int,
        data: ConstructionAnnexCreate,
        current_user_id: int,
    ) -> ContractAnnex:
        """
        LẬP PHỤ LỤC THI CÔNG XÂY DỰNG LĂNG MỘ:
        - Kiểm tra ô mộ thuộc hợp đồng gốc và đảm bảo ô mộ chưa bị khóa (plot.is_locked=False).
        - Lưu trữ danh sách các tiêu chuẩn hạng mục thi công (checklist_specifications dạng JSON)
          để phục vụ làm căn cứ nghiệm thu thực địa cho Đội thi công sau này.
        """
        contract = cls.get_contract(db, contract_id)
        if contract.contract_type not in ("LAND_PURCHASE", "TRANSFER"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phụ lục thi công chỉ có thể gắn vào hợp đồng mua bán đất hoặc chuyển nhượng.",
            )
        if contract.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Hợp đồng gốc {contract.contract_code} chưa ở trạng thái ACTIVE (hiện tại: {contract.status}).",
            )

        target_plot_id = None
        if contract.contract_type == "LAND_PURCHASE" and contract.land_purchase:
            target_plot_id = contract.land_purchase.plot_id
        elif contract.contract_type == "TRANSFER" and contract.transfer:
            target_plot_id = contract.transfer.plot_id

        if not target_plot_id:
            raise HTTPException(status_code=400, detail="Hợp đồng không liên kết với ô mộ hợp lệ.")

        plot = db.query(Plot).filter(Plot.plot_id == target_plot_id).first()
        if not plot:
            raise HTTPException(status_code=404, detail="Không tìm thấy ô mộ của hợp đồng.")

        if plot.is_locked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ô mộ đã bị khóa vĩnh viễn, không thể lập phụ lục thi công!",
            )

        now = _utc_now_naive()
        annex_code = cls.generate_annex_code(db, "PL-TC")
        add_amount = data.additional_amount or Decimal("0.00")

        annex = ContractAnnex(
            annex_code=annex_code,
            contract_id=contract.contract_id,
            annex_type="CONSTRUCTION",
            status="DRAFT",
            additional_amount=add_amount,
            valid_from=data.estimated_start_date,
            valid_to=data.estimated_end_date,
            notes=data.notes,
            created_at=now,
            updated_at=now,
        )
        db.add(annex)
        db.flush()

        construction = ConstructionAnnex(
            annex_id=annex.annex_id,
            plot_id=plot.plot_id,
            estimated_start_date=data.estimated_start_date,
            estimated_end_date=data.estimated_end_date,
            checklist_specifications=data.checklist_specifications,
        )
        db.add(construction)

        audit = AuditLog(
            user_id=current_user_id,
            action_type="CREATE_CONSTRUCTION_ANNEX",
            target_entity="ContractAnnex",
            target_id=str(annex.annex_id),
            post_change_values=json.dumps(
                {
                    "annex_code": annex.annex_code,
                    "contract_id": contract.contract_id,
                    "plot_id": plot.plot_id,
                    "estimated_start_date": data.estimated_start_date.isoformat(),
                    "estimated_end_date": data.estimated_end_date.isoformat(),
                    "additional_amount": str(add_amount),
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
        """Chuyển phụ lục từ DRAFT sang PENDING_SIGN để trình ký văn bản."""
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
        """
        KÍCH HOẠT PHÁP LÝ PHỤ LỤC GIAO DỊCH (BURIAL / CARE / CONSTRUCTION):
        - Bắt buộc kiểm tra file scan hợp đồng/phụ lục đã ký phải ở trạng thái READY (MinIO).
        - Đối với Phụ lục Chăm sóc & Thi công: Kích hoạt sang ACTIVE và tự động sinh công nợ phải thu (Receivable).
        - Đối với Phụ lục An táng:
          + Tái thẩm định Giấy chứng tử (Death Certificate Gate).
          + Khóa dòng ô mộ và huyệt mộ bằng with_for_update().
          + NGUYÊN TẮC PHÂN TÁCH PHÁP LÝ VÀ THỰC ĐỊA (FLOW-01 / R05 / BA-09 / BA-14):
            Việc kích hoạt chỉ hoàn tất về mặt pháp lý và tài chính (sinh khoản phải thu).
            Huyệt mộ vẫn giữ trạng thái tạm dành (chưa OCCUPIED) và ô mộ CHƯA bị khóa vĩnh viễn
            cho đến khi Quản trang ngoài hiện trường bấm 'Xác nhận an táng' (confirm_burial).
        """
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

        if annex.annex_type == "CARE":
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
                event_type="CARE_ANNEX_ACTIVATED",
                aggregate_type="ANNEX",
                aggregate_id=str(annex.annex_id),
                payload=json.dumps(
                    {
                        "annex_id": annex.annex_id,
                        "annex_code": annex.annex_code,
                        "contract_id": annex.contract_id,
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
                action_type="ACTIVATE_CARE_ANNEX",
                target_entity="ContractAnnex",
                target_id=str(annex.annex_id),
                post_change_values=json.dumps(
                    {"annex_code": annex.annex_code, "status": annex.status},
                    ensure_ascii=False,
                ),
            )
            db.add(audit)
            db.commit()
            db.refresh(annex)
            return annex

        elif annex.annex_type == "CONSTRUCTION":
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
                event_type="CONSTRUCTION_ANNEX_ACTIVATED",
                aggregate_type="ANNEX",
                aggregate_id=str(annex.annex_id),
                payload=json.dumps(
                    {
                        "annex_id": annex.annex_id,
                        "annex_code": annex.annex_code,
                        "contract_id": annex.contract_id,
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
                action_type="ACTIVATE_CONSTRUCTION_ANNEX",
                target_entity="ContractAnnex",
                target_id=str(annex.annex_id),
                post_change_values=json.dumps(
                    {"annex_code": annex.annex_code, "status": annex.status},
                    ensure_ascii=False,
                ),
            )
            db.add(audit)
            db.commit()
            db.refresh(annex)
            return annex

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

        if not ProfileService.check_death_certificate_verified(db, burial.deceased_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Người quá cố chưa có giấy báo tử được xác minh và đính kèm tệp chứng từ hợp lệ. Không thể kích hoạt phụ lục an táng!",
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
                detail="Huyệt an táng không còn trống.",
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

        # Legal activation vs physical execution (FLOW-01 / R05 / BA-09 / BA-14)
        # Legal activation only sets annex to ACTIVE and records receivable if any.
        # Physical occupancy of slot/plot and permanent Kim Tinh lock are strictly executed
        # via the on-site confirm_burial command by Caretaker, regardless of burial date.
        # Slot remains EMPTY in DB, reserved via this active annex until confirmed on-site.

        if annex.additional_amount > 0:
            cls._create_receivable(
                db,
                annex.contract,
                signed_date,
                now,
                annex_id=annex.annex_id,
                amount=annex.additional_amount,
            )

        is_future_burial = burial.burial_date > date.today()
        outbox_event_type = "BURIAL_ANNEX_ACTIVATED"
        outbox = OutboxEvent(
            event_id=str(uuid.uuid4()),
            event_type=outbox_event_type,
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
                    "is_future_burial": is_future_burial,
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
                    "slot_status": slot.status,
                    "is_kim_tinh": burial.is_kim_tinh,
                    "is_future_burial": is_future_burial,
                },
                ensure_ascii=False,
            ),
        )
        db.add(audit)

        db.commit()
        db.refresh(annex)
        return annex

    @classmethod
    def confirm_burial(
        cls,
        db: Session,
        annex_id: int,
        current_user_id: int,
        proof_file_id: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> ContractAnnex:
        """
        XÁC NHẬN AN TÁNG THỰC ĐỊA NGOÀI HIỆN TRƯỜNG (CARETAKER COMMAND - R05 / BA-09 / BA-14):
        - Nghiệp vụ: Sau khi lễ an táng diễn ra ngoài nghĩa trang, Quản trang hiện trường
          chụp ảnh biên bản an táng/hạ huyệt và thực hiện xác nhận trên hệ thống di động hoặc Web.
        - Chốt chặn kiểm tra:
          1. Phụ lục an táng phải ở trạng thái ACTIVE (đã ký kết và hoàn tất pháp lý).
          2. Giấy báo tử phải được xác thực hợp lệ.
          3. Ô mộ và huyệt mộ chưa bị chiếm dụng bởi người khác.
        - Chuyển đổi trạng thái thực địa:
          + Huyệt mộ: slot.status = 'OCCUPIED', current_deceased_id = deceased_id.
          + Ô mộ: plot.status = 'OCCUPIED'.
          + QUY TẮC KIM TĨNH BẤT BIẾN: Nếu phụ lục đánh dấu is_kim_tinh=True:
            Hệ thống thiết lập: plot.is_kim_tinh = True VÀ plot.is_locked = True (KHÓA VĨNH VIỄN).
          + Ghi nhận Lịch sử an táng (BurialHistory) kèm ảnh minh chứng thực địa (proof_file_id).
          + Phát sự kiện Outbox: BURIAL_COMPLETED.
        """
        annex = (
            db.query(ContractAnnex)
            .filter(ContractAnnex.annex_id == annex_id)
            .with_for_update()
            .first()
        )
        if not annex:
            raise HTTPException(status_code=404, detail="Không tìm thấy phụ lục an táng")

        if annex.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Phụ lục phải ở trạng thái ACTIVE mới có thể xác nhận an táng (hiện tại: {annex.status}).",
            )

        burial = db.query(BurialAnnex).filter(BurialAnnex.annex_id == annex.annex_id).first()
        if not burial:
            raise HTTPException(
                status_code=400, detail="Không tìm thấy thông tin chi tiết an táng của phụ lục."
            )

        plot = db.query(Plot).filter(Plot.plot_id == burial.plot_id).with_for_update().first()
        if not plot:
            raise HTTPException(status_code=404, detail="Không tìm thấy ô mộ.")

        if plot.is_locked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ô mộ đã bị khóa vĩnh viễn, không thể thao tác an táng thêm!",
            )

        if not ProfileService.check_death_certificate_verified(db, burial.deceased_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Người quá cố chưa có giấy báo tử được xác minh và đính kèm tệp chứng từ hợp lệ. Không thể xác nhận an táng thực địa!",
            )

        slot = (
            db.query(PlotSlot)
            .filter(PlotSlot.slot_id == burial.slot_id, PlotSlot.plot_id == plot.plot_id)
            .with_for_update()
            .first()
        )
        if not slot:
            raise HTTPException(status_code=404, detail="Không tìm thấy huyệt an táng.")

        if slot.status == "OCCUPIED" and slot.current_deceased_id == burial.deceased_id:
            return annex  # Đã xác nhận trước đó (Idempotent)

        now = _utc_now_naive()
        slot.status = "OCCUPIED"
        slot.current_deceased_id = burial.deceased_id
        plot.status = "OCCUPIED"

        # THỰC THI QUY TẮC BẤT BIẾN KIM TĨNH: Khóa vĩnh viễn ô mộ
        if burial.is_kim_tinh:
            plot.is_kim_tinh = True
            plot.is_locked = True

        proof_key = None
        if proof_file_id:
            p_file = db.query(FileObject).filter(FileObject.file_id == proof_file_id).first()
            if p_file and p_file.state == "READY":
                proof_key = p_file.object_key

        history = BurialHistory(
            plot_id=plot.plot_id,
            slot_id=slot.slot_id,
            deceased_id=burial.deceased_id,
            action_type="BURIED",
            action_date=now,
            proof_url=proof_key or annex.signed_scan_url,
            proof_file_id=proof_file_id or annex.signed_scan_file_id,
            performed_by=current_user_id,
            notes=notes or f"Xác nhận an táng thực địa theo phụ lục {annex.annex_code}",
            created_at=now,
        )
        db.add(history)

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
                    "confirmed_at": now.isoformat(),
                    "confirmed_by": current_user_id,
                },
                ensure_ascii=False,
            ),
            state="PENDING",
            created_at=now,
        )
        db.add(outbox)

        audit = AuditLog(
            user_id=current_user_id,
            action_type="CONFIRM_BURIAL",
            target_entity="ContractAnnex",
            target_id=str(annex.annex_id),
            post_change_values=json.dumps(
                {
                    "annex_code": annex.annex_code,
                    "slot_status": "OCCUPIED",
                    "plot_status": "OCCUPIED",
                    "is_kim_tinh": burial.is_kim_tinh,
                },
                ensure_ascii=False,
            ),
        )
        db.add(audit)

        db.commit()
        db.refresh(annex)
        return annex

    @classmethod
    def get_work_bases(cls, db: Session, status_filter: Optional[str] = None) -> List[dict]:
        """
        TRUY VẤN DANH SÁCH CĂN CỨ CÔNG VIỆC HIỆN TRƯỜNG (WORK BASES - EX-01):
        - Dành riêng cho Đội ngũ Quản trang ngoài nghĩa trang (Caretakers / Field Supervisors).
        - Tập hợp toàn bộ các căn cứ pháp lý phụ lục đang có hiệu lực (ACTIVE / PENDING_ACTIVATION)
          để làm cơ sở triển khai 3 nhóm nghiệp vụ thực tế:
          1. Phụ lục An táng: Ngày giờ hạ huyệt, người mất, vị trí ô/lô để chuẩn bị huyệt mộ.
          2. Phụ lục Chăm sóc: Gói dịch vụ định kỳ để lên ca làm việc dọn dẹp, thắp hương.
          3. Phụ lục Thi công: Tiêu chuẩn xây dựng lăng mộ để mở lệnh giám sát và nghiệm thu.
        """
        from app.modules.contracts.models import CareAnnex, ConstructionAnnex

        query = (
            db.query(ContractAnnex)
            .options(
                joinedload(ContractAnnex.contract).joinedload(Contract.customer),
                joinedload(ContractAnnex.contract).joinedload(Contract.land_purchase).joinedload(LandPurchaseContract.plot),
                joinedload(ContractAnnex.contract).joinedload(Contract.transfer).joinedload(TransferContract.plot),
                joinedload(ContractAnnex.burial).joinedload(BurialAnnex.plot),
                joinedload(ContractAnnex.burial).joinedload(BurialAnnex.slot),
                joinedload(ContractAnnex.burial).joinedload(BurialAnnex.deceased),
                joinedload(ContractAnnex.care).joinedload(CareAnnex.package),
                joinedload(ContractAnnex.construction).joinedload(ConstructionAnnex.plot),
            )
        )
        if status_filter:
            query = query.filter(ContractAnnex.status == status_filter)
        else:
            query = query.filter(ContractAnnex.status.in_(["ACTIVE", "PENDING_ACTIVATION"]))

        annexes = query.order_by(ContractAnnex.created_at.desc()).all()
        results = []
        for a in annexes:
            plot_id = None
            plot_code = None
            zone_code = None
            slot_number = None
            deceased_id = None
            deceased_name = None
            burial_date = None
            is_burial_confirmed = False
            service_summary = None

            # Fallback contract plot
            contract_plot = None
            if a.contract:
                if a.contract.land_purchase and a.contract.land_purchase.plot:
                    contract_plot = a.contract.land_purchase.plot
                elif a.contract.transfer and a.contract.transfer.plot:
                    contract_plot = a.contract.transfer.plot

            if a.annex_type == "BURIAL" and a.burial:
                b = a.burial
                plot_id = b.plot_id
                if b.plot:
                    plot_code = b.plot.plot_code
                    if b.plot.row and b.plot.row.zone:
                        zone_code = b.plot.row.zone.zone_code
                if b.slot:
                    slot_number = b.slot.slot_number
                    if b.slot.status == "OCCUPIED" and b.slot.current_deceased_id == b.deceased_id:
                        is_burial_confirmed = True
                deceased_id = b.deceased_id
                if b.deceased:
                    deceased_name = b.deceased.full_name
                burial_date = b.burial_date
                service_summary = f"An táng huyệt số {slot_number or ''} ({'Kim Tĩnh' if b.is_kim_tinh else 'Thường'})"
            elif a.annex_type == "CARE" and a.care:
                c = a.care
                if contract_plot:
                    plot_id = contract_plot.plot_id
                    plot_code = contract_plot.plot_code
                    if contract_plot.row and contract_plot.row.zone:
                        zone_code = contract_plot.row.zone.zone_code
                pkg_name = c.package.package_name if c.package else ""
                service_summary = f"Gói chăm sóc: {pkg_name}"
            elif a.annex_type == "CONSTRUCTION" and a.construction:
                cs = a.construction
                plot_id = cs.plot_id
                if cs.plot:
                    plot_code = cs.plot.plot_code
                    if cs.plot.row and cs.plot.row.zone:
                        zone_code = cs.plot.row.zone.zone_code
                service_summary = "Xây dựng mộ"

            results.append({
                "annex_id": a.annex_id,
                "annex_code": a.annex_code,
                "annex_type": a.annex_type,
                "contract_id": a.contract_id,
                "contract_code": a.contract.contract_code if a.contract else "",
                "customer_name": a.contract.customer.full_name if (a.contract and a.contract.customer) else None,
                "status": a.status,
                "signed_at": a.signed_at,
                "target_date": a.construction.estimated_start_date if a.construction else a.valid_from,
                "due_date": a.construction.estimated_end_date if a.construction else a.valid_to,
                "plot_id": plot_id,
                "plot_code": plot_code,
                "zone_code": zone_code,
                "slot_number": slot_number,
                "deceased_id": deceased_id,
                "deceased_name": deceased_name,
                "service_summary": service_summary,
                "is_burial_confirmed": is_burial_confirmed,
                "burial_date": burial_date,
                "checklist_specifications": a.construction.checklist_specifications if a.construction else None,
            })
        return results

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

        # Batch load all target plots to eliminate N+1 queries
        target_plot_ids = set()
        for c in results:
            if c.land_purchase and c.land_purchase.plot_id:
                target_plot_ids.add(c.land_purchase.plot_id)
            elif c.exhumation and c.exhumation.plot_id:
                target_plot_ids.add(c.exhumation.plot_id)
            elif c.transfer and c.transfer.plot_id:
                target_plot_ids.add(c.transfer.plot_id)

        plot_map = {}
        if target_plot_ids:
            plots = (
                db.query(Plot)
                .options(joinedload(Plot.row).joinedload(Row.zone))
                .filter(Plot.plot_id.in_(target_plot_ids))
                .all()
            )
            plot_map = {p.plot_id: p for p in plots}

        briefs: List[ContractBriefResponse] = []
        for c in results:
            plot_id_target: Optional[int] = None
            if c.land_purchase:
                plot_id_target = c.land_purchase.plot_id
            elif c.exhumation:
                plot_id_target = c.exhumation.plot_id
            elif c.transfer:
                plot_id_target = c.transfer.plot_id

            plot_obj = plot_map.get(plot_id_target) if plot_id_target else None

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
        """
        KÍCH HOẠT HỢP ĐỒNG ĐÃ KÝ (ACID DISPATCH THEO 4 LOẠI HỢP ĐỒNG):
        - Kiểm tra tính bất biến trạng thái: Hợp đồng phải ở DRAFT hoặc PENDING_SIGN.
        - Kiểm tra file scan văn bản đã ký: Bắt buộc tồn tại trên MinIO ở trạng thái READY.
        - Chuyển trạng thái sang 'ACTIVE', ghi nhận người kích hoạt và thời điểm ký.
        - Điều phối xử lý nghiệp vụ chuyên biệt theo loại hợp đồng:
          + LAND_PURCHASE: Đổi trạng thái ô mộ sang OWNED_EMPTY, ghi nhận quyền sở hữu (PlotOwnership),
            chuyển trạng thái lệnh giữ chỗ sang CONVERTED, và sinh khoản phải thu (Receivable).
          + EXHUMATION: Giải phóng huyệt mộ (PlotSlot status='EMPTY', deceased_id=None),
            ghi nhận Lịch sử cất bốc (BurialHistory action_type='EXHUMED'), cập nhật lại trạng thái ô mộ.
          + TRANSFER: Đóng thời hạn sở hữu của chủ cũ (valid_to=now), tạo bản ghi sở hữu mới cho bên mua,
            cập nhật owner_id trên ô mộ.
          + CREMATION: Kích hoạt dịch vụ hỏa táng và sinh khoản phải thu.
        - Tự động sinh sự kiện Outbox (OutboxEvent) để phục vụ kiến trúc đồng bộ bất đồng bộ.
        """
        contract = (
            db.query(Contract).filter(Contract.contract_id == contract_id).with_for_update().first()
        )
        if not contract:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy hợp đồng với ID {contract_id}",
            )

        # Đảm bảo tính Idempotent: Nếu đã kích hoạt rồi thì trả về nguyên bản
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

        # Điều phối xử lý nghiệp vụ theo loại hợp đồng (ACID Transaction)
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
        """Kích hoạt hợp đồng mua đất: Chuyển quyền sở hữu, cập nhật trạng thái ô sang OWNED_EMPTY và sinh công nợ."""
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
        """Kích hoạt hợp đồng cải táng: Giải phóng huyệt mộ về EMPTY và ghi nhận lịch sử BurialHistory."""
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

        # Chốt chặn Kim Tĩnh Bất Biến
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
        """Kích hoạt hợp đồng chuyển nhượng: Đóng quyền sở hữu của bên bán, chuyển quyền sở hữu cho bên mua."""
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

        # Đóng thời hạn sở hữu của chủ sở hữu trước đó
        prior_ownership = (
            db.query(PlotOwnership)
            .filter(PlotOwnership.plot_id == plot.plot_id, PlotOwnership.valid_to.is_(None))
            .first()
        )
        if prior_ownership:
            prior_ownership.valid_to = now

        # Khởi tạo bản ghi sở hữu mới cho người mua
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
        """Kích hoạt hợp đồng hỏa táng: Sinh khoản phải thu và phát sinh sự kiện Outbox."""
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
        """
        TỰ ĐỘNG SINH KHOẢN PHẢI THU (RECEIVABLE - QUY TẮC BẤT BIẾN TÀI CHÍNH XOR):
        - Ràng buộc toàn vẹn XOR: Khoản phải thu chỉ được thuộc về Hợp đồng (contract_id) HOẶC Phụ lục (annex_id).
          Không được phép đồng thời có cả hai hoặc thiếu cả hai.
        - Idempotency: Kiểm tra nếu đã sinh khoản phải thu cho Hợp đồng hoặc Phụ lục này thì không sinh thêm.
        - Hạn thanh toán mặc định: 30 ngày kể từ ngày ký (due_date = signed_date + 30 days).
        - Trạng thái ban đầu: 'UNPAID', total_paid_amount = 0.
        """
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
    def get_contract_detail_dto(
        cls, db: Session, contract_id: int, current_user: Optional[User] = None
    ) -> ContractDetailResponse:
        contract = cls.get_contract(db, contract_id)

        user_roles = (
            [r.role_name.upper() for r in (current_user.roles or [])] if current_user else []
        )
        is_admin = "ADMIN" in user_roles
        is_caretaker = "CARETAKER" in user_roles and not is_admin

        customer_brief = None
        if contract.customer:
            cid = contract.customer.citizen_id
            addr = contract.customer.address
            if is_caretaker:
                cid = "******"
                addr = None
            customer_brief = CustomerBrief(
                customer_id=contract.customer.customer_id,
                customer_code=contract.customer.customer_code,
                full_name=contract.customer.full_name,
                citizen_id=cid,
                phone_number=contract.customer.phone_number,
                address=addr,
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
                land_unit_price=Decimal("0.00")
                if is_caretaker
                else contract.land_purchase.land_unit_price,
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
                exhumation_fee=Decimal("0.00")
                if is_caretaker
                else contract.exhumation.exhumation_fee,
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
                commission_fee=Decimal("0.00")
                if is_caretaker
                else contract.transfer.commission_fee,
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
                service_fee=Decimal("0.00") if is_caretaker else contract.cremation.service_fee,
            )

        receivable_brief = None
        if not is_caretaker:
            rec = (
                db.query(Receivable)
                .filter(
                    Receivable.contract_id == contract.contract_id, Receivable.annex_id.is_(None)
                )
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

            care_dto = None
            if a.care:
                pkg = a.care.package or db.query(CarePackage).filter(CarePackage.package_id == a.care.package_id).first()
                care_dto = CareAnnexDetailBrief(
                    package_id=a.care.package_id,
                    package_name=pkg.package_name if pkg else None,
                    package_code=pkg.package_code if pkg else None,
                    cycle_months=a.care.cycle_months,
                    recurring_price=Decimal("0.00") if is_caretaker else a.care.recurring_price,
                )

            construction_dto = None
            if a.construction:
                c_plot = a.construction.plot or db.query(Plot).filter(Plot.plot_id == a.construction.plot_id).first()
                construction_dto = ConstructionAnnexDetailBrief(
                    plot_id=a.construction.plot_id,
                    plot_code=c_plot.plot_code if c_plot else None,
                    estimated_start_date=a.construction.estimated_start_date,
                    estimated_end_date=a.construction.estimated_end_date,
                    checklist_specifications=a.construction.checklist_specifications,
                )

            annexes_dto.append(
                ContractAnnexResponse(
                    annex_id=a.annex_id,
                    annex_code=a.annex_code,
                    contract_id=a.contract_id,
                    annex_type=a.annex_type,
                    status=a.status,
                    additional_amount=Decimal("0.00") if is_caretaker else a.additional_amount,
                    signed_scan_file_id=None if is_caretaker else a.signed_scan_file_id,
                    signed_scan_url=None if is_caretaker else a.signed_scan_url,
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
                    care=care_dto,
                    construction=construction_dto,
                )
            )

        return ContractDetailResponse(
            contract_id=contract.contract_id,
            contract_code=contract.contract_code,
            contract_type=contract.contract_type,
            status=contract.status,
            total_amount=Decimal("0.00") if is_caretaker else contract.total_amount,
            signed_at=contract.signed_at,
            activated_at=contract.activated_at,
            activated_by=contract.activated_by,
            activator_name=activator_name,
            activation_notes=contract.activation_notes,
            template_id=contract.template_id,
            template_version=contract.template_version,
            signed_scan_file_id=None if is_caretaker else contract.signed_scan_file_id,
            signed_scan_url=None if is_caretaker else contract.signed_scan_url,
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
