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


class AuditService:
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
        Query system audit logs with filtering and automated secret redaction.
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
