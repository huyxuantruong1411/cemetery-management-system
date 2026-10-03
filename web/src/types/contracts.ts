export type ContractStatus = 'DRAFT' | 'PENDING_SIGN' | 'ACTIVE' | 'CANCELLED';
export type ContractType = 'LAND_PURCHASE' | 'SERVICE';

export interface CustomerBrief {
  customer_id: number;
  customer_code: string;
  full_name: string;
  citizen_id: string;
  phone_number: string;
  address: string;
  date_of_birth?: string | null;
}

export interface PlotBrief {
  plot_id: number;
  plot_code: string;
  zone_code: string;
  zone_name: string;
  row_code: string;
  type_name: string;
  status: string;
  is_kim_tinh: boolean;
  is_locked: boolean;
  orientation?: string | null;
}

export interface LandPurchaseDetailBrief {
  plot_id: number;
  land_unit_price: number | string;
  plot?: PlotBrief | null;
}

export interface ReceivableBrief {
  receivable_id: number;
  contract_id: number;
  original_amount: number | string;
  discount_amount: number | string;
  final_payable_amount: number | string;
  total_paid_amount: number | string;
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';
  due_date: string;
}

export interface ContractBriefResponse {
  contract_id: number;
  contract_code: string;
  contract_type: ContractType;
  status: ContractStatus;
  total_amount: number | string;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  plot_id?: number | null;
  plot_code?: string | null;
  zone_name?: string | null;
  signed_at?: string | null;
  activated_at?: string | null;
  created_at: string;
}

export interface ContractDetailResponse {
  contract_id: number;
  contract_code: string;
  contract_type: ContractType;
  status: ContractStatus;
  total_amount: number | string;
  signed_at?: string | null;
  activated_at?: string | null;
  activated_by?: number | null;
  activator_name?: string | null;
  activation_notes?: string | null;
  template_id?: number | null;
  template_version?: number | null;
  signed_scan_file_id?: string | null;
  signed_scan_url?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  customer?: CustomerBrief | null;
  land_purchase?: LandPurchaseDetailBrief | null;
  plot?: PlotBrief | null;
  receivable?: ReceivableBrief | null;
}

export interface LandPurchaseContractCreate {
  customer_id: number;
  plot_id: number;
  land_unit_price?: number | null;
  template_id?: number | null;
  notes?: string | null;
}

export interface ContractActivateRequest {
  signed_scan_file_id: string;
  signed_at?: string | null;
  activation_notes?: string | null;
}

export interface ContractCancelRequest {
  reason: string;
}
