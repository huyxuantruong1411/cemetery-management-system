export interface ConstructionTaskEvidenceBrief {
  evidence_id: number
  task_id: number
  file_id: string
  caption?: string | null
  uploaded_at: string
  uploaded_by: number
  uploader_name?: string | null
  file_name?: string | null
  download_url?: string | null
}

export interface ConstructionTaskBrief {
  task_id: number
  order_id: number
  task_name: string
  assigned_team_or_contractor?: string | null
  assignee_user_id?: number | null
  assignee_name?: string | null
  is_required: boolean
  sort_order: number
  start_date?: string | null
  due_date?: string | null
  status: 'TODO' | 'DOING' | 'DONE' | string
  proof_media_url?: string | null
  field_notes?: string | null
  completed_at?: string | null
  completed_by?: number | null
  completed_by_name?: string | null
  evidences: ConstructionTaskEvidenceBrief[]
}

export interface ConstructionOrderResponse {
  order_id: number
  annex_id: number
  plot_id: number
  plot_code?: string | null
  zone_name?: string | null
  supervisor_id: number
  supervisor_name?: string | null
  start_date?: string | null
  expected_end_date: string
  actual_end_date?: string | null
  overall_progress: number | string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | string
  is_overdue: boolean
  notes?: string | null
  created_at: string
  tasks: ConstructionTaskBrief[]
  total_tasks: number
  completed_tasks: number
  required_tasks: number
  completed_required_tasks: number
}

export interface ConstructionOrderCreate {
  annex_id: number
  plot_id: number
  supervisor_id: number
  start_date?: string | null
  expected_end_date: string
  notes?: string | null
  custom_tasks?: Array<{
    task_name: string
    assigned_team_or_contractor?: string
    assignee_user_id?: number
    is_required: boolean
    sort_order: number
    start_date?: string
    due_date?: string
    field_notes?: string
  }>
}

export interface StaffUnavailabilityResponse {
  unavailability_id: number
  user_id: number
  user_name?: string | null
  start_date: string
  end_date: string
  reason?: string | null
  created_at: string
}

export interface StaffUnavailabilityCreate {
  user_id: number
  start_date: string
  end_date: string
  reason?: string
}

export interface StaffConflictCheckResponse {
  has_conflict: boolean
  conflicts: StaffUnavailabilityResponse[]
  warning_message?: string | null
}
