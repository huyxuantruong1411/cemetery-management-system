export interface PriceItem {
  item_id: number
  price_list_id: number
  item_code: string
  item_name: string
  unit_price: number | string
  unit: string
  zone_id?: number | null
  plot_type_id?: number | null
  package_id?: number | null
  service_code?: string | null
}

export interface PriceList {
  price_list_id: number
  price_list_name: string
  effective_from_date: string
  effective_to_date?: string | null
  is_active: boolean
  created_at: string
  items: PriceItem[]
}

export interface CarePackage {
  package_id: number
  package_code: string
  package_name: string
  cycle_type: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  default_tasks_json: string
  unit_price: number | string
  is_active: boolean
}

export interface ContractTemplate {
  template_id: number
  template_code: string
  contract_type: 'LAND_PURCHASE' | 'EXHUMATION' | 'CREMATION' | 'TRANSFER' | 'CARE_ANNEX'
  template_name: string
  version_no: number
  content_html: string
  required_documents_json?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PriceLookupResult {
  matched: boolean
  price_list_id?: number | null
  price_list_name?: string | null
  item_id?: number | null
  item_code?: string | null
  item_name?: string | null
  unit_price?: number | string | null
  unit?: string | null
  effective_from?: string | null
  effective_to?: string | null
}
