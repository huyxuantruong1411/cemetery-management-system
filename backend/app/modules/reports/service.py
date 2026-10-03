import hashlib
import json
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.storage.minio_adapter import storage_adapter

from app.modules.auth.models import User
from app.modules.care.models import CareChecklistItem, CareMediaEvidence, CareSchedule
from app.modules.construction.models import ConstructionOrder
from app.modules.contracts.models import Contract, ContractAnnex, LandPurchaseContract
from app.modules.documents.models import FileObject
from app.modules.finance.models import Payment
from app.modules.plots.models import Plot, PlotSlot, Row, Zone
from app.modules.reports.models import ReportExport
from app.modules.reports.schemas import (
    AnnexTypeItem,
    CareStats,
    ConstructionStats,
    ContractReportResponse,
    ContractStatusItem,
    ExpiringCareItem,
    OccupancyReportResponse,
    OperationsReportResponse,
    ReportExportRequest,
    ReportExportResponse,
    RevenueDrillDownItem,
    RevenueMethodItem,
    RevenuePeriodItem,
    RevenueReportResponse,
    ZoneOccupancyItem,
)
from app.services.excel_service import ExcelService
from app.services.pdf_service import PDFService


class ReportService:
    # =========================================================================
    # 1. Revenue Report (UC-7.1)
    # =========================================================================
    @classmethod
    def generate_revenue_report(
        cls,
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        payment_method: Optional[str] = None,
    ) -> RevenueReportResponse:
        """
        Aggregate revenue strictly from actual payments (realized revenue),
        NEVER from contracts.total_amount to avoid uncollected or discounted debts.
        """
        query = db.query(Payment)

        if start_date:
            query = query.filter(Payment.paid_at >= datetime.combine(start_date, datetime.min.time()))
        if end_date:
            query = query.filter(Payment.paid_at <= datetime.combine(end_date, datetime.max.time()))
        if payment_method:
            query = query.filter(Payment.payment_method == payment_method)

        payments = query.order_by(Payment.paid_at.desc()).all()

        total_rev = Decimal("0.00")
        method_totals: Dict[str, Decimal] = {}
        method_counts: Dict[str, int] = {}
        period_totals: Dict[str, Decimal] = {}
        period_counts: Dict[str, int] = {}
        drilldown_items: List[RevenueDrillDownItem] = []

        for p in payments:
            amt = Decimal(str(p.paid_amount))
            total_rev += amt

            # By method
            m = p.payment_method or "OTHER"
            method_totals[m] = method_totals.get(m, Decimal("0.00")) + amt
            method_counts[m] = method_counts.get(m, 0) + 1

            # By period (YYYY-MM)
            p_date = p.paid_at.date()
            p_key = p_date.strftime("%Y-%m")
            period_totals[p_key] = period_totals.get(p_key, Decimal("0.00")) + amt
            period_counts[p_key] = period_counts.get(p_key, 0) + 1

            # Drilldown info
            source_type = "OTHER"
            source_code = "N/A"
            customer_name = None

            if p.receivable:
                rec = p.receivable
                if rec.contract:
                    source_type = "CONTRACT"
                    source_code = rec.contract.contract_code
                    if rec.contract.customer:
                        customer_name = rec.contract.customer.full_name
                elif rec.annex:
                    source_type = "ANNEX"
                    source_code = rec.annex.annex_code
                    if rec.annex.contract and rec.annex.contract.customer:
                        customer_name = rec.annex.contract.customer.full_name
                if not customer_name and rec.customer:
                    customer_name = rec.customer.full_name

            payment_no = p.invoice.invoice_number if p.invoice else f"PT-{p.payment_id:06d}"

            drilldown_items.append(
                RevenueDrillDownItem(
                    payment_id=p.payment_id,
                    payment_no=payment_no,
                    payment_date=p.paid_at.strftime("%Y-%m-%d %H:%M"),
                    amount=amt,
                    payment_method=p.payment_method,
                    source_type=source_type,
                    source_code=source_code,
                    customer_name=customer_name,
                    notes=p.transaction_reference,
                )
            )

        total_tx = len(payments)
        avg_tx = (
            (total_rev / Decimal(total_tx)).quantize(Decimal("0.01"))
            if total_tx > 0
            else Decimal("0.00")
        )

        # Compile period items sorted chronologically
        by_period = [
            RevenuePeriodItem(
                period=k,
                total_amount=period_totals[k],
                transaction_count=period_counts[k],
                average_amount=(period_totals[k] / Decimal(period_counts[k])).quantize(
                    Decimal("0.01")
                ),
            )
            for k in sorted(period_totals.keys())
        ]

        # Compile method items
        by_method = [
            RevenueMethodItem(
                method=m,
                total_amount=method_totals[m],
                count=method_counts[m],
                percentage=round(float(method_totals[m] / total_rev * 100), 2)
                if total_rev > 0
                else 0.0,
            )
            for m in sorted(method_totals.keys())
        ]

        return RevenueReportResponse(
            total_revenue=total_rev,
            total_transactions=total_tx,
            average_transaction_value=avg_tx,
            start_date=start_date.isoformat() if start_date else None,
            end_date=end_date.isoformat() if end_date else None,
            by_period=by_period,
            by_method=by_method,
            drilldown_items=drilldown_items,
        )

    # =========================================================================
    # 2. Occupancy & Plot Report (UC-7.2)
    # =========================================================================
    @classmethod
    def generate_occupancy_report(
        cls,
        db: Session,
        zone_id: Optional[int] = None,
    ) -> OccupancyReportResponse:
        """
        Aggregate plot and slot occupancy rates by zone and cemetery-wide.
        Handles edge cases: empty zones (total_plots == 0) yield 0.0% occupancy.
        """
        zones_query = db.query(Zone)
        if zone_id:
            zones_query = zones_query.filter(Zone.zone_id == zone_id)
        zones = zones_query.order_by(Zone.zone_code).all()

        zone_items: List[ZoneOccupancyItem] = []
        overall_plots = 0
        overall_empty = 0
        overall_reserved = 0
        overall_owned_empty = 0
        overall_under_con = 0
        overall_occupied = 0
        overall_kim_tinh = 0
        overall_slots = 0
        overall_occupied_slots = 0

        for z in zones:
            plots = (
                db.query(Plot)
                .join(Row, Plot.row_id == Row.row_id)
                .filter(Row.zone_id == z.zone_id)
                .all()
            )
            total_p = len(plots)
            empty_p = sum(1 for p in plots if p.status == "EMPTY_UNSOLD")
            res_p = sum(1 for p in plots if p.status == "RESERVED")
            owned_empty_p = sum(1 for p in plots if p.status == "OWNED_EMPTY")
            con_p = sum(1 for p in plots if p.status == "UNDER_CONSTRUCTION")
            occ_p = sum(1 for p in plots if p.status == "OCCUPIED")
            kt_p = sum(1 for p in plots if getattr(p, "is_kim_tinh", False))

            # Slots query
            plot_ids = [p.plot_id for p in plots]
            total_s = 0
            occ_s = 0
            if plot_ids:
                slots = db.query(PlotSlot).filter(PlotSlot.plot_id.in_(plot_ids)).all()
                total_s = len(slots)
                occ_s = sum(1 for s in slots if s.status == "OCCUPIED")

            p_rate = round(occ_p / total_p * 100.0, 2) if total_p > 0 else 0.0
            s_rate = round(occ_s / total_s * 100.0, 2) if total_s > 0 else 0.0

            overall_plots += total_p
            overall_empty += empty_p
            overall_reserved += res_p
            overall_owned_empty += owned_empty_p
            overall_under_con += con_p
            overall_occupied += occ_p
            overall_kim_tinh += kt_p
            overall_slots += total_s
            overall_occupied_slots += occ_s

            zone_items.append(
                ZoneOccupancyItem(
                    zone_id=z.zone_id,
                    zone_code=z.zone_code,
                    zone_name=z.zone_name,
                    total_plots=total_p,
                    empty_plots=empty_p,
                    reserved_plots=res_p,
                    owned_empty_plots=owned_empty_p,
                    under_construction_plots=con_p,
                    occupied_plots=occ_p,
                    kim_tinh_plots=kt_p,
                    occupancy_rate=p_rate,
                    total_slots=total_s,
                    occupied_slots=occ_s,
                    slot_occupancy_rate=s_rate,
                )
            )

        overall_p_rate = (
            round(overall_occupied / overall_plots * 100.0, 2) if overall_plots > 0 else 0.0
        )
        overall_s_rate = (
            round(overall_occupied_slots / overall_slots * 100.0, 2) if overall_slots > 0 else 0.0
        )

        return OccupancyReportResponse(
            total_plots=overall_plots,
            total_empty=overall_empty,
            total_reserved=overall_reserved,
            total_owned_empty=overall_owned_empty,
            total_under_construction=overall_under_con,
            total_occupied=overall_occupied,
            total_kim_tinh=overall_kim_tinh,
            overall_occupancy_rate=overall_p_rate,
            total_slots=overall_slots,
            occupied_slots=overall_occupied_slots,
            slot_occupancy_rate=overall_s_rate,
            zones=zone_items,
        )

    # =========================================================================
    # 3. Contracts & Annexes Report (UC-7.3)
    # =========================================================================
    @classmethod
    def generate_contracts_report(
        cls,
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status_filter: Optional[str] = None,
    ) -> ContractReportResponse:
        """
        Aggregate contracts and annexes distinctly to prevent double-counting.
        Also surfaces expiring care annexes (within next 60 days).
        """
        # Land Purchase Contracts
        c_query = db.query(Contract).filter(Contract.contract_type == "LAND_PURCHASE")
        if start_date:
            c_query = c_query.filter(
                Contract.created_at >= datetime.combine(start_date, datetime.min.time())
            )
        if end_date:
            c_query = c_query.filter(
                Contract.created_at <= datetime.combine(end_date, datetime.max.time())
            )
        if status_filter:
            c_query = c_query.filter(Contract.status == status_filter)

        contracts = c_query.all()
        total_land_val = sum(
            (Decimal(str(c.total_amount or 0)) for c in contracts), Decimal("0.00")
        )

        status_counts: Dict[str, int] = {}
        status_values: Dict[str, Decimal] = {}
        for c in contracts:
            st = c.status
            status_counts[st] = status_counts.get(st, 0) + 1
            status_values[st] = status_values.get(st, Decimal("0.00")) + Decimal(
                str(c.total_amount or 0)
            )

        by_contract_status = [
            ContractStatusItem(status=st, count=status_counts[st], total_value=status_values[st])
            for st in sorted(status_counts.keys())
        ]

        # Contract Annexes
        a_query = db.query(ContractAnnex)
        if start_date:
            a_query = a_query.filter(
                ContractAnnex.created_at >= datetime.combine(start_date, datetime.min.time())
            )
        if end_date:
            a_query = a_query.filter(
                ContractAnnex.created_at <= datetime.combine(end_date, datetime.max.time())
            )

        annexes = a_query.all()
        total_annex_val = sum(
            (Decimal(str(a.additional_amount or 0)) for a in annexes), Decimal("0.00")
        )

        annex_counts: Dict[str, int] = {}
        annex_values: Dict[str, Decimal] = {}
        for a in annexes:
            at = a.annex_type
            annex_counts[at] = annex_counts.get(at, 0) + 1
            annex_values[at] = annex_values.get(at, Decimal("0.00")) + Decimal(
                str(a.additional_amount or 0)
            )

        by_annex_type = [
            AnnexTypeItem(annex_type=at, count=annex_counts[at], total_value=annex_values[at])
            for at in sorted(annex_counts.keys())
        ]

        # Expiring Care Annexes (active care annexes ending within next 60 days)
        today = date.today()
        sixty_days_later = today + timedelta(days=60)
        expiring_annexes = (
            db.query(ContractAnnex)
            .filter(
                ContractAnnex.annex_type == "CARE",
                ContractAnnex.status == "ACTIVE",
                ContractAnnex.valid_to.isnot(None),
                ContractAnnex.valid_to <= sixty_days_later,
            )
            .all()
        )

        expiring_items: List[ExpiringCareItem] = []
        for ea in expiring_annexes:
            cust_name = (
                ea.contract.customer.full_name if (ea.contract and ea.contract.customer) else "N/A"
            )
            plot_code = (
                ea.contract.land_purchase.plot.plot_code
                if (ea.contract and ea.contract.land_purchase and ea.contract.land_purchase.plot)
                else "N/A"
            )
            days_rem = (ea.valid_to - today).days if ea.valid_to else 0
            expiring_items.append(
                ExpiringCareItem(
                    annex_id=ea.annex_id,
                    annex_code=ea.annex_code,
                    customer_name=cust_name,
                    plot_code=plot_code,
                    end_date=ea.valid_to.isoformat() if ea.valid_to else "",
                    days_remaining=days_rem,
                )
            )

        return ContractReportResponse(
            total_land_contracts=len(contracts),
            total_land_value=total_land_val,
            total_annexes=len(annexes),
            total_annex_value=total_annex_val,
            by_contract_status=by_contract_status,
            by_annex_type=by_annex_type,
            expiring_care_annexes=expiring_items,
        )

    # =========================================================================
    # 4. Operations Report: Construction & Care (UC-7.4)
    # =========================================================================
    @classmethod
    def generate_operations_report(
        cls,
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> OperationsReportResponse:
        """
        Aggregate operational progress for field engineering and grave maintenance.
        """
        # Construction
        con_query = db.query(ConstructionOrder)
        if start_date:
            con_query = con_query.filter(
                ConstructionOrder.created_at >= datetime.combine(start_date, datetime.min.time())
            )
        if end_date:
            con_query = con_query.filter(
                ConstructionOrder.created_at <= datetime.combine(end_date, datetime.max.time())
            )

        orders = con_query.all()
        tot_orders = len(orders)
        pen_orders = sum(1 for o in orders if o.status == "PENDING")
        inp_orders = sum(1 for o in orders if o.status == "IN_PROGRESS")
        com_orders = sum(1 for o in orders if o.status == "COMPLETED")
        can_orders = sum(1 for o in orders if o.status == "CANCELLED")

        now_date = date.today()
        ovd_orders = sum(
            1
            for o in orders
            if o.status in ("PENDING", "IN_PROGRESS")
            and o.expected_end_date
            and o.expected_end_date < now_date
        )

        comp_rate = round(com_orders / tot_orders * 100.0, 2) if tot_orders > 0 else 0.0

        # Avg duration
        completed_durations = [
            (o.actual_end_date - o.start_date).days
            for o in orders
            if o.status == "COMPLETED" and o.start_date and o.actual_end_date
        ]
        avg_dur = (
            round(sum(completed_durations) / len(completed_durations), 1)
            if completed_durations
            else 0.0
        )

        con_stats = ConstructionStats(
            total_orders=tot_orders,
            pending_count=pen_orders,
            in_progress_count=inp_orders,
            completed_count=com_orders,
            cancelled_count=can_orders,
            overdue_count=ovd_orders,
            completion_rate=comp_rate,
            avg_duration_days=avg_dur,
        )

        # Care
        care_query = db.query(CareSchedule)
        if start_date:
            care_query = care_query.filter(
                CareSchedule.created_at >= datetime.combine(start_date, datetime.min.time())
            )
        if end_date:
            care_query = care_query.filter(
                CareSchedule.created_at <= datetime.combine(end_date, datetime.max.time())
            )

        schedules = care_query.all()
        tot_sch = len(schedules)
        sch_count = sum(1 for s in schedules if s.status == "SCHEDULED")
        asg_count = sum(1 for s in schedules if s.status == "ASSIGNED")
        inp_sch = sum(1 for s in schedules if s.status == "IN_PROGRESS")
        clo_sch = sum(1 for s in schedules if s.status == "CLOSED")
        ovd_sch = sum(
            1
            for s in schedules
            if s.status != "CLOSED" and s.scheduled_date and s.scheduled_date < now_date
        )

        close_rate = round(clo_sch / tot_sch * 100.0, 2) if tot_sch > 0 else 0.0

        # Checklist and evidence compliance
        sch_ids = [s.schedule_id for s in schedules]
        req_completed_rate = 0.0
        evid_comp_rate = 0.0

        if sch_ids:
            tasks = (
                db.query(CareChecklistItem).filter(CareChecklistItem.schedule_id.in_(sch_ids)).all()
            )
            req_tasks = [t for t in tasks if getattr(t, "is_required", True)]
            if req_tasks:
                req_done = sum(1 for t in req_tasks if t.is_completed)
                req_completed_rate = round(req_done / len(req_tasks) * 100.0, 2)

            evidences = (
                db.query(CareMediaEvidence).filter(CareMediaEvidence.schedule_id.in_(sch_ids)).all()
            )
            sch_with_evidence = len(set(e.schedule_id for e in evidences))
            evid_comp_rate = round(sch_with_evidence / tot_sch * 100.0, 2) if tot_sch > 0 else 0.0

        care_stats = CareStats(
            total_schedules=tot_sch,
            scheduled_count=sch_count,
            assigned_count=asg_count,
            in_progress_count=inp_sch,
            closed_count=clo_sch,
            overdue_count=ovd_sch,
            close_rate=close_rate,
            required_tasks_completed_rate=req_completed_rate,
            evidence_compliance_rate=evid_comp_rate,
        )

        return OperationsReportResponse(construction=con_stats, care=care_stats)

    # =========================================================================
    # 5. Persistent Report Export & ACL (UC-7.5 & G17)
    # =========================================================================
    @classmethod
    def create_export(
        cls,
        db: Session,
        user: User,
        req: ReportExportRequest,
    ) -> ReportExportResponse:
        """
        Generate and persist a report snapshot as PDF or XLSX in MinIO with strict ACL.
        """
        rtype = req.report_type.upper()
        rformat = req.export_format.upper()
        if rtype not in ("REVENUE", "OCCUPANCY", "CONTRACTS", "OPERATIONS"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Loại báo cáo không hợp lệ: {rtype}",
            )
        if rformat not in ("PDF", "XLSX"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Định dạng xuất không hợp lệ: {rformat}",
            )

        # Generate sequence-based export code
        res_seq = db.execute(text("SELECT NEXT VALUE FOR seq_report_export_number")).scalar()
        seq_num = res_seq if res_seq is not None else int(datetime.now().timestamp())
        now = datetime.now()
        export_code = f"EXP-{now.strftime('%Y%m')}-{seq_num:04d}"

        # Parse date filters if any
        start_d = None
        end_d = None
        if req.filter_params.get("start_date"):
            start_d = date.fromisoformat(req.filter_params["start_date"])
        if req.filter_params.get("end_date"):
            end_d = date.fromisoformat(req.filter_params["end_date"])

        headers: List[str] = []
        rows: List[List[Any]] = []
        kpis: List[Tuple[str, str]] = []
        report_title = ""
        record_count = 0

        # Build specific report data
        if rtype == "REVENUE":
            rep = cls.generate_revenue_report(db, start_date=start_d, end_date=end_d)
            report_title = "Báo Cáo Doanh Thu Thực Tế"
            kpis = [
                ("Tổng Thực Thu", f"{rep.total_revenue:,.0f} đ".replace(",", ".")),
                ("Số Giao Dịch", f"{rep.total_transactions}"),
                ("Giá Trị TB", f"{rep.average_transaction_value:,.0f} đ".replace(",", ".")),
            ]
            headers = [
                "Mã Phiếu Thu",
                "Ngày Thu",
                "Số Tiền",
                "Phương Thức",
                "Nguồn",
                "Mã Nguồn",
                "Khách Hàng",
            ]
            for item in rep.drilldown_items:
                rows.append(
                    [
                        item.payment_no,
                        item.payment_date,
                        f"{item.amount:,.0f} đ".replace(",", "."),
                        item.payment_method,
                        item.source_type,
                        item.source_code,
                        item.customer_name or "N/A",
                    ]
                )
            record_count = len(rep.drilldown_items)

        elif rtype == "OCCUPANCY":
            rep = cls.generate_occupancy_report(db)
            report_title = "Báo Cáo Tỷ Lệ Lấp Đầy & Mộ Phần"
            kpis = [
                ("Tổng Số Ô Mộ", f"{rep.total_plots}"),
                ("Đã An Táng", f"{rep.total_occupied}"),
                ("Tỷ Lệ Lấp Đầy", f"{rep.overall_occupancy_rate}%"),
                ("Mộ Kim Tĩnh", f"{rep.total_kim_tinh}"),
            ]
            headers = [
                "Mã Khu",
                "Tên Khu",
                "Tổng Ô",
                "Trống",
                "Giữ Chỗ",
                "Đã Mua",
                "Thi Công",
                "Đã An Táng",
                "Tỷ Lệ (%)",
            ]
            for z in rep.zones:
                rows.append(
                    [
                        z.zone_code,
                        z.zone_name,
                        z.total_plots,
                        z.empty_plots,
                        z.reserved_plots,
                        z.owned_empty_plots,
                        z.under_construction_plots,
                        z.occupied_plots,
                        f"{z.occupancy_rate}%",
                    ]
                )
            record_count = len(rep.zones)

        elif rtype == "CONTRACTS":
            rep = cls.generate_contracts_report(db, start_date=start_d, end_date=end_d)
            report_title = "Báo Cáo Hợp Đồng & Phụ Lục"
            kpis = [
                ("Tổng HĐ Đất", f"{rep.total_land_contracts}"),
                ("Giá Trị Đất", f"{rep.total_land_value:,.0f} đ".replace(",", ".")),
                ("Tổng Phụ Lục", f"{rep.total_annexes}"),
                ("Giá Trị Phụ Lục", f"{rep.total_annex_value:,.0f} đ".replace(",", ".")),
            ]
            headers = ["Loại Văn Bản / Phụ Lục", "Số Lượng", "Tổng Giá Trị"]
            for cs in rep.by_contract_status:
                rows.append(
                    [
                        f"HĐ Đất ({cs.status})",
                        cs.count,
                        f"{cs.total_value:,.0f} đ".replace(",", "."),
                    ]
                )
            for an in rep.by_annex_type:
                rows.append(
                    [
                        f"Phụ Lục ({an.annex_type})",
                        an.count,
                        f"{an.total_value:,.0f} đ".replace(",", "."),
                    ]
                )
            record_count = len(rows)

        elif rtype == "OPERATIONS":
            rep = cls.generate_operations_report(db, start_date=start_d, end_date=end_d)
            report_title = "Báo Cáo Vận Hành Thi Công & Chăm Sóc"
            kpis = [
                ("Lệnh Thi Công", f"{rep.construction.total_orders}"),
                ("HT Thi Công", f"{rep.construction.completion_rate}%"),
                ("Ca Chăm Sóc", f"{rep.care.total_schedules}"),
                ("Đã Đóng Ca", f"{rep.care.close_rate}%"),
            ]
            headers = ["Chỉ Số Vận Hành", "Giá Trị"]
            rows = [
                ["Thi công: Tổng lệnh", rep.construction.total_orders],
                ["Thi công: Đang thực hiện", rep.construction.in_progress_count],
                ["Thi công: Đã hoàn tất", rep.construction.completed_count],
                ["Thi công: Quá hạn", rep.construction.overdue_count],
                ["Thi công: Tỷ lệ hoàn thành", f"{rep.construction.completion_rate}%"],
                ["Chăm sóc: Tổng ca", rep.care.total_schedules],
                ["Chăm sóc: Đã đóng ca", rep.care.closed_count],
                ["Chăm sóc: Quá hạn", rep.care.overdue_count],
                ["Chăm sóc: Tỷ lệ đóng ca", f"{rep.care.close_rate}%"],
                ["Chăm sóc: Hạng mục bắt buộc đạt", f"{rep.care.required_tasks_completed_rate}%"],
                ["Chăm sóc: Tỷ lệ có ảnh minh chứng", f"{rep.care.evidence_compliance_rate}%"],
            ]
            record_count = len(rows)

        # Generate binary content
        file_bytes: bytes
        content_type: str
        extension: str

        subtitle = f"Kỳ trích xuất: {start_d or 'Toàn thời gian'} đến {end_d or 'Hiện tại'}"

        if rformat == "XLSX":
            file_bytes = ExcelService.generate_report_xlsx(
                sheet_title=rtype,
                headers=headers,
                rows=rows,
            )
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            extension = "xlsx"
        else:
            file_bytes = PDFService.generate_report_pdf(
                report_title=report_title,
                subtitle=subtitle,
                kpi_cards=kpis,
                headers=headers,
                rows=[[str(cell) for cell in r] for r in rows],
                generated_by=user.full_name or user.username,
            )
            content_type = "application/pdf"
            extension = "pdf"

        sha256_hash = hashlib.sha256(file_bytes).hexdigest()
        file_id = f"report_{export_code.lower()}_{sha256_hash[:8]}"
        object_key = f"reports/{export_code}.{extension}"

        # Upload to MinIO
        storage_adapter.put_object(
            object_key=object_key,
            data=file_bytes,
            content_type=content_type,
        )

        # Register FileObject
        file_obj = FileObject(
            file_id=file_id,
            bucket_name=storage_adapter.bucket,
            object_key=object_key,
            file_name=f"{export_code}.{extension}",
            file_size_bytes=len(file_bytes),
            mime_type=content_type,
            sha256_hash=sha256_hash,
            state="READY",
            uploaded_by_user_id=user.user_id,
        )
        db.add(file_obj)

        # Register ReportExport
        export_rec = ReportExport(
            export_code=export_code,
            report_type=rtype,
            export_format=rformat,
            filter_snapshot=json.dumps(req.filter_params, ensure_ascii=False),
            requester_id=user.user_id,
            file_id=file_id,
            status="COMPLETED",
            record_count=record_count,
            file_size_bytes=len(file_bytes),
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        )
        db.add(export_rec)
        db.commit()
        db.refresh(export_rec)

        return ReportExportResponse.model_validate(export_rec)

    @classmethod
    def list_exports(
        cls,
        db: Session,
        user: User,
        limit: int = 50,
    ) -> List[ReportExportResponse]:
        """List report exports with ACL (requester only, or all for ADMIN/reports:export)."""
        query = db.query(ReportExport)
        has_admin_access = any(r.role_name.upper() == "ADMIN" for r in user.roles) or any(
            p.action == "export" and p.resource == "reports"
            for r in user.roles
            for p in r.permissions
        )
        if not has_admin_access:
            query = query.filter(ReportExport.requester_id == user.user_id)

        exports = query.order_by(ReportExport.created_at.desc()).limit(limit).all()
        return [ReportExportResponse.model_validate(e) for e in exports]

    @classmethod
    def download_export(
        cls,
        db: Session,
        user: User,
        export_id: int,
    ) -> Tuple[bytes, str, str]:
        """
        Download export file with strict ACL check: 403 Forbidden if not authorized.
        """
        export_rec = db.query(ReportExport).filter_by(export_id=export_id).first()
        if not export_rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bản xuất báo cáo"
            )

        has_access = (
            (export_rec.requester_id == user.user_id)
            or any(r.role_name.upper() == "ADMIN" for r in user.roles)
            or any(
                p.action == "export" and p.resource == "reports"
                for r in user.roles
                for p in r.permissions
            )
        )
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền tải bản xuất báo cáo này",
            )

        if not export_rec.file_id or not export_rec.file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Tệp báo cáo chưa sẵn sàng"
            )

        content, content_type = storage_adapter.get_object(export_rec.file.object_key)
        filename = export_rec.file.file_name or f"{export_rec.export_code}.bin"
        return content, content_type, filename
