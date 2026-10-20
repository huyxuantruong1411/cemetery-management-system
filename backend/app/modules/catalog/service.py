from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.modules.care.models import CareAnnex, CarePackage, CareSchedule
from app.modules.catalog.models import PriceItem, PriceList
from app.modules.catalog.schemas import (
    CarePackageCreate,
    CarePackageUpdate,
    ContractTemplateCreate,
    ContractTemplateUpdate,
    PriceItemCreate,
    PriceItemUpdate,
    PriceListCloneRequest,
    PriceListCloseRequest,
    PriceListCreate,
    PriceListUpdate,
    PriceLookupRequest,
    PriceLookupResponse,
)
from app.modules.contracts.models import ContractTemplate


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# =============================================================================
# MODULE QUẢN TRỊ DANH MỤC, BẢNG GIÁ & BIỂU MẪU (CATALOG SERVICE)
# =============================================================================
# Module này quản trị các dữ liệu cấu hình danh mục dùng chung của toàn hệ thống:
# 1. Bảng giá & Khoản mục giá (Price Lists & Price Items - G03):
#    - Quản lý giá đất theo khu vực, loại mộ, đơn giá dịch vụ hỏa táng, cải táng, xây dựng.
#    - Kiểm tra chống chồng lấn thời gian (check_price_list_overlap): Đảm bảo tại một thời điểm
#      chỉ có duy nhất một bảng giá có hiệu lực, không gây mập mờ tài chính.
# 2. Động cơ tra cứu giá (Price Lookup Engine - G03):
#    - Tra cứu giá thông minh theo thứ tự ưu tiên (Scope Hierarchy):
#      Gói chăm sóc -> (Khu vực + Loại mộ) -> Loại mộ chung -> Mã dịch vụ.
# 3. Gói chăm sóc mộ định kỳ (Care Packages):
#    - Định nghĩa các gói tiêu chuẩn/cao cấp kèm danh sách checklist công việc chuẩn.
#    - Bất biến: Khi gói đã bị vô hiệu hóa (is_active=False), cấm ký hợp đồng mới.
# 4. Mẫu hợp đồng & Quản lý phiên bản không hồi tố (Contract Templates - G03):
#    - Quản lý 4 mẫu hợp đồng chuẩn tương ứng với 4 loại hợp đồng của hệ thống.
#    - Versioning không hồi tố (bump_template_version): Khi sửa nội dung mẫu, version tự tăng,
#      các hợp đồng cũ đã ký giữ nguyên nội dung tại thời điểm ký kết theo đúng pháp lý.
# =============================================================================


class CatalogService:
    # =========================================================================
    # QUẢN TRỊ BẢNG GIÁ & CHỐNG CHỒNG LẤN THỜI GIAN (G03)
    # =========================================================================

    @staticmethod
    def check_price_list_overlap(
        db: Session,
        from_date: date,
        to_date: Optional[date],
        exclude_id: Optional[int] = None,
    ) -> None:
        """
        [CHỐNG CHỒNG CHÉO BẢNG GIÁ HIỆU LỰC - G03 INVARIANT]
        
        Thuật toán kiểm tra giao nhau giữa 2 khoảng thời gian [A, B] và [C, D]:
        - Khoảng A: [from_date, to_date] (bảng giá mới hoặc đang chỉnh sửa).
        - Khoảng B: [effective_from_date, effective_to_date] (bảng giá active đã tồn tại).
        - Điều kiện giao nhau: (start_a <= end_b hoặc end_b is None) VÀ (end_a >= start_b hoặc end_a is None).
        - Nếu có bất kỳ sự giao thoa nào -> Ném HTTP 400 Bad Request ngăn chặn ngay lập tức.
        """
        query = db.query(PriceList).filter(PriceList.is_active == True)  # noqa: E712
        if exclude_id is not None:
            query = query.filter(PriceList.price_list_id != exclude_id)

        existing_lists = query.all()
        for pl in existing_lists:
            start_a, end_a = from_date, to_date
            start_b, end_b = pl.effective_from_date, pl.effective_to_date

            a_before_b_end = (end_b is None) or (start_a <= end_b)
            a_end_after_b = (end_a is None) or (end_a >= start_b)

            if a_before_b_end and a_end_after_b:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Thời gian hiệu lực trùng lặp với bảng giá đang kích hoạt: '{pl.price_list_name}' "
                        f"({pl.effective_from_date} đến {pl.effective_to_date or 'Vô thời hạn'})"
                    ),
                )

    @staticmethod
    def list_price_lists(db: Session, active_only: bool = False) -> List[PriceList]:
        """Lấy danh sách các bảng giá (sắp xếp theo ngày hiệu lực mới nhất)."""
        query = db.query(PriceList).order_by(PriceList.effective_from_date.desc())
        if active_only:
            query = query.filter(PriceList.is_active == True)  # noqa: E712
        return query.all()

    @staticmethod
    def get_price_list(db: Session, price_list_id: int) -> PriceList:
        """Lấy chi tiết một bảng giá theo ID."""
        pl = db.query(PriceList).filter(PriceList.price_list_id == price_list_id).first()
        if not pl:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy bảng giá với ID {price_list_id}",
            )
        return pl

    @staticmethod
    def create_price_list(db: Session, data: PriceListCreate) -> PriceList:
        """
        Tạo bảng giá mới.
        - Nếu auto_close_previous=True: Tự động đóng các bảng giá đang có hiệu lực mở
          (vô thời hạn hoặc có ngày kết thúc >= ngày bắt đầu của bảng giá mới) về ngày liền kề trước đó.
        - Nếu bảng giá được đánh dấu kích hoạt (is_active=True), bắt buộc chạy kiểm tra
          chống chồng chéo thời gian hiệu lực (check_price_list_overlap).
        """
        if data.is_active and data.auto_close_previous:
            cutoff_date = data.effective_from_date - timedelta(days=1)
            active_lists = db.query(PriceList).filter(PriceList.is_active == True).all()  # noqa: E712
            for pl in active_lists:
                if pl.effective_to_date is None or pl.effective_to_date >= data.effective_from_date:
                    if pl.effective_from_date <= cutoff_date:
                        pl.effective_to_date = cutoff_date
                    else:
                        pl.is_active = False
            db.flush()

        if data.is_active:
            CatalogService.check_price_list_overlap(
                db, data.effective_from_date, data.effective_to_date
            )

        pl = PriceList(
            price_list_name=data.price_list_name,
            effective_from_date=data.effective_from_date,
            effective_to_date=data.effective_to_date,
            is_active=data.is_active,
            created_at=_utc_now_naive(),
        )
        db.add(pl)
        db.commit()
        db.refresh(pl)
        return pl

    @staticmethod
    def close_price_list(db: Session, price_list_id: int, req: PriceListCloseRequest) -> PriceList:
        """
        Đóng / Giới hạn thời gian hiệu lực của bảng giá mở (vô thời hạn).
        Thiết lập ngày kết thúc hiệu lực cụ thể (mặc định hôm nay).
        """
        pl = CatalogService.get_price_list(db, price_list_id)
        target_date = req.close_date or date.today()
        if target_date < pl.effective_from_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ngày kết thúc ({target_date}) không được nhỏ hơn ngày bắt đầu ({pl.effective_from_date})",
            )
        pl.effective_to_date = target_date
        if req.deactivate:
            pl.is_active = False
        db.commit()
        db.refresh(pl)
        return pl

    @staticmethod
    def clone_price_list(db: Session, price_list_id: int, req: PriceListCloneRequest) -> PriceList:
        """
        Sao chép toàn bộ bảng giá và các khoản mục định giá con sang một bảng giá mới.
        Tiện ích chuyên nghiệp giúp nhân viên nhanh chóng tạo bảng giá chu kỳ mới mà không cần gõ lại hàng chục khoản mục.
        """
        source_pl = CatalogService.get_price_list(db, price_list_id)
        create_data = PriceListCreate(
            price_list_name=req.new_price_list_name,
            effective_from_date=req.effective_from_date,
            effective_to_date=req.effective_to_date,
            is_active=req.is_active,
            auto_close_previous=req.auto_close_previous,
        )
        new_pl = CatalogService.create_price_list(db, create_data)

        # Sao chép toàn bộ PriceItem sang bảng giá mới
        for item in source_pl.items:
            cloned_item = PriceItem(
                price_list_id=new_pl.price_list_id,
                item_code=item.item_code,
                item_name=item.item_name,
                unit_price=item.unit_price,
                unit=item.unit,
                zone_id=item.zone_id,
                plot_type_id=item.plot_type_id,
                package_id=item.package_id,
                service_code=item.service_code,
            )
            db.add(cloned_item)

        db.commit()
        db.refresh(new_pl)
        return new_pl

    @staticmethod
    def delete_price_list(db: Session, price_list_id: int) -> None:
        """
        Xóa bảng giá và toàn bộ khoản mục giá con.
        """
        pl = CatalogService.get_price_list(db, price_list_id)
        db.query(PriceItem).filter(PriceItem.price_list_id == price_list_id).delete()
        db.delete(pl)
        db.commit()

    @staticmethod
    def update_price_list(db: Session, price_list_id: int, data: PriceListUpdate) -> PriceList:
        """
        Cập nhật thông tin bảng giá.
        - Kiểm tra tính logic ngày tháng: Ngày kết thúc không thể trước ngày bắt đầu.
        - Nếu bảng giá được kích hoạt, kiểm tra chống trùng lặp thời gian với các bảng giá khác
          (loại trừ chính bảng giá đang sửa via exclude_id).
        """
        pl = CatalogService.get_price_list(db, price_list_id)

        new_from = (
            data.effective_from_date
            if data.effective_from_date is not None
            else pl.effective_from_date
        )
        new_to = (
            data.effective_to_date if data.effective_to_date is not None else pl.effective_to_date
        )
        new_active = data.is_active if data.is_active is not None else pl.is_active

        if new_to and new_to < new_from:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ngày kết thúc hiệu lực không được nhỏ hơn ngày bắt đầu",
            )

        if new_active:
            CatalogService.check_price_list_overlap(db, new_from, new_to, exclude_id=price_list_id)

        if data.price_list_name is not None:
            pl.price_list_name = data.price_list_name
        if data.effective_from_date is not None:
            pl.effective_from_date = data.effective_from_date
        if data.effective_to_date is not None:
            pl.effective_to_date = data.effective_to_date
        if data.is_active is not None:
            pl.is_active = data.is_active

        db.commit()
        db.refresh(pl)
        return pl

    # =========================================================================
    # KHOẢN MỤC GIÁ (PRICE ITEMS MANAGEMENT)
    # =========================================================================

    @staticmethod
    def add_price_item(db: Session, data: PriceItemCreate) -> PriceItem:
        """
        Thêm một khoản mục giá vào bảng giá.
        - Kiểm tra bảng giá cha có tồn tại không.
        - Kiểm tra tính duy nhất của mã khoản mục (item_code) trong cùng một bảng giá.
        """
        # Xác minh bảng giá cha tồn tại
        _ = CatalogService.get_price_list(db, data.price_list_id)

        # Chặn trùng lặp mã khoản mục trong cùng một bảng giá
        existing = (
            db.query(PriceItem)
            .filter(
                PriceItem.price_list_id == data.price_list_id,
                PriceItem.item_code == data.item_code,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mã khoản mục '{data.item_code}' đã tồn tại trong bảng giá này",
            )

        item = PriceItem(
            price_list_id=data.price_list_id,
            item_code=data.item_code,
            item_name=data.item_name,
            unit_price=Decimal(str(data.unit_price)),
            unit=data.unit,
            zone_id=data.zone_id,
            plot_type_id=data.plot_type_id,
            package_id=data.package_id,
            service_code=data.service_code,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def update_price_item(db: Session, item_id: int, data: PriceItemUpdate) -> PriceItem:
        """Cập nhật thông tin khoản mục giá (tên, đơn giá Decimal, đơn vị tính, phạm vi áp dụng)."""
        item = db.query(PriceItem).filter(PriceItem.item_id == item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy khoản mục giá với ID {item_id}",
            )

        if data.item_name is not None:
            item.item_name = data.item_name
        if data.unit_price is not None:
            item.unit_price = Decimal(str(data.unit_price))
        if data.unit is not None:
            item.unit = data.unit
        if data.zone_id is not None:
            item.zone_id = data.zone_id
        if data.plot_type_id is not None:
            item.plot_type_id = data.plot_type_id
        if data.package_id is not None:
            item.package_id = data.package_id
        if data.service_code is not None:
            item.service_code = data.service_code

        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def delete_price_item(db: Session, item_id: int) -> None:
        """Xóa khoản mục giá khỏi bảng giá."""
        item = db.query(PriceItem).filter(PriceItem.item_id == item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy khoản mục giá với ID {item_id}",
            )
        db.delete(item)
        db.commit()

    # =========================================================================
    # ĐỘNG CƠ TRA CỨU GIÁ THEO THỨ BẬC ƯU TIÊN (PRICE LOOKUP ENGINE - G03)
    # =========================================================================

    @staticmethod
    def lookup_price(db: Session, req: PriceLookupRequest) -> PriceLookupResponse:
        """
        [ĐỘNG CƠ GIẢI QUYẾT ĐƠN GIÁ THEO THỜI GIAN & PHẠM VI (SCOPE HIERARCHY) - G03]
        
        Quy trình xử lý:
        1. Xác định ngày hiệu lực cần tra cứu (mặc định là ngày hôm nay nếu không truyền).
        2. Tìm bảng giá đang kích hoạt (is_active=True) có thời gian hiệu lực bao trùm ngày này.
        3. Áp dụng thuật toán phân giải thứ bậc phạm vi áp dụng (từ cụ thể nhất đến tổng quát nhất):
           - Ưu tiên 1 (Cụ thể nhất): Khớp theo gói chăm sóc (package_id).
           - Ưu tiên 2: Khớp theo cặp cụ thể (zone_id + plot_type_id) - Giá mộ đơn khu VIP.
           - Ưu tiên 3: Khớp theo loại mộ chung (plot_type_id) không chỉ định khu vực (zone_id is None).
           - Ưu tiên 4: Khớp theo mã dịch vụ chung (service_code: HỎA TÁNG, CẢI TÁNG, XÂY DỰNG).
        4. Trả về kết quả khớp giá chính xác hoặc cờ matched=False nếu chưa định giá.
        """
        target_date = req.target_date or date.today()

        # 1. Tìm bảng giá đang kích hoạt có hiệu lực vào ngày target_date
        active_list = (
            db.query(PriceList)
            .filter(
                PriceList.is_active == True,  # noqa: E712
                PriceList.effective_from_date <= target_date,
                or_(
                    PriceList.effective_to_date.is_(None),
                    PriceList.effective_to_date >= target_date,
                ),
            )
            .order_by(PriceList.effective_from_date.desc())
            .first()
        )

        if not active_list:
            return PriceLookupResponse(matched=False)

        # 2. Tìm kiếm khoản mục khớp nhất theo thứ tự ưu tiên scope
        items_query = db.query(PriceItem).filter(
            PriceItem.price_list_id == active_list.price_list_id
        )

        matched_item: Optional[PriceItem] = None

        # Ưu tiên 1: Gói dịch vụ chăm sóc định kỳ
        if req.package_id:
            matched_item = items_query.filter(PriceItem.package_id == req.package_id).first()

        # Ưu tiên 2: Khu vực cụ thể + Loại mộ cụ thể
        if not matched_item and req.zone_id and req.plot_type_id:
            matched_item = items_query.filter(
                PriceItem.zone_id == req.zone_id,
                PriceItem.plot_type_id == req.plot_type_id,
            ).first()

        # Ưu tiên 3: Loại mộ chung (áp dụng cho mọi khu)
        if not matched_item and req.plot_type_id:
            matched_item = items_query.filter(
                PriceItem.plot_type_id == req.plot_type_id,
                PriceItem.zone_id.is_(None),
            ).first()

        # Ưu tiên 4: Mã dịch vụ chung
        if not matched_item and req.service_code:
            matched_item = items_query.filter(PriceItem.service_code == req.service_code).first()

        if not matched_item:
            return PriceLookupResponse(
                matched=False,
                price_list_id=active_list.price_list_id,
                price_list_name=active_list.price_list_name,
                effective_from=active_list.effective_from_date,
                effective_to=active_list.effective_to_date,
            )

        return PriceLookupResponse(
            matched=True,
            price_list_id=active_list.price_list_id,
            price_list_name=active_list.price_list_name,
            item_id=matched_item.item_id,
            item_code=matched_item.item_code,
            item_name=matched_item.item_name,
            unit_price=matched_item.unit_price,
            unit=matched_item.unit,
            effective_from=active_list.effective_from_date,
            effective_to=active_list.effective_to_date,
        )

    # =========================================================================
    # QUẢN LÝ GÓI DỊCH VỤ CHĂM SÓC MỘ PHẦN (CARE PACKAGES)
    # =========================================================================

    @staticmethod
    def list_care_packages(db: Session, active_only: bool = False) -> List[CarePackage]:
        """Danh sách các gói dịch vụ chăm sóc mộ (Tiêu chuẩn, Nâng cao, Đặc biệt)."""
        query = db.query(CarePackage).order_by(CarePackage.package_code.asc())
        if active_only:
            query = query.filter(CarePackage.is_active == True)  # noqa: E712
        return query.all()

    @staticmethod
    def get_care_package(db: Session, package_id: int, ensure_active: bool = False) -> CarePackage:
        """
        Lấy thông tin gói dịch vụ chăm sóc kèm kiểm tra tính khả dụng.
        
        Quy tắc bất biến:
        - Nếu ensure_active=True và gói đang bị vô hiệu hóa (is_active=False),
          hệ thống lập tức ném lỗi 400 Bad Request, ngăn chặn việc nhân viên tư vấn
          bán gói dịch vụ đã ngừng hoạt động cho khách hàng.
        """
        pkg = db.query(CarePackage).filter(CarePackage.package_id == package_id).first()
        if not pkg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy gói chăm sóc với ID {package_id}",
            )
        if ensure_active and not pkg.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Gói chăm sóc '{pkg.package_name}' ({pkg.package_code}) đã ngừng hoạt động, không thể áp dụng cho hợp đồng mới.",
            )
        return pkg

    @staticmethod
    def create_care_package(db: Session, data: CarePackageCreate) -> CarePackage:
        """Tạo gói dịch vụ chăm sóc mộ mới (đảm bảo package_code không trùng lặp)."""
        existing = (
            db.query(CarePackage).filter(CarePackage.package_code == data.package_code).first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mã gói chăm sóc '{data.package_code}' đã tồn tại",
            )

        pkg = CarePackage(
            package_code=data.package_code,
            package_name=data.package_name,
            cycle_type=data.cycle_type,
            default_tasks_json=data.default_tasks_json,
            unit_price=Decimal(str(data.unit_price)),
            is_active=data.is_active,
        )
        db.add(pkg)
        db.commit()
        db.refresh(pkg)
        return pkg

    @staticmethod
    def update_care_package(db: Session, package_id: int, data: CarePackageUpdate) -> CarePackage:
        """Cập nhật gói chăm sóc (chu kỳ, danh sách công việc chuẩn dạng JSON, giá Decimal)."""
        pkg = CatalogService.get_care_package(db, package_id)

        if data.package_name is not None:
            pkg.package_name = data.package_name
        if data.cycle_type is not None:
            pkg.cycle_type = data.cycle_type
        if data.default_tasks_json is not None:
            pkg.default_tasks_json = data.default_tasks_json
        if data.unit_price is not None:
            pkg.unit_price = Decimal(str(data.unit_price))
        if data.is_active is not None:
            pkg.is_active = data.is_active

        db.commit()
        db.refresh(pkg)
        return pkg

    @staticmethod
    def delete_care_package(db: Session, package_id: int) -> None:
        """
        Xóa gói chăm sóc mộ định kỳ.
        Ràng buộc toàn vẹn:
        - Nếu gói đã được sử dụng trong các phụ lục chăm sóc (CareAnnex) của khách hàng: Chặn xóa,
          yêu cầu chuyển sang trạng thái 'Ngừng Áp Dụng' (is_active=False) để bảo toàn lịch sử và pháp lý.
        - Nếu gói có lịch chăm sóc (CareSchedule) đang gắn kết: Chặn xóa.
        - Nếu chưa liên kết thực tế: Cho phép xóa hoàn toàn khỏi hệ thống.
        """
        pkg = CatalogService.get_care_package(db, package_id)
        annex_count = db.query(CareAnnex).filter(CareAnnex.package_id == package_id).count()
        if annex_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Không thể xóa gói chăm sóc '{pkg.package_name}' ({pkg.package_code}) vì đang được liên kết "
                    f"với {annex_count} phụ lục chăm sóc trong hợp đồng khách hàng. "
                    f"Bạn có thể chọn 'Ngừng Kích Hoạt' để ngừng cung cấp gói này cho các hợp đồng mới."
                ),
            )

        schedule_count = db.query(CareSchedule).filter(CareSchedule.package_id == package_id).count()
        if schedule_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể xóa gói chăm sóc '{pkg.package_name}' vì có {schedule_count} lịch chăm sóc đang liên kết.",
            )

        # Xóa các định giá liên kết trong bảng giá nếu có
        db.query(PriceItem).filter(PriceItem.package_id == package_id).delete()
        db.delete(pkg)
        db.commit()

    # =========================================================================
    # MẪU HỢP ĐỒNG & QUẢN LÝ PHIÊN BẢN KHÔNG HỒI TỐ (VERSIONING - G03)
    # =========================================================================

    @staticmethod
    def list_contract_templates(db: Session, active_only: bool = False) -> List[ContractTemplate]:
        """Danh sách các mẫu hợp đồng chuẩn theo từng loại hợp đồng."""
        query = db.query(ContractTemplate).order_by(
            ContractTemplate.contract_type.asc(), ContractTemplate.template_code.asc()
        )
        if active_only:
            query = query.filter(ContractTemplate.is_active == True)  # noqa: E712
        return query.all()

    @staticmethod
    def get_contract_template(
        db: Session, template_id: int, ensure_active: bool = False
    ) -> ContractTemplate:
        """Lấy chi tiết mẫu hợp đồng, kiểm tra hiệu lực nếu cần thiết."""
        tmpl = (
            db.query(ContractTemplate).filter(ContractTemplate.template_id == template_id).first()
        )
        if not tmpl:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy mẫu hợp đồng với ID {template_id}",
            )
        if ensure_active and not tmpl.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mẫu hợp đồng '{tmpl.template_name}' đã ngừng hiệu lực, không thể áp dụng cho hợp đồng mới.",
            )
        return tmpl

    @staticmethod
    def create_contract_template(db: Session, data: ContractTemplateCreate) -> ContractTemplate:
        """Tạo mẫu hợp đồng mới chuẩn định dạng HTML và danh sách tài liệu bắt buộc."""
        existing = (
            db.query(ContractTemplate)
            .filter(ContractTemplate.template_code == data.template_code)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mã mẫu hợp đồng '{data.template_code}' đã tồn tại",
            )

        now = _utc_now_naive()
        tmpl = ContractTemplate(
            template_code=data.template_code,
            contract_type=data.contract_type,
            template_name=data.template_name,
            version_no=data.version_no,
            content_html=data.content_html,
            required_documents_json=data.required_documents_json,
            is_active=data.is_active,
            created_at=now,
            updated_at=now,
        )
        db.add(tmpl)
        db.commit()
        db.refresh(tmpl)
        return tmpl

    @staticmethod
    def bump_template_version(
        db: Session, template_id: int, data: ContractTemplateUpdate
    ) -> ContractTemplate:
        """
        [QUẢN TRỊ PHIÊN BẢN ĐIỀU KHOẢN KHÔNG HỒI TỐ - NON-RETROACTIVE VERSIONING (G03)]
        
        Quy tắc pháp lý cốt lõi:
        - Khi có sự điều chỉnh về nội dung điều khoản hợp đồng (content_html),
          hệ thống tự động tăng version_no += 1.
        - Toàn bộ các hợp đồng đã ký kết trong quá khứ liên kết với phiên bản trước đó
          hoàn toàn không bị ảnh hưởng hay biến động nội dung điều khoản.
        - Chỉ các hợp đồng tạo mới kể từ thời điểm này mới áp dụng phiên bản điều khoản mới nhất.
        """
        tmpl = CatalogService.get_contract_template(db, template_id)

        if data.template_name is not None:
            tmpl.template_name = data.template_name
        if data.content_html is not None:
            tmpl.content_html = data.content_html
            tmpl.version_no += 1  # Tự động tăng số hiệu phiên bản điều khoản hợp đồng
        if data.required_documents_json is not None:
            tmpl.required_documents_json = data.required_documents_json
        if data.is_active is not None:
            tmpl.is_active = data.is_active

        tmpl.updated_at = _utc_now_naive()
        db.commit()
        db.refresh(tmpl)
        return tmpl
