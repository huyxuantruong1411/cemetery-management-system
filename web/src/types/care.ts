export interface CareChecklistItemBrief {
  item_id: number
  schedule_id: number
  task_description: string
  is_required: boolean
  sort_order: number
  is_completed: boolean
  field_notes?: string | null
}

export interface CareChecklistItemUpdate {
  is_completed?: boolean
  field_notes?: string | null
}

export interface CareMediaEvidenceBrief {
  evidence_id: number
  schedule_id: number
  file_id?: string | null
  media_url?: string | null
  caption?: string | null
  uploaded_at: string
  uploaded_by_user_id?: number | null
  uploaded_by_name?: string | null
}

export interface CareScheduleBrief {
  schedule_id: number
  care_annex_id: number
  plot_id: number
  plot_code?: string | null
  zone_name?: string | null
  package_id: number
  package_name?: string | null
  caretaker_id?: number | null
  caretaker_name?: string | null
  scheduled_date: string
  performed_date?: string | null
  status: 'SCHEDULED' | 'ASSIGNED' | 'IN_PROGRESS' | 'CLOSED' | 'OVERDUE'
  period_key?: string | null
  notes?: string | null
  closed_at?: string | null
  created_at: string
  tasks_count: number
  completed_tasks_count: number
  evidence_count: number
}

export interface CareScheduleDetail extends CareScheduleBrief {
  checklist_items: CareChecklistItemBrief[]
  media_evidences: CareMediaEvidenceBrief[]
  has_conflict?: boolean
  conflict_reason?: string | null
}

export interface CareScheduleGenerateRequest {
  year: number
  month: number
  care_annex_id?: number | null
}

export interface CareScheduleGenerateResponse {
  period_key: string
  generated_count: number
  skipped_count: number
  schedules: CareScheduleBrief[]
}

export interface CareAnnexResponse {
  annex_id: number
  contract_id: number
  annex_number: string
  package_id: number
  package_name?: string | null
  cycle_months: number
  recurring_price: number | string
  status: string
  valid_from: string
  valid_to: string
}
