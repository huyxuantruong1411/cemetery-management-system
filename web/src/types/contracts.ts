export type ContractStatus = 'DRAFT' | 'PENDING_SIGN' | 'ACTIVE' | 'CANCELLED';
export type ContractType = 'LAND_PURCHASE' | 'SERVICE' | 'EXHUMATION' | 'TRANSFER' | 'CREMATION';
export type AnnexStatus = 'DRAFT' | 'PENDING_SIGN' | 'ACTIVE' | 'CANCELLED';
export type AnnexType = 'BURIAL' | 'CARE' | 'CONSTRUCTION';

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

export interface BurialAnnexDetailBrief {
  deceased_id: number;
  deceased_name?: string | null;
  deceased_code?: string | null;
  plot_id: number;
  plot_code?: string | null;
  slot_id: number;
  slot_number?: number | null;
  burial_date: string;
  is_kim_tinh: boolean;
  construction_notes?: string | null;
}

export interface ContractAnnexResponse {
  annex_id: number;
  annex_code: string;
  contract_id: number;
  annex_type: AnnexType | string;
  status: AnnexStatus | string;
  additional_amount: number | string;
  signed_scan_file_id?: string | null;
  signed_scan_url?: string | null;
  signed_at?: string | null;
  activated_at?: string | null;
  activated_by?: number | null;
  activator_name?: string | null;
  activation_notes?: string | null;
  valid_from: string;
  valid_to?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  burial?: BurialAnnexDetailBrief | null;
}

export interface ExhumationDetailBrief {
  plot_id: number;
  slot_id: number;
  current_deceased_id: number;
  deceased_name?: string | null;
  plot_code?: string | null;
  slot_number?: number | null;
  exhumation_date: string;
  exhumation_fee: number | string;
  reason?: string | null;
}

export interface TransferDetailBrief {
  seller_id: number;
  buyer_id: number;
  plot_id: number;
  seller_name?: string | null;
  buyer_name?: string | null;
  plot_code?: string | null;
  commission_fee: number | string;
  transfer_reason?: string | null;
}

export interface CremationDetailBrief {
  deceased_id: number;
  deceased_name?: string | null;
  cremation_date: string;
  package_service_code: string;
  urn_storage_option?: string | null;
  service_fee: number | string;
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
  annexes?: ContractAnnexResponse[];
  exhumation?: ExhumationDetailBrief | null;
  transfer?: TransferDetailBrief | null;
  cremation?: CremationDetailBrief | null;
}

export interface LandPurchaseContractCreate {
  customer_id: number;
  plot_id: number;
  land_unit_price?: number | null;
  template_id?: number | null;
  notes?: string | null;
}

export interface ExhumationContractCreate {
  customer_id: number;
  plot_id: number;
  slot_id: number;
  current_deceased_id: number;
  exhumation_date: string;
  exhumation_fee?: number | null;
  reason?: string | null;
  template_id?: number | null;
  notes?: string | null;
}

export interface TransferContractCreate {
  seller_id: number;
  buyer_id: number;
  plot_id: number;
  commission_fee?: number | null;
  transfer_reason?: string | null;
  template_id?: number | null;
  notes?: string | null;
}

export interface CremationContractCreate {
  customer_id: number;
  deceased_id: number;
  cremation_date: string;
  package_service_code: string;
  urn_storage_option?: string | null;
  service_fee?: number | null;
  template_id?: number | null;
  notes?: string | null;
}

export interface BurialAnnexCreate {
  deceased_id: number;
  slot_id: number;
  burial_date: string;
  is_kim_tinh?: boolean;
  additional_amount?: number | null;
  construction_notes?: string | null;
  notes?: string | null;
}

export interface ContractActivateRequest {
  signed_scan_file_id: string;
  signed_at?: string | null;
  activation_notes?: string | null;
}

export interface AnnexActivateRequest {
  signed_scan_file_id: string;
  signed_at?: string | null;
  activation_notes?: string | null;
}

export interface ContractCancelRequest {
  reason: string;
}
