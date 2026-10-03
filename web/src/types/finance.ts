export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT'

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'VIET_QR'

export type ReceivableStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED'

export interface DiscountRecord {
  discount_id: number
  receivable_id: number
  discount_type: DiscountType
  discount_value: number
  calculated_amount: number
  justification_reason: string
  approved_by_user_id: number
  applied_at: string
}

export interface Invoice {
  invoice_id: number
  invoice_number: string
  payment_id: number
  issued_date: string
  total_amount_in_words: string
  pdf_file_url: string | null
  file_id: string | null
  notes: string | null
}

export interface Payment {
  payment_id: number
  receivable_id: number
  paid_amount: number
  payment_method: PaymentMethod
  transaction_reference: string | null
  paid_at: string
  recorded_by_user_id: number
  recorder_name: string | null
  invoice: Invoice | null
}

export interface Receivable {
  receivable_id: number
  contract_id: number | null
  contract_code: string | null
  annex_id: number | null
  annex_code: string | null
  customer_id: number
  customer_name: string | null
  customer_phone: string | null
  original_amount: number
  discount_amount: number
  final_payable_amount: number
  total_paid_amount: number
  remaining_balance: number
  status: ReceivableStatus
  due_date: string
  notes: string | null
  installment_no: number
  created_at: string
  discounts: DiscountRecord[]
  payments: Payment[]
}

export interface FinanceSummary {
  total_receivables_amount: number
  total_collected_amount: number
  total_outstanding_amount: number
  total_discounts_amount: number
  count_unpaid: number
  count_partially_paid: number
  count_paid: number
  count_overdue: number
}

export interface PaymentRecordPayload {
  paid_amount: number
  payment_method: PaymentMethod
  transaction_reference?: string
  idempotency_key?: string
}

export interface DiscountApplyPayload {
  discount_type: DiscountType
  discount_value: number
  justification_reason: string
}
