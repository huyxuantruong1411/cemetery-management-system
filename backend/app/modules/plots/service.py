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
    PlotCreate,
    PlotDetailResponse,
    PlotListResponse,
    PlotReservationResponse,
    PlotReserveRequest,
    PlotSlotResponse,
    PlotStatsResponse,
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


class PlotService:
    # =========================================================================
    # 1. Zone Management
    # =========================================================================
    @staticmethod
    def list_zones(db: Session) -> List[ZoneResponse]:
        zones = db.query(Zone).order_by(Zone.zone_code).all()
        return [ZoneResponse.model_validate(z) for z in zones]

    @staticmethod
    def create_zone(db: Session, data: ZoneCreate) -> ZoneResponse:
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

    # =========================================================================
    # 2. Row Management
    # =========================================================================
    @staticmethod
    def list_rows(db: Session, zone_id: Optional[int] = None) -> List[RowResponse]:
        query = db.query(Row)
        if zone_id is not None:
            query = query.filter(Row.zone_id == zone_id)
        rows = query.order_by(Row.row_code).all()
        return [RowResponse.model_validate(r) for r in rows]

    @staticmethod
    def create_row(db: Session, data: RowCreate) -> RowResponse:
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
        # Update zone total_rows count
        zone.total_rows = db.query(Row).filter(Row.zone_id == zone.zone_id).count() + 1
        db.commit()
        db.refresh(row)
        return RowResponse.model_validate(row)

    @staticmethod
    def update_row(db: Session, row_id: int, data: RowUpdate) -> RowResponse:
        row = db.query(Row).filter(Row.row_id == row_id).first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy hàng mộ với ID {row_id}.",
            )
        if data.total_plots is not None:
            row.total_plots = data.total_plots
        db.commit()
        db.refresh(row)
        return RowResponse.model_validate(row)

    # =========================================================================
    # 3. Plot Type Management
    # =========================================================================
    @staticmethod
    def list_plot_types(db: Session) -> List[PlotTypeResponse]:
        types = db.query(PlotType).order_by(PlotType.type_name).all()
        return [PlotTypeResponse.model_validate(t) for t in types]

    @staticmethod
    def create_plot_type(db: Session, data: PlotTypeCreate) -> PlotTypeResponse:
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

    # =========================================================================
    # 4. Plot & Slot Lifecycle Management
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

        plots = query.order_by(Zone.zone_code, Row.row_code, Plot.plot_code).offset(skip).limit(limit).all()

        results = []
        for p in plots:
            owner_name = None
            if p.owner_id:
                owner = db.query(Customer).filter(Customer.customer_id == p.owner_id).first()
                if owner:
                    owner_name = owner.full_name

            # Find active reservation if any
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
        """Tạo mới ô mộ và tự động sinh slots theo cấu hình loại mộ (ACID transaction)."""
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
            is_kim_tinh=data.is_kim_tinh,
            is_locked=False,
            created_at=now,
            updated_at=now,
        )
        db.add(plot)
        db.flush()  # populate plot_id without committing

        # Automatically generate slots 1..default_slots in the same transaction
        for slot_num in range(1, pt.default_slots + 1):
            slot = PlotSlot(
                plot_id=plot.plot_id,
                slot_number=slot_num,
                status="EMPTY",
                current_deceased_id=None,
            )
            db.add(slot)

        # Update row total_plots count
        row.total_plots = db.query(Plot).filter(Plot.row_id == row.row_id).count() + 1

        db.commit()
        return PlotService.get_plot(db, plot.plot_id)

    @staticmethod
    def update_plot(db: Session, plot_id: int, data: PlotUpdate) -> PlotDetailResponse:
        plot = db.query(Plot).filter(Plot.plot_id == plot_id).first()
        if not plot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy ô mộ với ID {plot_id}.",
            )

        # Domain Invariant: Kim Tĩnh Immutability Guard
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

    # =========================================================================
    # 5. Anti-Double Booking Reservation (G04)
    # =========================================================================
    @staticmethod
    def reserve_plot(
        db: Session,
        plot_id: int,
        user_id: int,
        req: PlotReserveRequest,
    ) -> PlotReservationResponse:
        """Giữ chỗ ô đất độc quyền chống tranh chấp (Anti-Double Booking Concurrency)."""
        # Concurrency Lock: Lock the plot row for update
        plot = (
            db.query(Plot)
            .filter(Plot.plot_id == plot_id)
            .with_for_update()
            .first()
        )
        if not plot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy ô mộ với ID {plot_id}.",
            )

        now = datetime.now(timezone.utc)

        # 1. Check existing active reservation and expire if time passed
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
                # Expired automatically
                active_res.state = "EXPIRED"
                db.flush()
            else:
                # Still active -> Conflict!
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Ô mộ {plot.plot_code} đang có người giữ chỗ (hết hạn lúc {active_res.expires_at.strftime('%Y-%m-%d %H:%M')}). Vui lòng chọn ô khác!",
                )

        # 2. Check plot status
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

        # 3. Create active reservation
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

        # 4. Update plot status
        plot.status = "RESERVED"
        plot.updated_at = now

        db.commit()
        db.refresh(reservation)
        return PlotReservationResponse.model_validate(reservation)

    @staticmethod
    def cancel_reservation(db: Session, plot_id: int, user_id: int) -> dict:
        """Hủy giữ chỗ ô đất và trả lại trạng thái EMPTY_UNSOLD."""
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
        return {"message": f"Đã hủy giữ chỗ ô mộ {plot.plot_code} thành công.", "status": "EMPTY_UNSOLD"}

    # =========================================================================
    # 6. Statistics
    # =========================================================================
    @staticmethod
    def get_stats(db: Session) -> PlotStatsResponse:
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
