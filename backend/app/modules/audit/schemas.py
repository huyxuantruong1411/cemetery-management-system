from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    log_id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    action_type: str
    target_entity: str
    target_id: str
    pre_change_values: Optional[str] = None
    post_change_values: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime


class AuditSummaryResponse(BaseModel):
    total_logs: int
    action_type_counts: Dict[str, int] = {}
    target_entity_counts: Dict[str, int] = {}
    recent_logs: List[AuditLogResponse] = []
