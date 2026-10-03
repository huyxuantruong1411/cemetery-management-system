export interface RevenuePeriodItem {
  period: string
  total_amount: number
  transaction_count: number
  average_amount: number
}

export interface RevenueMethodItem {
  method: string
  total_amount: number
  count: number
  percentage: number
}

export interface RevenueDrillDownItem {
  payment_id: number
  payment_no: string
  payment_date: string
  amount: number
  payment_method: string
  source_type: string
  source_code: string
  customer_name: string | null
  notes: string | null
}

export interface RevenueReportResponse {
  total_revenue: number
  total_transactions: number
  average_transaction_value: number
  start_date: string | null
  end_date: string | null
  by_period: RevenuePeriodItem[]
  by_method: RevenueMethodItem[]
  drilldown_items: RevenueDrillDownItem[]
}

export interface ZoneOccupancyItem {
  zone_id: number
  zone_code: string
  zone_name: string
  total_plots: number
  empty_plots: number
  reserved_plots: number
  owned_empty_plots: number
  under_construction_plots: number
  occupied_plots: number
  kim_tinh_plots: number
  occupancy_rate: number
  total_slots: number
  occupied_slots: number
  slot_occupancy_rate: number
}

export interface OccupancyReportResponse {
  total_plots: number
  total_empty: number
  total_reserved: number
  total_owned_empty: number
  total_under_construction: number
  total_occupied: number
  total_kim_tinh: number
  overall_occupancy_rate: number
  total_slots: number
  occupied_slots: number
  slot_occupancy_rate: number
  zones: ZoneOccupancyItem[]
}

export interface ContractStatusItem {
  status: string
  count: number
  total_value: number
}

export interface AnnexTypeItem {
  annex_type: string
  count: number
  total_value: number
}

export interface ExpiringCareItem {
  annex_id: number
  annex_code: string
  customer_name: string
  plot_code: string
  end_date: string
  days_remaining: number
}

export interface ContractReportResponse {
  total_land_contracts: number
  total_land_value: number
  total_annexes: number
  total_annex_value: number
  by_contract_status: ContractStatusItem[]
  by_annex_type: AnnexTypeItem[]
  expiring_care_annexes: ExpiringCareItem[]
}

export interface ConstructionStats {
  total_orders: number
  pending_count: number
  in_progress_count: number
  completed_count: number
  cancelled_count: number
  overdue_count: number
  completion_rate: number
  avg_duration_days: number
}

export interface CareStats {
  total_schedules: number
  scheduled_count: number
  assigned_count: number
  in_progress_count: number
  closed_count: number
  overdue_count: number
  close_rate: number
  required_tasks_completed_rate: number
  evidence_compliance_rate: number
}

export interface OperationsReportResponse {
  construction: ConstructionStats
  care: CareStats
}

export interface ReportExportRequest {
  report_type: 'REVENUE' | 'OCCUPANCY' | 'CONTRACTS' | 'OPERATIONS'
  export_format: 'PDF' | 'XLSX'
  filter_params?: Record<string, unknown>
}

export interface ReportExportResponse {
  export_id: number
  export_code: string
  report_type: string
  export_format: string
  status: string
  file_id: string | null
  record_count: number
  file_size_bytes: number | null
  error_message: string | null
  created_at: string
  expires_at: string | null
}
