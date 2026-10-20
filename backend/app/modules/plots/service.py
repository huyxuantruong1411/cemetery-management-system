from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.modules.plots.models import (
    Plot,
    PlotReservation,
    PlotSlot,
    PlotType,
    Row,
    Zone,
)
from app.modules.plots.schemas import (
    MediaItemBrief,
    PlotCreate,
    PlotDeceasedBrief,
    PlotDetailResponse,
    PlotListResponse,
    PlotReservationResponse,
    PlotReserveRequest,
    PlotSlotResponse,
    PlotStatsResponse,
    PlotTimelineEvent,
    PlotTimelineResponse,
    PlotTypeCreate,
    PlotTypeResponse,
    PlotTypeUpdate,
    PlotUpdate,
    RowCreate,
    RowResponse,
    RowUpdate,
    ZoneCreate,
    ZoneResponse,
    ZoneUpdate,
)
from app.modules.profiles.models import Customer

# =============================================================================
# PHÂN HỆ QUẢN LÝ Ô MỘ & QUY HOẠCH KHÔNG GIAN (PLOTS SERVICE)
# =============================================================================
# Vai trò kiến trúc:
# - Chịu trách nhiệm toàn bộ logic nghiệp vụ về quy hoạch không gian 3 cấp:
#   Khu Vực (Zone) -> Hàng Mộ (Row) -> Ô Mộ (Plot) -> Huyệt Mộ (PlotSlot).
# - Thực thi các quy tắc bất biến sống còn (Core Domain Invariants):
#   1. Quy tắc Kim Tĩnh Bất Biến: Ô mộ Kim Tĩnh đã an táng sẽ bị khóa vĩnh viễn (is_locked=True),
#      chống mọi hành vi sửa kết cấu, hạ cờ, cải táng hoặc xóa ô.
#   2. Chống tranh chấp giữ chỗ (Anti-Double Booking): Sử dụng row lock 'with_for_update()'
#      đảm bảo không thể có 2 nhân viên giữ chỗ cùng 1 ô cùng một thời điểm.
#   3. Phân quyền hiển thị dữ liệu theo Actor: Che giấu thông tin cá nhân (PII) chủ mộ
#      đối với các vai trò không thuộc diện quản lý (như Quản trang ngoài hiện trường).
# =============================================================================


class PlotService:
    @staticmethod
    def visible_to_actor(plot: PlotListResponse, roles: list[str]) -> PlotListResponse:
        """
        NGHIỆP VỤ BẢO VỆ DỮ LIỆU RIÊNG TƯ (PII Protection):
        - Chỉ có vai trò Quản trị viên (ADMIN) hoặc Nhân viên kinh doanh (MARKETING)
          mới được phép xem thông tin chủ sở hữu (owner_id, owner_name) và thông tin giữ chỗ.
        - Các vai trò khác (như CARETAKER - Quản trang hiện trường) khi xem danh sách ô
          sẽ bị ẩn các trường nhạy cảm này (gán None) để đảm bảo tuân thủ an toàn dữ liệu.
        """
        if not {"ADMIN", "MARKETING"}.intersection(roles):
            plot.owner_id = None
            plot.owner_name = None
            plot.active_reservation = None
        return plot

    # =========================================================================
    # 1. QUẢN LÝ PHÂN KHU (ZONE MANAGEMENT - CẤP 1)
    # =========================================================================
    @staticmethod
    def list_zones(db: Session) -> List[ZoneResponse]:
        """Lấy toàn bộ danh sách phân khu trong nghĩa trang, sắp xếp theo mã khu (A, B, C...)."""
        zones = db.query(Zone).order_by(Zone.zone_code).all()
        return [ZoneResponse.model_validate(z) for z in zones]

    @staticmethod
    def create_zone(db: Session, data: ZoneCreate) -> ZoneResponse:
        """
        Tạo mới một phân khu:
        - Kiểm tra tính duy nhất của mã khu vực (zone_code).
        - Chuẩn hóa mã khu thành chữ in hoa (uppercase).
        """
        existing = db.query(Zone).filter(Zone.zone_code == data.zone_code.strip()).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mã khu vực '{data.zone_code}' đã tồn tại trong hệ thống.",
            )
        zone = Zone(
            zone_code=data.zone_code.strip().upper(),
            zone_name=data.zone_name.strip(),
            total_rows=data.total_rows,
            description=data.description,
        )
        db.add(zone)
        db.commit()
        db.refresh(zone)
        return ZoneResponse.model_validate(zone)

    @staticmethod
    def update_zone(db: Session, zone_id: int, data: ZoneUpdate) -> ZoneResponse:
        """
        Cập nhật thông tin phân khu:
        - Kiểm tra sự tồn tại của phân khu theo ID.
        - Cho phép sửa đổi tên hiển thị, tổng số hàng dự kiến và mô tả.
        """
        zone = db.query(Zone).filter(Zone.zone_id == zone_id).first()
        if not zone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy khu vực với ID {zone_id}.",
            )
        if data.zone_name is not None:
            zone.zone_name = data.zone_name.strip()
        if data.total_rows is not None:
            zone.total_rows = data.total_rows
        if data.description is not None:
            zone.description = data.description
        db.commit()
        db.refresh(zone)
        return ZoneResponse.model_validate(zone)

    @staticmethod
    def delete_zone(db: Session, zone_id: int) -> dict:
        """
        Xóa phân khu (Ràng buộc toàn vẹn khóa ngoại):
        - Quy tắc nghiệp vụ: Không thể xóa phân khu nếu bên trong vẫn còn Hàng mộ (Row).
        - Ngăn chặn việc xóa mồ côi (orphaned rows) vi phạm cấu trúc cây quy hoạch.
        """
        zone = db.query(Zone).filter(Zone.zone_id == zone_id).first()
        if not zone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy khu vực với ID {zone_id}.",
            )
        row_count = db.query(Row).filter(Row.zone_id == zone_id).count()
        if row_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Khu vực '{zone.zone_code}' đang chứa {row_count} hàng mộ. Vui lòng xóa các hàng mộ trước khi xóa khu vực.",
            )
        db.delete(zone)
        db.commit()
        return {"message": f"Đã xóa khu vực '{zone.zone_code}' thành công."}

    # =========================================================================
    # 2. QUẢN LÝ HÀNG MỘ (ROW MANAGEMENT - CẤP 2)
    # =========================================================================
    @staticmethod
    def list_rows(db: Session, zone_id: Optional[int] = None) -> List[RowResponse]:
        """
        Lấy danh sách các hàng mộ:
        - Hỗ trợ lọc theo khu vực (zone_id).
        - Sắp xếp theo mã hàng (A1, A2, B1...) để hiển thị tuần tự trên sơ đồ.
        """
        query = db.query(Row)
        if zone_id is not None:
            query = query.filter(Row.zone_id == zone_id)
        rows = query.order_by(Row.row_code).all()
        return [RowResponse.model_validate(r) for r in rows]

    @staticmethod
    def create_row(db: Session, data: RowCreate) -> RowResponse:
        """
        Tạo mới một hàng mộ trực thuộc một khu:
        - Đảm bảo mã hàng không trùng lặp trong cùng một khu vực (zone_id + row_code).
        - Tự động cập nhật tổng số hàng (total_rows) của khu vực cha.
        """
        zone = db.query(Zone).filter(Zone.zone_id == data.zone_id).first()
        if not zone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy khu vực với ID {data.zone_id}.",
            )
        existing = (
            db.query(Row)
            .filter(Row.zone_id == data.zone_id, Row.row_code == data.row_code.strip())
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Hàng '{data.row_code}' đã tồn tại trong khu vực {zone.zone_name}.",
            )
        row = Row(
            zone_id=data.zone_id,
            row_code=data.row_code.strip().upper(),
            total_plots=data.total_plots,
        )
        db.add(row)
        # Tự động đồng bộ số lượng hàng thuộc khu vực
        zone.total_rows = db.query(Row).filter(Row.zone_id == zone.zone_id).count() + 1
        db.commit()
        db.refresh(row)
        return RowResponse.model_validate(row)

    @staticmethod
    def update_row(db: Session, row_id: int, data: RowUpdate) -> RowResponse:
        """Cập nhật thông tin hàng mộ (mã hàng chuẩn hóa viết hoa, tổng số ô dự kiến)."""
        row = db.query(Row).filter(Row.row_id == row_id).first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy hàng mộ với ID {row_id}.",
            )
        if data.row_code is not None and data.row_code.strip():
            row.row_code = data.row_code.strip().upper()
        if data.total_plots is not None:
            row.total_plots = data.total_plots
        db.commit()
        db.refresh(row)
        return RowResponse.model_validate(row)

    @staticmethod
    def delete_row(db: Session, row_id: int) -> dict:
        """
        Xóa hàng mộ (Ràng buộc toàn vẹn dữ liệu):
        - Chặn xóa nếu trong hàng vẫn còn Ô Mộ (Plot).
        - Khi xóa thành công, tự động giảm đếm total_rows của khu vực cha.
        """
        row = db.query(Row).filter(Row.row_id == row_id).first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy hàng mộ với ID {row_id}.",
            )
        plot_count = db.query(Plot).filter(Plot.row_id == row_id).count()
        if plot_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Hàng '{row.row_code}' đang chứa {plot_count} ô mộ. Vui lòng xóa các ô mộ trước khi xóa hàng.",
            )
        zone = db.query(Zone).filter(Zone.zone_id == row.zone_id).first()
        db.delete(row)
        if zone:
            zone.total_rows = max(0, db.query(Row).filter(Row.zone_id == zone.zone_id).count() - 1)
        db.commit()
        return {"message": f"Đã xóa hàng '{row.row_code}' thành công."}

    # =========================================================================
    # 3. QUẢN LÝ LOẠI MỘ & KÍCH THƯỚC QUY CHUẨN (PLOT TYPE MANAGEMENT)
    # =========================================================================
    @staticmethod
    def list_plot_types(db: Session) -> List[PlotTypeResponse]:
        """Lấy danh mục các loại mộ quy chuẩn (Mộ đơn, Mộ đôi, Mộ gia tộc...)."""
        types = db.query(PlotType).order_by(PlotType.type_name).all()
        return [PlotTypeResponse.model_validate(t) for t in types]

    @staticmethod
    def create_plot_type(db: Session, data: PlotTypeCreate) -> PlotTypeResponse:
        """
        Tạo mới định nghĩa loại mộ:
        - default_slots: Số huyệt mặc định (Ví dụ: mộ đơn = 1, mộ đôi = 2, gia tộc >= 4).
        - length, width: Kích thước hình học (mét) phục vụ vẽ sơ đồ và tính đơn giá.
        """
        existing = db.query(PlotType).filter(PlotType.type_name == data.type_name.strip()).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Loại mộ '{data.type_name}' đã tồn tại.",
            )
        pt = PlotType(
            type_name=data.type_name.strip(),
            default_slots=data.default_slots,
            length=data.length,
            width=data.width,
            description=data.description,
        )
        db.add(pt)
        db.commit()
        db.refresh(pt)
        return PlotTypeResponse.model_validate(pt)

    @staticmethod
    def update_plot_type(db: Session, type_id: int, data: PlotTypeUpdate) -> PlotTypeResponse:
        """Cập nhật thông số kích thước và số huyệt mặc định của loại mộ."""
        pt = db.query(PlotType).filter(PlotType.type_id == type_id).first()
        if not pt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy loại mộ với ID {type_id}.",
            )
        if data.type_name is not None:
            pt.type_name = data.type_name.strip()
        if data.default_slots is not None:
            pt.default_slots = data.default_slots
        if data.length is not None:
            pt.length = data.length
        if data.width is not None:
            pt.width = data.width
        if data.description is not None:
            pt.description = data.description
        db.commit()
        db.refresh(pt)
        return PlotTypeResponse.model_validate(pt)

    @staticmethod
    def delete_plot_type(db: Session, type_id: int) -> dict:
        """
        Xóa loại mộ:
        - Chặn xóa nếu đang có bất kỳ ô mộ nào trong nghĩa trang áp dụng loại mộ này.
        """
        pt = db.query(PlotType).filter(PlotType.type_id == type_id).first()
        if not pt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy loại mộ với ID {type_id}.",
            )
        plot_count = db.query(Plot).filter(Plot.type_id == type_id).count()
        if plot_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Loại mộ '{pt.type_name}' đang được áp dụng cho {plot_count} ô mộ. Không thể xóa.",
            )
        db.delete(pt)
        db.commit()
        return {"message": f"Đã xóa loại mộ '{pt.type_name}' thành công."}

    # =========================================================================
    # 4. QUẢN LÝ VÒNG ĐỜI Ô MỘ & HUYỆT MỘ (PLOT & SLOT LIFECYCLE)
    # =========================================================================
    @staticmethod
    def list_plots(
        db: Session,
        zone_id: Optional[int] = None,
        row_id: Optional[int] = None,
        type_id: Optional[int] = None,
        status_filter: Optional[str] = None,
        is_kim_tinh: Optional[bool] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 200,
    ) -> List[PlotListResponse]:
        """
        Truy vấn danh sách ô mộ kèm tối ưu hóa hiệu năng:
        - Tối ưu truy vấn N+1: Sử dụng joinedload cho Row, Zone, PlotType, PlotReservation.
        - Batch Loading chủ sở hữu: Lấy tập hợp customer_id của tất cả các ô trong 1 truy vấn duy nhất.
        - Hỗ trợ đa tiêu chí lọc: Theo Khu, Hàng, Loại mộ, Trạng thái (Trống/Giữ chỗ/Đã bán/Đã an táng),
          cờ Kim Tĩnh, và tìm kiếm chuỗi ký tự theo mã ô (plot_code).
        - Gắn cờ 'is_synthetic': Phát hiện các ô mộ dữ liệu mẫu/synthetic test qua tag ghi chú.
        """
        query = (
            db.query(Plot)
            .join(Row, Plot.row_id == Row.row_id)
            .join(Zone, Row.zone_id == Zone.zone_id)
            .join(PlotType, Plot.type_id == PlotType.type_id)
            .options(
                joinedload(Plot.row).joinedload(Row.zone),
                joinedload(Plot.plot_type),
                joinedload(Plot.reservations),
            )
        )

        # Áp dụng các điều kiện lọc linh hoạt
        if zone_id is not None:
            query = query.filter(Zone.zone_id == zone_id)
        if row_id is not None:
            query = query.filter(Row.row_id == row_id)
        if type_id is not None:
            query = query.filter(PlotType.type_id == type_id)
        if status_filter:
            query = query.filter(Plot.status == status_filter)
        if is_kim_tinh is not None:
            query = query.filter(Plot.is_kim_tinh == is_kim_tinh)
        if search:
            s = f"%{search.strip()}%"
            query = query.filter(Plot.plot_code.ilike(s))

        plots = (
            query.order_by(Zone.zone_code, Row.row_code, Plot.plot_code)
            .offset(skip)
            .limit(limit)
            .all()
        )

        # KỸ THUẬT BATCH LOADING TRÁNH N+1 QUERY:
        # Gom tất cả owner_id không rỗng lại và truy vấn 1 lần duy nhất từ bảng Customer.
        owner_ids = {p.owner_id for p in plots if p.owner_id}
        owner_map = {}
        if owner_ids:
            owners = db.query(Customer).filter(Customer.customer_id.in_(owner_ids)).all()
            owner_map = {o.customer_id: o.full_name for o in owners}

        results = []
        for p in plots:
            owner_name = owner_map.get(p.owner_id) if p.owner_id else None

            # Tìm lệnh giữ chỗ đang có hiệu lực (state == 'ACTIVE') nếu có
            active_res = None
            for res in p.reservations:
                if res.state == "ACTIVE":
                    active_res = PlotReservationResponse.model_validate(res)
                    break

            results.append(
                PlotListResponse(
                    plot_id=p.plot_id,
                    plot_code=p.plot_code,
                    row_id=p.row_id,
                    row_code=p.row.row_code if p.row else "",
                    zone_id=p.row.zone.zone_id if p.row and p.row.zone else 0,
                    zone_code=p.row.zone.zone_code if p.row and p.row.zone else "",
                    zone_name=p.row.zone.zone_name if p.row and p.row.zone else "",
                    type_id=p.type_id,
                    type_name=p.plot_type.type_name if p.plot_type else "",
                    default_slots=p.plot_type.default_slots if p.plot_type else 1,
                    plot_length=p.plot_type.length if p.plot_type else None,
                    plot_width=p.plot_type.width if p.plot_type else None,
                    is_synthetic="[SYNTHETIC_GIS" in (p.notes or ""),
                    status=p.status,
                    is_kim_tinh=p.is_kim_tinh,
                    is_locked=p.is_locked,
                    latitude=p.latitude,
                    longitude=p.longitude,
                    orientation=p.orientation,
                    owner_id=p.owner_id,
                    owner_name=owner_name,
                    active_reservation=active_res,
                )
            )
        return results

    @staticmethod
    def get_plot(db: Session, plot_id: int) -> PlotDetailResponse:
        """
        Lấy chi tiết một ô mộ (bao gồm toàn bộ các huyệt mộ - PlotSlot):
        - Tự động sinh slots lười (Lazy Slot Generation): Nếu ô mộ cũ trong CSDL chưa có slots,
          hệ thống tự động khởi tạo số lượng slots tương ứng với default_slots của PlotType,
          đảm bảo dữ liệu luôn đầy đủ khi hiển thị chi tiết và an táng.
        """
        p = (
            db.query(Plot)
            .options(
                joinedload(Plot.row).joinedload(Row.zone),
                joinedload(Plot.plot_type),
                joinedload(Plot.slots),
                joinedload(Plot.reservations),
            )
            .filter(Plot.plot_id == plot_id)
            .first()
        )
        if not p:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy ô mộ với ID {plot_id}.",
            )

        owner_name = None
        if p.owner_id:
            owner = db.query(Customer).filter(Customer.customer_id == p.owner_id).first()
            if owner:
                owner_name = owner.full_name

        active_res = None
        for res in p.reservations:
            if res.state == "ACTIVE":
                active_res = PlotReservationResponse.model_validate(res)
                break

        # CƠ CHẾ TỰ BÙ ĐẮP DỮ LIỆU HUYỆT (LAZY SLOT AUTO-GENERATION)
        if not p.slots:
            num_slots = p.plot_type.default_slots if p.plot_type and p.plot_type.default_slots else 1
            for i in range(1, num_slots + 1):
                slot = PlotSlot(
                    plot_id=p.plot_id,
                    slot_number=i,
                    status="OCCUPIED" if p.status == "OCCUPIED" else "EMPTY",
                )
                db.add(slot)
            db.commit()
            db.refresh(p)

        slots_resp = [PlotSlotResponse.model_validate(s) for s in p.slots]

        return PlotDetailResponse(
            plot_id=p.plot_id,
            plot_code=p.plot_code,
            row_id=p.row_id,
            row_code=p.row.row_code if p.row else "",
            zone_id=p.row.zone.zone_id if p.row and p.row.zone else 0,
            zone_code=p.row.zone.zone_code if p.row and p.row.zone else "",
            zone_name=p.row.zone.zone_name if p.row and p.row.zone else "",
            type_id=p.type_id,
            type_name=p.plot_type.type_name if p.plot_type else "",
            default_slots=p.plot_type.default_slots if p.plot_type else 1,
            plot_length=p.plot_type.length if p.plot_type else None,
            plot_width=p.plot_type.width if p.plot_type else None,
            is_synthetic="[SYNTHETIC_GIS" in (p.notes or ""),
            status=p.status,
            is_kim_tinh=p.is_kim_tinh,
            is_locked=p.is_locked,
            latitude=p.latitude,
            longitude=p.longitude,
            orientation=p.orientation,
            owner_id=p.owner_id,
            owner_name=owner_name,
            active_reservation=active_res,
            slots=slots_resp,
            created_at=p.created_at,
            updated_at=p.updated_at,
            notes=p.notes,
        )

    @staticmethod
    def create_plot(db: Session, data: PlotCreate) -> PlotDetailResponse:
        """
        TẠO MỚI Ô MỘ (ACID Transaction):
        - Kiểm tra tính tồn tại của hàng mộ (Row) và loại mộ (PlotType).
        - Đảm bảo mã ô mộ (plot_code) là duy nhất trên toàn hệ thống.
        - Tự động sinh đồng thời các huyệt mộ (PlotSlot từ 1 đến default_slots) trong cùng 1 transaction.
        - Trạng thái ban đầu luôn là EMPTY_UNSOLD, cờ is_kim_tinh=False, is_locked=False.
        - Tự động cập nhật tổng số ô mộ của hàng tương ứng.
        """
        row = db.query(Row).filter(Row.row_id == data.row_id).first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy hàng mộ với ID {data.row_id}.",
            )
        pt = db.query(PlotType).filter(PlotType.type_id == data.type_id).first()
        if not pt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy loại mộ với ID {data.type_id}.",
            )

        existing = db.query(Plot).filter(Plot.plot_code == data.plot_code.strip()).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mã ô mộ '{data.plot_code}' đã tồn tại trong hệ thống.",
            )

        now = datetime.now(timezone.utc)
        plot = Plot(
            plot_code=data.plot_code.strip().upper(),
            row_id=data.row_id,
            type_id=data.type_id,
            latitude=data.latitude,
            longitude=data.longitude,
            orientation=data.orientation,
            notes=data.notes,
            status="EMPTY_UNSOLD",
            is_kim_tinh=False,
            is_locked=False,
            created_at=now,
            updated_at=now,
        )
        db.add(plot)
        db.flush()  # populate plot_id without committing

        # Tự động khởi tạo số lượng huyệt mộ tương ứng với loại mộ trong cùng giao dịch
        for slot_num in range(1, pt.default_slots + 1):
            slot = PlotSlot(
                plot_id=plot.plot_id,
                slot_number=slot_num,
                status="EMPTY",
                current_deceased_id=None,
            )
            db.add(slot)

        # Cập nhật tổng số ô trong hàng
        row.total_plots = db.query(Plot).filter(Row.row_id == row.row_id).count() + 1

        db.commit()
        return PlotService.get_plot(db, plot.plot_id)

    @staticmethod
    def update_plot(db: Session, plot_id: int, data: PlotUpdate) -> PlotDetailResponse:
        """
        CẬP NHẬT THÔNG TIN Ô MỘ VÀ BẢO VỆ TÍNH BẤT BIẾN KIM TĨNH:
        - THỰC THI NGUYÊN TẮC CỐT LÕI (CORE INVARIANT):
          1. Không cho phép gỡ cờ Kim Tĩnh (is_kim_tinh từ True -> False).
          2. Nếu ô đã khóa (is_locked=True), cấm mọi hành vi chỉnh sửa tọa độ, hướng, ghi chú.
          3. Không cho phép gán cờ Kim Tĩnh thủ công khi ô còn đang ở trạng thái Trống/Giữ chỗ.
             Kim Tĩnh chỉ được kích hoạt hợp lệ qua quy trình lập Phụ lục An táng có Giấy chứng tử.
        """
        plot = db.query(Plot).filter(Plot.plot_id == plot_id).first()
        if not plot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy ô mộ với ID {plot_id}.",
            )

        # RÀNG BUỘC KIM TĨNH BẤT BIẾN
        if plot.is_kim_tinh:
            if data.is_kim_tinh is False:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="QUY TẮC BẤT BIẾN KIM TĨNH: Ô mộ đã thiết lập kết cấu Kim Tĩnh, nghiêm cấm gỡ bỏ cờ Kim Tĩnh!",
                )
            if plot.is_locked:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="QUY TẮC BẤT BIẾN KIM TĨNH: Ô mộ Kim Tĩnh đã an táng và khóa vĩnh viễn, nghiêm cấm chỉnh sửa thông số!",
                )

        if data.is_kim_tinh is True and not plot.is_kim_tinh:
            if plot.status in ("EMPTY_UNSOLD", "RESERVED"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="QUY TẮC NGHIỆP VỤ: Ô đất trống chưa an táng không thể thiết lập cờ Kim Tĩnh. Kim Tĩnh chỉ được kích hoạt khi lập và xác nhận Phụ lục An táng!",
                )
            plot.is_kim_tinh = True

        if data.latitude is not None:
            plot.latitude = data.latitude
        if data.longitude is not None:
            plot.longitude = data.longitude
        if data.orientation is not None:
            plot.orientation = data.orientation
        if data.notes is not None:
            plot.notes = data.notes

        plot.updated_at = datetime.now(timezone.utc)
        db.commit()
        return PlotService.get_plot(db, plot_id)

    @staticmethod
    def delete_plot(db: Session, plot_id: int) -> dict:
        """
        XÓA Ô MỘ AN TOÀN (CÁC CHỐT CHẶN NGHIỆP VỤ TOÀN VẸN):
        1. Chốt chặn Kim Tĩnh: Ô có kết cấu Kim Tĩnh hoặc đã khóa vĩnh viễn TUYỆT ĐỐI KHÔNG ĐƯỢC XÓA.
        2. Chốt chặn trạng thái: Chỉ ô Chưa bán (EMPTY_UNSOLD) mới có thể xóa.
        3. Chốt chặn giữ chỗ: Ô đang có lệnh giữ chỗ ACTIVE không được xóa.
        4. Chốt chặn giao dịch: Ô đã từng phát sinh bất kỳ Hợp đồng hoặc Phụ lục nào không được xóa
           để bảo tồn lịch sử kế toán và pháp lý.
        5. Khi thỏa mãn toàn bộ chốt chặn: Xóa sạch các PlotSlot con và giảm total_plots của Row.
        """
        plot = db.query(Plot).filter(Plot.plot_id == plot_id).first()
        if not plot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy ô mộ với ID {plot_id}.",
            )
        # Chốt chặn Kim Tĩnh Bất Biến
        if plot.is_kim_tinh or plot.is_locked:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="QUY TẮC BẤT BIẾN KIM TĨNH: Ô mộ kết cấu Kim Tĩnh hoặc đã khóa không thể bị xóa!",
            )
        if plot.status != "EMPTY_UNSOLD":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Chỉ có thể xóa ô mộ ở trạng thái Chưa bán (EMPTY_UNSOLD). Trạng thái hiện tại: {plot.status}.",
            )

        # Chốt chặn kiểm tra lệnh giữ chỗ đang hoạt động
        active_res = (
            db.query(PlotReservation)
            .filter(PlotReservation.plot_id == plot_id, PlotReservation.state == "ACTIVE")
            .first()
        )
        if active_res:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ô mộ đang có lệnh giữ chỗ hiệu lực, không thể xóa.",
            )

        # Chốt chặn kiểm tra lịch sử Hợp đồng & Phụ lục liên quan
        from app.modules.contracts.models import (
            BurialAnnex,
            ConstructionAnnex,
            ExhumationContract,
            LandPurchaseContract,
            TransferContract,
        )

        contract_count = (
            db.query(LandPurchaseContract).filter(LandPurchaseContract.plot_id == plot_id).count()
            + db.query(ExhumationContract).filter(ExhumationContract.plot_id == plot_id).count()
            + db.query(TransferContract).filter(TransferContract.plot_id == plot_id).count()
        )
        annex_count = (
            db.query(BurialAnnex).filter(BurialAnnex.plot_id == plot_id).count()
            + db.query(ConstructionAnnex).filter(ConstructionAnnex.plot_id == plot_id).count()
        )
        if contract_count > 0 or annex_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ô mộ đã gắn với {contract_count} hợp đồng và {annex_count} phụ lục giao dịch, không thể xóa.",
            )

        # Xóa các huyệt mộ con trước khi xóa ô mộ
        db.query(PlotSlot).filter(PlotSlot.plot_id == plot_id).delete(synchronize_session=False)

        row = db.query(Row).filter(Row.row_id == plot.row_id).first()
        db.delete(plot)
        if row:
            row.total_plots = max(0, db.query(Plot).filter(Plot.row_id == row.row_id).count() - 1)
        db.commit()
        return {"message": f"Đã xóa ô mộ '{plot.plot_code}' thành công."}

    # =========================================================================
    # 5. GIỮ CHỖ ĐỘC QUYỀN CHỐNG TRANH CHẤP (ANTI-DOUBLE BOOKING - USE CASE G04)
    # =========================================================================
    @staticmethod
    def reserve_plot(
        db: Session,
        plot_id: int,
        user_id: int,
        req: PlotReserveRequest,
    ) -> PlotReservationResponse:
        """
        GIỮ CHỖ Ô ĐẤT ĐỘC QUYỀN (ANTI-DOUBLE BOOKING CONCURRENCY):
        - Sử dụng Row Lock CSDL: '.with_for_update()' để khóa dòng Plot và PlotReservation.
          Nếu 2 nhân viên cùng bấm giữ chỗ 1 ô cùng 1 giây, giao dịch thứ hai phải chờ
          hoặc bị từ chối, giải quyết triệt để bài toán tranh chấp tài nguyên (Race Condition).
        - Tự động kiểm tra thời hạn (TTL): Nếu lệnh giữ chỗ cũ đã quá hạn (expires_at < now),
          hệ thống tự động chuyển state='EXPIRED' (Lazy Eviction).
        - Nếu vẫn còn người giữ chỗ hợp lệ: Ném lỗi HTTP 409 Conflict.
        - Cập nhật trạng thái ô mộ sang 'RESERVED' và lưu thời hạn giữ chỗ (duration_hours).
        """
        # Concurrency Lock: Khóa dòng ô mộ ở mức CSDL chống tranh chấp đồng thời
        plot = db.query(Plot).filter(Plot.plot_id == plot_id).with_for_update().first()
        if not plot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy ô mộ với ID {plot_id}.",
            )

        now = datetime.now(timezone.utc)

        # 1. Kiểm tra lệnh giữ chỗ đang có và tự động hết hạn nếu quá thời gian
        active_res = (
            db.query(PlotReservation)
            .filter(PlotReservation.plot_id == plot_id, PlotReservation.state == "ACTIVE")
            .with_for_update()
            .first()
        )
        if active_res:
            expires_at_cmp = active_res.expires_at
            if expires_at_cmp.tzinfo is None:
                expires_at_cmp = expires_at_cmp.replace(tzinfo=timezone.utc)
            if expires_at_cmp < now:
                # Quá hạn -> Tự động đánh dấu hết hạn (Lazy Eviction)
                active_res.state = "EXPIRED"
                db.flush()
            else:
                # Vẫn còn hiệu lực -> Tranh chấp tài nguyên, trả mã lỗi 409 Conflict!
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Ô mộ {plot.plot_code} đang có người giữ chỗ (hết hạn lúc {active_res.expires_at.strftime('%Y-%m-%d %H:%M')}). Vui lòng chọn ô khác!",
                )

        # 2. Kiểm tra trạng thái hiện tại của ô mộ
        if plot.status == "RESERVED":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ô mộ {plot.plot_code} đang ở trạng thái Tạm giữ chỗ, không thể thực hiện giữ chỗ mới.",
            )
        if plot.status in ("OWNED_EMPTY", "UNDER_CONSTRUCTION", "OCCUPIED", "UNDER_EXHUMATION"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ô mộ {plot.plot_code} đã có chủ sở hữu hoặc đang sử dụng (trạng thái: {plot.status}), không thể giữ chỗ.",
            )

        # 3. Tạo bản ghi giữ chỗ mới với thời hạn (duration_hours)
        expires_at = now + timedelta(hours=req.duration_hours)
        reservation = PlotReservation(
            plot_id=plot.plot_id,
            reserved_by=user_id,
            customer_name=req.customer_name.strip() if req.customer_name else None,
            customer_phone=req.customer_phone.strip() if req.customer_phone else None,
            state="ACTIVE",
            reserved_at=now,
            expires_at=expires_at,
            notes=req.notes,
        )
        db.add(reservation)

        # 4. Chuyển trạng thái ô mộ sang RESERVED
        plot.status = "RESERVED"
        plot.updated_at = now

        db.commit()
        db.refresh(reservation)
        return PlotReservationResponse.model_validate(reservation)

    @staticmethod
    def cancel_reservation(db: Session, plot_id: int, user_id: int) -> dict:
        """
        HỦY LỆNH GIỮ CHỖ VÀ GIẢI PHÓNG Ô MỘ:
        - Khóa dòng ô mộ with_for_update().
        - Đổi trạng thái reservation thành 'CANCELLED'.
        - Trả trạng thái ô mộ về 'EMPTY_UNSOLD' để các khách hàng khác có thể tiếp cận.
        """
        plot = db.query(Plot).filter(Plot.plot_id == plot_id).with_for_update().first()
        if not plot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy ô mộ với ID {plot_id}.",
            )

        active_res = (
            db.query(PlotReservation)
            .filter(PlotReservation.plot_id == plot_id, PlotReservation.state == "ACTIVE")
            .first()
        )
        if not active_res:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ô mộ {plot.plot_code} không có lệnh giữ chỗ nào đang hoạt động.",
            )

        active_res.state = "CANCELLED"
        plot.status = "EMPTY_UNSOLD"
        plot.updated_at = datetime.now(timezone.utc)
        db.commit()
        return {
            "message": f"Đã hủy giữ chỗ ô mộ {plot.plot_code} thành công.",
            "status": "EMPTY_UNSOLD",
        }

    # =========================================================================
    # 6. THỐNG KÊ QUY HOẠCH & TRẠNG THÁI Ô MỘ (STATISTICS)
    # =========================================================================
    @staticmethod
    def get_stats(db: Session) -> PlotStatsResponse:
        """
        Thống kê tổng hợp số liệu quy hoạch nghĩa trang phục vụ Dashboard:
        - Tổng số ô mộ, phân loại theo trạng thái kinh doanh và vận hành:
          + Chưa bán (EMPTY_UNSOLD)
          + Tạm giữ chỗ (RESERVED)
          + Đã bán chưa sử dụng (OWNED_EMPTY)
          + Đang xây dựng lăng mộ (UNDER_CONSTRUCTION)
          + Đã an táng (OCCUPIED)
          + Đang thực hiện cải táng (UNDER_EXHUMATION)
        - Số lượng ô mộ kết cấu Kim Tĩnh (is_kim_tinh=True) và số ô đã khóa vĩnh viễn (is_locked=True).
        """
        total = db.query(Plot).count()
        empty_unsold = db.query(Plot).filter(Plot.status == "EMPTY_UNSOLD").count()
        reserved = db.query(Plot).filter(Plot.status == "RESERVED").count()
        owned_empty = db.query(Plot).filter(Plot.status == "OWNED_EMPTY").count()
        under_construction = db.query(Plot).filter(Plot.status == "UNDER_CONSTRUCTION").count()
        occupied = db.query(Plot).filter(Plot.status == "OCCUPIED").count()
        under_exhumation = db.query(Plot).filter(Plot.status == "UNDER_EXHUMATION").count()
        kim_tinh = db.query(Plot).filter(Plot.is_kim_tinh == True).count()  # noqa: E712
        locked = db.query(Plot).filter(Plot.is_locked == True).count()  # noqa: E712

        return PlotStatsResponse(
            total_plots=total,
            empty_unsold=empty_unsold,
            reserved=reserved,
            owned_empty=owned_empty,
            under_construction=under_construction,
            occupied=occupied,
            under_exhumation=under_exhumation,
            kim_tinh_count=kim_tinh,
            locked_count=locked,
        )

    # =========================================================================
    # 7. DÒNG THỜI GIAN HOẠT ĐỘNG VÀ MINH CHỨNG CÔNG KHAI (MEMORIAL PORTAL - G19)
    # =========================================================================
    @staticmethod
    def get_plot_timeline(db: Session, plot_identifier: str) -> PlotTimelineResponse:
        """
        NGHIỆP VỤ HỢP NHẤT DÒNG THỜI GIAN ĐA PHÂN HỆ (CROSS-DOMAIN MEMORIAL TIMELINE):
        - Cho phép thân nhân hoặc khách viếng thăm tra cứu lịch sử và minh chứng thực địa của ô mộ
          thông qua ID hoặc mã ô mộ (plot_code) mà không yêu cầu đăng nhập.
        - Tự động tập hợp dữ liệu từ 3 nguồn phân hệ khác nhau:
          1. Lịch sử An Táng / Cải Táng (BurialHistory): Kèm ảnh biên bản an táng thực địa.
          2. Lệnh Thi Công & Xây Dựng (ConstructionOrder): Kèm các hạng mục và ảnh nghiệm thu.
          3. Lịch Trình Chăm Sóc Định Kỳ (CareSchedule): Kèm checklist công việc và ảnh hiện trường.
        - Sắp xếp toàn bộ sự kiện theo thứ tự thời gian giảm dần (mới nhất lên đầu).
        - Trả về tọa độ GPS và đường dẫn Google Maps hỗ trợ dẫn đường trực tiếp ngoài thực địa.
        """
        query = db.query(Plot).options(
            joinedload(Plot.row).joinedload(Row.zone),
            joinedload(Plot.plot_type),
            joinedload(Plot.slots),
        )
        if plot_identifier.isdigit():
            plot = query.filter(Plot.plot_id == int(plot_identifier)).first()
        else:
            plot = query.filter(Plot.plot_code.ilike(plot_identifier.strip())).first()

        if not plot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy ô mộ với mã hoặc ID '{plot_identifier}'.",
            )

        from app.modules.profiles.models import DeceasedProfile

        dec_list: list[PlotDeceasedBrief] = []
        dec_ids = [s.current_deceased_id for s in plot.slots if s.current_deceased_id]
        if dec_ids:
            profiles = db.query(DeceasedProfile).filter(DeceasedProfile.deceased_id.in_(dec_ids)).all()
            for prof in profiles:
                matching_slot = next((s for s in plot.slots if s.current_deceased_id == prof.deceased_id), None)
                yob = prof.birth_year or (prof.date_of_birth.year if prof.date_of_birth else None)
                dec_list.append(
                    PlotDeceasedBrief(
                        deceased_id=prof.deceased_id,
                        deceased_code=prof.deceased_code,
                        full_name=prof.full_name,
                        birth_year=yob,
                        year_of_birth=yob,
                        date_of_death=prof.date_of_death,
                        hometown=prof.hometown,
                        slot_number=matching_slot.slot_number if matching_slot else None,
                        is_kim_tinh=plot.is_kim_tinh,
                    )
                )

        timeline: list[PlotTimelineEvent] = []

        # 1. Burials from BurialHistory
        from app.modules.documents.models import FileObject
        from app.modules.plots.models import BurialHistory

        burial_histories = db.query(BurialHistory).filter(BurialHistory.plot_id == plot.plot_id).all()
        for bh in burial_histories:
            dec = db.query(DeceasedProfile).filter(DeceasedProfile.deceased_id == bh.deceased_id).first()
            dec_name = dec.full_name if dec else f"Mã #{bh.deceased_id}"
            evs = []
            if bh.proof_file_id:
                fo = db.get(FileObject, bh.proof_file_id)
                evs.append(
                    MediaItemBrief(
                        evidence_id=bh.history_id,
                        file_id=bh.proof_file_id,
                        caption="Ảnh minh chứng an táng thực địa",
                        uploaded_at=bh.created_at,
                        file_name=fo.file_name if fo else None,
                        mime_type=fo.mime_type if fo else None,
                        download_url=f"/api/v1/documents/public/{bh.proof_file_id}",
                        media_url=f"/api/v1/documents/public/{bh.proof_file_id}",
                    )
                )
            bh_date = bh.action_date.date() if isinstance(bh.action_date, datetime) else bh.action_date
            b_title = f"Lễ An Táng: {dec_name}" if bh.action_type == "BURIED" else f"Cải Táng: {dec_name}"
            timeline.append(
                PlotTimelineEvent(
                    event_type="BURIAL" if bh.action_type == "BURIED" else "EXHUMATION",
                    title=b_title,
                    event_title=b_title,
                    event_date=bh_date,
                    status="COMPLETED",
                    description=bh.notes or f"Đã hoàn thành nghi thức an táng thực địa tại slot #{bh.slot_id or 1}",
                    slot_number=bh.slot_id,
                    evidences=evs,
                    media_evidences=evs,
                    is_kim_tinh=plot.is_kim_tinh,
                )
            )

        # 2. Construction Orders
        from app.modules.construction.models import ConstructionOrder

        c_orders = db.query(ConstructionOrder).filter(ConstructionOrder.plot_id == plot.plot_id).all()
        for co in c_orders:
            order_evs: list[MediaItemBrief] = []
            for t in co.tasks:
                for ev in t.evidences:
                    uploader_name = ev.uploader.full_name if ev.uploader else None
                    dl_url = f"/api/v1/documents/public/{ev.file_id}"
                    fo = ev.file_object
                    order_evs.append(
                        MediaItemBrief(
                            evidence_id=ev.evidence_id,
                            file_id=ev.file_id,
                            caption=ev.caption or t.task_name,
                            uploaded_at=ev.uploaded_at,
                            file_name=fo.file_name if fo else None,
                            mime_type=fo.mime_type if fo else None,
                            download_url=dl_url,
                            media_url=dl_url,
                            uploader_name=uploader_name,
                        )
                    )

            ev_date = co.actual_end_date or co.expected_end_date or co.created_at.date()
            if isinstance(ev_date, datetime):
                ev_date = ev_date.date()
            c_title = "Thi Công & Xây Dựng Lăng Mộ"
            c_supervisor = co.supervisor.full_name if co.supervisor else None
            timeline.append(
                PlotTimelineEvent(
                    event_type="CONSTRUCTION",
                    title=c_title,
                    event_title=c_title,
                    event_date=ev_date,
                    status=co.status,
                    description=co.notes or f"Tiến độ thi công đạt {co.overall_progress}% ({len(co.tasks)} hạng mục nghiệm thu)",
                    performed_by=c_supervisor,
                    executor_name=c_supervisor,
                    evidences=order_evs,
                    media_evidences=order_evs,
                    is_kim_tinh=plot.is_kim_tinh,
                )
            )

        # 3. Care Schedules
        from app.modules.care.models import CareSchedule

        care_schedules = db.query(CareSchedule).filter(CareSchedule.plot_id == plot.plot_id).all()
        for cs in care_schedules:
            care_evs: list[MediaItemBrief] = []
            for ev in cs.media_evidences:
                uploader_name = ev.uploaded_by.full_name if ev.uploaded_by else None
                c_dl_url = f"/api/v1/documents/public/{ev.file_id}" if ev.file_id else (ev.media_url or "")
                fo = db.get(FileObject, ev.file_id) if ev.file_id else None
                care_evs.append(
                    MediaItemBrief(
                        evidence_id=ev.evidence_id,
                        file_id=ev.file_id or "media",
                        caption=ev.caption or "Ảnh chăm sóc hiện trường",
                        uploaded_at=ev.uploaded_at,
                        file_name=fo.file_name if fo else None,
                        mime_type=fo.mime_type if fo else None,
                        download_url=c_dl_url,
                        media_url=c_dl_url,
                        uploader_name=uploader_name,
                    )
                )

            pkg_name = cs.package.package_name if cs.package else "Định kỳ"
            sc_date = cs.performed_date if cs.performed_date else cs.scheduled_date
            if isinstance(sc_date, datetime):
                sc_date = sc_date.date()

            caretaker_name = cs.caretaker.full_name if cs.caretaker else None
            completed_tasks = sum(1 for it in cs.checklist_items if it.is_completed)
            total_tasks = len(cs.checklist_items)
            desc = cs.notes or f"Gói: {pkg_name}. Hoàn tất {completed_tasks}/{total_tasks} đầu việc chăm sóc."
            care_title = f"Chăm Sóc Định Kỳ ({pkg_name})"

            timeline.append(
                PlotTimelineEvent(
                    event_type="CARE",
                    title=care_title,
                    event_title=care_title,
                    event_date=sc_date,
                    status=cs.status,
                    description=desc,
                    performed_by=caretaker_name,
                    executor_name=caretaker_name,
                    evidences=care_evs,
                    media_evidences=care_evs,
                    is_kim_tinh=plot.is_kim_tinh,
                )
            )

        # Sort timeline by event_date descending
        timeline.sort(key=lambda x: x.event_date, reverse=True)

        zone_n = plot.row.zone.zone_name if plot.row and plot.row.zone else ""
        row_c = plot.row.row_code if plot.row else ""
        guidance = f"Khu {zone_n} - Dãy {row_c} - Lô {plot.plot_code}"

        lat = float(plot.latitude) if plot.latitude is not None else None
        lng = float(plot.longitude) if plot.longitude is not None else None
        maps_url = f"https://www.google.com/maps/search/?api=1&query={lat},{lng}" if lat and lng else None

        dims = None
        if plot.plot_type and plot.plot_type.length and plot.plot_type.width:
            dims = f"{plot.plot_type.length}m x {plot.plot_type.width}m"

        return PlotTimelineResponse(
            plot_id=plot.plot_id,
            plot_code=plot.plot_code,
            zone_name=zone_n,
            row_code=row_c,
            type_name=plot.plot_type.type_name if plot.plot_type else "",
            status=plot.status,
            is_kim_tinh=plot.is_kim_tinh,
            is_locked=plot.is_locked,
            orientation=plot.orientation,
            dimensions=dims,
            latitude=lat,
            longitude=lng,
            navigation_guidance=guidance,
            walking_directions=guidance,
            maps_url=maps_url,
            deceased_list=dec_list,
            timeline=timeline,
            events=timeline,
        )
