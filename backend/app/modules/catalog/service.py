from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.modules.care.models import CarePackage
from app.modules.catalog.models import PriceItem, PriceList
from app.modules.catalog.schemas import (
    CarePackageCreate,
    CarePackageUpdate,
    ContractTemplateCreate,
    ContractTemplateUpdate,
    PriceItemCreate,
    PriceItemUpdate,
    PriceListCreate,
    PriceListUpdate,
    PriceLookupRequest,
    PriceLookupResponse,
)
from app.modules.contracts.models import ContractTemplate


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class CatalogService:
    # =========================================================================
    # 1. Price Lists
    # =========================================================================
    @staticmethod
    def check_price_list_overlap(
        db: Session,
        from_date: date,
        to_date: Optional[date],
        exclude_id: Optional[int] = None,
    ) -> None:
        """Kiểm tra overlap thời gian hiệu lực giữa các bảng giá đang hoạt động (G03)."""
        query = db.query(PriceList).filter(PriceList.is_active == True)  # noqa: E712
        if exclude_id is not None:
            query = query.filter(PriceList.price_list_id != exclude_id)

        existing_lists = query.all()
        for pl in existing_lists:
            # Hai khoảng [A, B] và [C, D] giao nhau nếu A <= D (hoặc D is None) và B >= C (hoặc B is None)
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
        query = db.query(PriceList).order_by(PriceList.effective_from_date.desc())
        if active_only:
            query = query.filter(PriceList.is_active == True)  # noqa: E712
        return query.all()

    @staticmethod
    def get_price_list(db: Session, price_list_id: int) -> PriceList:
        pl = db.query(PriceList).filter(PriceList.price_list_id == price_list_id).first()
        if not pl:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy bảng giá với ID {price_list_id}",
            )
        return pl

    @staticmethod
    def create_price_list(db: Session, data: PriceListCreate) -> PriceList:
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
    def update_price_list(db: Session, price_list_id: int, data: PriceListUpdate) -> PriceList:
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
    # 2. Price Items
    # =========================================================================
    @staticmethod
    def add_price_item(db: Session, data: PriceItemCreate) -> PriceItem:
        # Verify price list exists
        _ = CatalogService.get_price_list(db, data.price_list_id)

        # Check item code duplicate in same price list
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
        item = db.query(PriceItem).filter(PriceItem.item_id == item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy khoản mục giá với ID {item_id}",
            )
        db.delete(item)
        db.commit()

    # =========================================================================
    # 3. Price Lookup Simulation (Tra cứu giá theo scope & ngày)
    # =========================================================================
    @staticmethod
    def lookup_price(db: Session, req: PriceLookupRequest) -> PriceLookupResponse:
        target_date = req.target_date or date.today()

        # Tìm bảng giá đang kích hoạt có hiệu lực vào ngày target_date
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

        # Tìm kiếm khoản mục khớp nhất theo thứ tự ưu tiên scope
        items_query = db.query(PriceItem).filter(
            PriceItem.price_list_id == active_list.price_list_id
        )

        matched_item: Optional[PriceItem] = None

        if req.package_id:
            matched_item = items_query.filter(PriceItem.package_id == req.package_id).first()

        if not matched_item and req.zone_id and req.plot_type_id:
            matched_item = items_query.filter(
                PriceItem.zone_id == req.zone_id,
                PriceItem.plot_type_id == req.plot_type_id,
            ).first()

        if not matched_item and req.plot_type_id:
            matched_item = items_query.filter(
                PriceItem.plot_type_id == req.plot_type_id,
                PriceItem.zone_id.is_(None),
            ).first()

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
    # 4. Care Packages (CRUD & Inactive invariant)
    # =========================================================================
    @staticmethod
    def list_care_packages(db: Session, active_only: bool = False) -> List[CarePackage]:
        query = db.query(CarePackage).order_by(CarePackage.package_code.asc())
        if active_only:
            query = query.filter(CarePackage.is_active == True)  # noqa: E712
        return query.all()

    @staticmethod
    def get_care_package(db: Session, package_id: int, ensure_active: bool = False) -> CarePackage:
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

    # =========================================================================
    # 5. Contract Templates (4 mã chuẩn, versioning không hồi tố)
    # =========================================================================
    @staticmethod
    def list_contract_templates(db: Session, active_only: bool = False) -> List[ContractTemplate]:
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
        """Tăng số hiệu phiên bản điều khoản mà không làm biến động các hợp đồng cũ (Không hồi tố - G03)."""
        tmpl = CatalogService.get_contract_template(db, template_id)

        if data.template_name is not None:
            tmpl.template_name = data.template_name
        if data.content_html is not None:
            tmpl.content_html = data.content_html
            tmpl.version_no += 1  # Tăng số phiên bản điều khoản
        if data.required_documents_json is not None:
            tmpl.required_documents_json = data.required_documents_json
        if data.is_active is not None:
            tmpl.is_active = data.is_active

        tmpl.updated_at = _utc_now_naive()
        db.commit()
        db.refresh(tmpl)
        return tmpl
