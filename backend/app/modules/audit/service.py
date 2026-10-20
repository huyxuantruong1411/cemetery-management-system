import json
from datetime import date, datetime
from typing import Any, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.audit.models import AuditLog
from app.modules.audit.schemas import AuditLogResponse, AuditSummaryResponse

SENSITIVE_KEYS = {
    "password",
    "password_hash",
    "hashed_password",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "jwt_secret",
}


def redact_sensitive_json(raw_json: Any) -> Any:
    """Redact sensitive fields from audit payload to prevent security leakage."""
    if not raw_json:
        return raw_json
    try:
        is_dict = isinstance(raw_json, dict)
        data = raw_json if is_dict else json.loads(raw_json)
        if isinstance(data, dict):
            redacted = {}
            for k, v in data.items():
                if any(s in str(k).lower() for s in SENSITIVE_KEYS):
                    redacted[k] = "***REDACTED***"
                elif isinstance(v, dict):
                    redacted[k] = redact_sensitive_json(v)
                else:
                    redacted[k] = v
            return redacted if is_dict else json.dumps(redacted, ensure_ascii=False)
        return raw_json
    except Exception:
        return raw_json


def _format_vnd(amount: Any) -> str:
    """Format currency amount as Vietnamese Dong string."""
    if amount is None or amount == "" or str(amount).lower() == "none":
        return "0 đ"
    try:
        val = float(amount)
        return f"{val:,.0f} đ".replace(",", ".")
    except Exception:
        return f"{amount} đ"


CONTRACT_TYPE_LABELS = {
    "LAND_PURCHASE": "Mua đất sinh phần",
    "BURIAL": "An táng",
    "EXHUMATION": "Cải táng / Bốc mộ",
    "TRANSFER": "Chuyển nhượng quyền sử dụng",
    "CREMATION": "Dịch vụ hỏa táng",
    "CARE": "Chăm sóc mộ định kỳ",
    "CONSTRUCTION": "Thi công xây dựng mộ",
}

PAYMENT_METHOD_LABELS = {
    "CASH": "Tiền mặt",
    "BANK_TRANSFER": "Chuyển khoản ngân hàng",
    "CREDIT_CARD": "Thẻ tín dụng",
}

STATUS_LABELS = {
    "DRAFT": "Bản nháp (DRAFT)",
    "PENDING_SIGN": "Chờ ký duyệt (PENDING_SIGN)",
    "ACTIVE": "Đang hiệu lực (ACTIVE)",
    "CANCELLED": "Đã hủy bỏ (CANCELLED)",
    "COMPLETED": "Hoàn tất (COMPLETED)",
    "CLOSED": "Đã đóng nghiệm thu (CLOSED)",
    "PAID": "Đã tất toán (PAID)",
    "PARTIALLY_PAID": "Thanh toán một phần (PARTIALLY_PAID)",
    "UNPAID": "Chưa thanh toán (UNPAID)",
}

FIELD_LABELS_VN = {
    "full_name": "Họ và tên",
    "phone_number": "Số điện thoại",
    "email": "Email",
    "address": "Địa chỉ liên hệ",
    "date_of_birth": "Ngày sinh",
    "date_of_death": "Ngày mất",
    "birth_year": "Năm sinh",
    "hometown": "Quê quán",
    "religion": "Tôn giáo",
    "citizen_id": "Số CCCD",
    "notes": "Ghi chú",
}


class AuditService:
    @classmethod
    def generate_audit_narrative(
        cls,
        entry: AuditLog,
        username: Optional[str] = None,
    ) -> str:
        """
        Generate human-readable, executive explanation for an audit log record in natural Vietnamese.
        Covers all combinations of actions, target entities, and state diffs.
        """
        actor = f"Tài khoản {username}" if username else "Hệ thống"
        target_entity = entry.target_entity or "Bản ghi"
        target_id = entry.target_id or ""
        action_type = entry.action_type or ""

        # Parse payloads safely
        post: dict = {}
        if entry.post_change_values:
            try:
                post = json.loads(entry.post_change_values) if isinstance(entry.post_change_values, str) else entry.post_change_values
            except Exception:
                post = {}

        # -------------------------------------------------------------
        # 1. CONTRACTS (Hợp đồng)
        # -------------------------------------------------------------
        if target_entity == "Contract":
            code = post.get("contract_code") or f"#{target_id}"
            if action_type == "CREATE":
                ctype = post.get("contract_type")
                if ctype == "CREMATION":
                    fee = _format_vnd(post.get("service_fee", 0))
                    dec_id = post.get("deceased_id")
                    dec_str = f" cho người mất #{dec_id}" if dec_id else ""
                    return f"{actor} đã lập Hợp đồng dịch vụ hỏa táng {code}{dec_str} với mức phí {fee}."
                elif ctype == "TRANSFER":
                    p_id = post.get("plot_id", "--")
                    s_id = post.get("seller_id", "--")
                    b_id = post.get("buyer_id", "--")
                    return f"{actor} đã lập Hợp đồng chuyển nhượng quyền sử dụng {code} (Ô mộ #{p_id}) từ khách hàng #{s_id} sang khách hàng #{b_id}."
                elif ctype == "EXHUMATION":
                    p_id = post.get("plot_id", "--")
                    s_id = post.get("slot_id", "--")
                    fee = _format_vnd(post.get("exhumation_fee", 0))
                    return f"{actor} đã lập Hợp đồng dịch vụ cải táng {code} (Ô #{p_id}, Huyệt #{s_id}) với mức phí {fee}."
                else:
                    amt = _format_vnd(post.get("total_amount", 0))
                    cust_id = post.get("customer_id")
                    cust_str = f"Khách hàng #{cust_id}, " if cust_id else ""
                    plot_id = post.get("plot_id")
                    plot_str = f"Ô mộ #{plot_id}" if plot_id else f"Hồ sơ #{target_id}"
                    return f"{actor} đã lập Hợp đồng mua đất sinh phần {code} ({cust_str}{plot_str}) với tổng giá trị {amt}."

            elif action_type == "SUBMIT_FOR_SIGNING":
                return f"{actor} đã chuyển hồ sơ hợp đồng {code} sang trạng thái Chờ ký duyệt (PENDING_SIGN)."

            elif action_type == "ACTIVATE":
                ctype_raw = post.get("contract_type", "")
                ctype_vn = CONTRACT_TYPE_LABELS.get(ctype_raw, "")
                ctype_prefix = f" {ctype_vn}" if ctype_vn else ""
                signed_at = post.get("signed_at", "")
                sign_str = f" vào ngày {signed_at}" if signed_at else ""
                file_id = post.get("signed_scan_file_id")
                file_str = f" (Mã lưu trữ bản scan: {file_id[:8]}...)" if file_id else ""
                return f"{actor} đã hoàn tất nghiệm thu và kích hoạt hiệu lực Hợp đồng{ctype_prefix} {code}{sign_str}{file_str}."

            elif action_type == "CANCEL":
                reason = post.get("reason") or "Không nêu lý do"
                return f"{actor} đã hủy bỏ hợp đồng {code}. Lý do: \"{reason}\"."

        # -------------------------------------------------------------
        # 2. CONTRACT ANNEXES (Phụ lục hợp đồng)
        # -------------------------------------------------------------
        elif target_entity == "ContractAnnex":
            code = post.get("annex_code") or f"#{target_id}"
            if action_type == "CREATE_ANNEX":
                kt = "quy cách Kim Tĩnh" if post.get("is_kim_tinh") else "an táng thông thường"
                c_id = post.get("contract_id", "--")
                p_id = post.get("plot_id", "--")
                s_id = post.get("slot_id", "--")
                return f"{actor} đã tạo phụ lục an táng {code} (HĐ #{c_id}, Ô #{p_id}, Huyệt #{s_id}, {kt})."

            elif action_type == "ACTIVATE_ANNEX":
                kt = "quy cách Kim Tĩnh" if post.get("is_kim_tinh") else "an táng thông thường"
                p_id = post.get("plot_id", "--")
                s_id = post.get("slot_id", "--")
                future = " (an táng tương lai)" if post.get("is_future_burial") else ""
                return f"{actor} đã duyệt kích hoạt phụ lục an táng {code}, cập nhật huyệt #{s_id} tại ô #{p_id} ({kt}){future}."

            elif action_type == "CREATE_CONSTRUCTION_ANNEX":
                amt = _format_vnd(post.get("additional_amount", 0))
                p_id = post.get("plot_id", "--")
                start_d = post.get("estimated_start_date", "--")
                end_d = post.get("estimated_end_date", "--")
                return f"{actor} đã lập phụ lục thi công xây dựng {code} cho ô #{p_id} (Thời gian: {start_d} -> {end_d}, chi phí: {amt})."

            elif action_type == "ACTIVATE_CONSTRUCTION_ANNEX":
                return f"{actor} đã duyệt và kích hoạt phụ lục thi công xây dựng {code}."

            elif action_type == "CREATE_CARE_ANNEX":
                amt = _format_vnd(post.get("additional_amount", 0))
                pkg_id = post.get("package_id", "--")
                cycles = post.get("cycle_months", "--")
                rec_price = _format_vnd(post.get("recurring_price", 0))
                return f"{actor} đã lập phụ lục dịch vụ chăm sóc {code} (Gói #{pkg_id}, chu kỳ {cycles} tháng, giá định kỳ: {rec_price}, tổng: {amt})."

            elif action_type == "ACTIVATE_CARE_ANNEX":
                return f"{actor} đã duyệt kích hoạt phụ lục dịch vụ chăm sóc định kỳ {code}."

            elif action_type == "CONFIRM_BURIAL":
                return f"{actor} đã xác nhận hoàn tất thủ tục hạ huyệt / an táng theo phụ lục {code}."

        # -------------------------------------------------------------
        # 3. RECEIVABLES (Công nợ phải thu)
        # -------------------------------------------------------------
        elif target_entity == "receivables":
            if action_type == "CREATE":
                amt = _format_vnd(post.get("original_amount", 0))
                c_id = post.get("contract_id")
                a_id = post.get("annex_id")
                assoc = []
                if c_id:
                    assoc.append(f"HĐ #{c_id}")
                if a_id:
                    assoc.append(f"Phụ lục #{a_id}")
                assoc_str = f" ({', '.join(assoc)})" if assoc else ""
                return f"{actor} đã ghi nhận khoản phải thu mới #{target_id} trị giá {amt}{assoc_str}."

            elif action_type == "DISCOUNT_APPLY":
                dtype_raw = post.get("discount_type")
                is_fixed = dtype_raw == "FIXED_AMOUNT"
                dtype_str = "giảm cố định" if is_fixed else "chiết khấu %"
                dval = _format_vnd(post.get("discount_value", 0)) if is_fixed else f"{post.get('discount_value')}%"
                new_amt = _format_vnd(post.get("final_payable_amount", 0))
                reason = post.get("reason", "--")
                return f"{actor} đã áp dụng chính sách {dtype_str} ({dval}) cho công nợ #{target_id}. Số tiền phải nộp sau điều chỉnh là {new_amt}. Lý do: \"{reason}\"."

        # -------------------------------------------------------------
        # 4. PAYMENTS (Giao dịch thu tiền)
        # -------------------------------------------------------------
        elif target_entity == "payments":
            if action_type == "PAYMENT_RECORD":
                amt = _format_vnd(post.get("paid_amount", 0))
                m_raw = post.get("payment_method", "CASH")
                method = PAYMENT_METHOD_LABELS.get(m_raw, m_raw)
                inv = post.get("invoice_number", "--")
                rec_id = post.get("receivable_id", "--")
                status_raw = post.get("new_receivable_status", "")
                status_str = STATUS_LABELS.get(status_raw, status_raw)
                return f"{actor} đã ghi nhận thanh toán thành công {amt} cho công nợ #{rec_id} qua {method} (Phiếu thu: {inv}). Trạng thái công nợ: {status_str}."

        # -------------------------------------------------------------
        # 5. CONSTRUCTION ORDERS (Lệnh thi công công trình)
        # -------------------------------------------------------------
        elif target_entity == "ConstructionOrder":
            if action_type == "CREATE":
                p_id = post.get("plot_id", "--")
                s_id = post.get("supervisor_id", "--")
                warn = post.get("conflict_warning")
                warn_str = f" (Lưu ý: {warn})" if warn else ""
                return f"{actor} đã khởi tạo lệnh thi công #{target_id} cho ô mộ #{p_id}, phân công giám sát viên #{s_id}{warn_str}."

            elif action_type == "START":
                d_str = post.get("actual_start_date", "--")
                return f"{actor} đã khởi công công trình thi công #{target_id} vào ngày {d_str}."

            elif action_type == "COMPLETE":
                d_str = post.get("actual_end_date", "--")
                return f"{actor} đã nghiệm thu và hoàn tất bàn giao công trình thi công #{target_id} vào ngày {d_str}."

        # -------------------------------------------------------------
        # 6. CARE SCHEDULES (Lịch chăm sóc dịch vụ)
        # -------------------------------------------------------------
        elif target_entity == "care_schedules":
            if action_type == "ASSIGN_CARETAKER":
                c_id = post.get("caretaker_id", "--")
                return f"{actor} đã phân công nhân viên quản trang #{c_id} phụ trách ca chăm sóc mộ #{target_id}."

            elif action_type == "CLOSE_CARE_SCHEDULE":
                u_id = post.get("completed_by_id", "--")
                return f"{actor} đã nghiệm thu và đóng ca chăm sóc #{target_id} (Xác nhận bởi nhân sự #{u_id})."

        # -------------------------------------------------------------
        # 7. PROFILES (Khách hàng & Người mất)
        # -------------------------------------------------------------
        elif target_entity in ("Customer", "customer_profiles"):
            if action_type == "CREATE":
                name = post.get("full_name") or f"#{target_id}"
                return f"{actor} đã tạo mới hồ sơ khách hàng {name} (#{target_id})."
            elif action_type == "UPDATE":
                fields = [FIELD_LABELS_VN.get(k, k) for k in post.keys()] if post else []
                field_str = f" ({', '.join(fields)})" if fields else ""
                return f"{actor} đã cập nhật thông tin hồ sơ khách hàng #{target_id}{field_str}."

        elif target_entity in ("DeceasedProfile", "deceased_profiles"):
            if action_type == "CREATE":
                name = post.get("full_name") or f"#{target_id}"
                return f"{actor} đã đăng ký hồ sơ người mất mới {name} (#{target_id})."
            elif action_type == "UPDATE":
                fields = [FIELD_LABELS_VN.get(k, k) for k in post.keys()] if post else []
                field_str = f" ({', '.join(fields)})" if fields else ""
                return f"{actor} đã cập nhật hồ sơ người mất #{target_id}{field_str}."

        # -------------------------------------------------------------
        # 8. PLOTS (Ô mộ)
        # -------------------------------------------------------------
        elif target_entity in ("Plot", "plots"):
            if action_type in ("UPDATE", "STATUS_CHANGE"):
                st = post.get("status")
                st_str = f" sang trạng thái {st}" if st else ""
                return f"{actor} đã cập nhật ô mộ #{target_id}{st_str}."

        # -------------------------------------------------------------
        # 9. FALLBACK (Cho bất kỳ tổ hợp nào khác)
        # -------------------------------------------------------------
        return f"{actor} đã thực hiện thao tác '{action_type}' trên đối tượng {target_entity} #{target_id}."

    @classmethod
    def list_logs(
        cls,
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        user_id: Optional[int] = None,
        action_type: Optional[str] = None,
        target_entity: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AuditLogResponse]:
        """
        Query system audit logs with filtering, automated secret redaction, and humanized narrative.
        NOTE: This is strictly READ-ONLY. No mutation or deletion allowed.
        """
        query = db.query(AuditLog)

        if start_date:
            query = query.filter(
                AuditLog.timestamp >= datetime.combine(start_date, datetime.min.time())
            )
        if end_date:
            query = query.filter(
                AuditLog.timestamp <= datetime.combine(end_date, datetime.max.time())
            )
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        if action_type:
            query = query.filter(AuditLog.action_type == action_type)
        if target_entity:
            query = query.filter(AuditLog.target_entity == target_entity)
        if search:
            query = query.filter(AuditLog.target_id.ilike(f"%{search}%"))

        logs = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()

        results: List[AuditLogResponse] = []
        for entry in logs:
            username = entry.user.username if entry.user else None
            narrative = cls.generate_audit_narrative(entry, username=username)
            results.append(
                AuditLogResponse(
                    log_id=entry.log_id,
                    user_id=entry.user_id,
                    username=username,
                    action_type=entry.action_type,
                    target_entity=entry.target_entity,
                    target_id=entry.target_id,
                    pre_change_values=redact_sensitive_json(entry.pre_change_values),
                    post_change_values=redact_sensitive_json(entry.post_change_values),
                    ip_address=entry.ip_address,
                    timestamp=entry.timestamp,
                    narrative_summary=narrative,
                )
            )
        return results

    @classmethod
    def get_summary(cls, db: Session) -> AuditSummaryResponse:
        """Get high-level summary metrics of audit activities."""
        total_count = db.query(func.count(AuditLog.log_id)).scalar() or 0

        # Action types breakdown
        action_query = (
            db.query(AuditLog.action_type, func.count(AuditLog.log_id))
            .group_by(AuditLog.action_type)
            .all()
        )
        action_counts = {act: cnt for act, cnt in action_query}

        # Entities breakdown
        entity_query = (
            db.query(AuditLog.target_entity, func.count(AuditLog.log_id))
            .group_by(AuditLog.target_entity)
            .all()
        )
        entity_counts = {ent: cnt for ent, cnt in entity_query}

        # Recent 10 logs
        recent_logs = cls.list_logs(db, limit=10)

        return AuditSummaryResponse(
            total_logs=total_count,
            action_type_counts=action_counts,
            target_entity_counts=entity_counts,
            recent_logs=recent_logs,
        )

    @classmethod
    def get_distinct_entities(cls, db: Session) -> List[str]:
        """List distinct target entities present in the audit log."""
        rows = db.query(AuditLog.target_entity).distinct().all()
        return sorted([r[0] for r in rows if r[0]])

    @classmethod
    def get_distinct_actions(cls, db: Session) -> List[str]:
        """List distinct action types present in the audit log."""
        rows = db.query(AuditLog.action_type).distinct().all()
        return sorted([r[0] for r in rows if r[0]])
