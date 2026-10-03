export interface AuditLogResponse {
  log_id: number
  user_id: number | null
  username: string | null
  action_type: string
  target_entity: string
  target_id: string
  pre_change_values: string | null
  post_change_values: string | null
  ip_address: string | null
  timestamp: string
}

export interface AuditSummaryResponse {
  total_logs: number
  action_type_counts: Record<string, number>
  target_entity_counts: Record<string, number>
  recent_logs: AuditLogResponse[]
}
