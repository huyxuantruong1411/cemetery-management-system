export interface CustomerRelationBrief {
  relation_id: number;
  deceased_id: number;
  deceased_code: string;
  deceased_full_name: string;
  relationship_type: string;
  is_primary_contact: boolean;
}

export interface DeceasedRelationBrief {
  relation_id: number;
  customer_id: number;
  customer_code: string;
  customer_full_name: string;
  citizen_id: string;
  phone_number: string;
  relationship_type: string;
  is_primary_contact: boolean;
}

export interface BurialSlotBrief {
  slot_id: number;
  plot_id: number;
  slot_number: number;
  plot_code: string;
  zone_code: string;
  zone_name: string;
  row_code: string;
  status: string;
  is_kim_tinh: boolean;
}

export interface Customer {
  customer_id: number;
  customer_code: string;
  full_name: string;
  citizen_id: string;
  phone_number: string;
  email: string | null;
  address: string;
  date_of_birth: string | null;
  created_at: string;
  updated_at: string;
  relations: CustomerRelationBrief[];
}

export interface CustomerCreate {
  full_name: string;
  citizen_id: string;
  phone_number: string;
  email?: string | null;
  address: string;
  date_of_birth?: string | null;
  customer_code?: string | null;
}

export interface DeathCertificate {
  cert_id: number;
  deceased_id: number;
  certificate_number: string;
  issuing_authority: string;
  issue_date: string;
  scan_file_url: string | null;
  file_id: string | null;
  is_verified: boolean;
  verified_at: string | null;
  verified_by: number | null;
  verifier_name: string | null;
  rejection_reason: string | null;
  notes: string | null;
}

export interface DeathCertificateCreate {
  certificate_number: string;
  issuing_authority: string;
  issue_date: string;
  scan_file_url?: string | null;
  file_id?: string | null;
  notes?: string | null;
}

export interface DeathCertificateVerifyRequest {
  is_verified: boolean;
  rejection_reason?: string | null;
  notes?: string | null;
}

export interface DeceasedProfile {
  deceased_id: number;
  deceased_code: string;
  full_name: string;
  gender: string;
  date_of_birth: string | null;
  date_of_death: string;
  birth_year: number | null;
  birth_date_precision: 'EXACT' | 'YEAR_ONLY' | 'UNKNOWN';
  hometown: string | null;
  religion: string | null;
  has_death_certificate: boolean;
  created_at: string;
  updated_at: string;
  death_certificate: DeathCertificate | null;
  relations: DeceasedRelationBrief[];
  burial_slot: BurialSlotBrief | null;
}

export interface DeceasedProfileCreate {
  full_name: string;
  gender: string;
  date_of_birth?: string | null;
  date_of_death: string;
  birth_year?: number | null;
  birth_date_precision: 'EXACT' | 'YEAR_ONLY' | 'UNKNOWN';
  hometown?: string | null;
  religion?: string | null;
  deceased_code?: string | null;
  customer_id?: number | null;
  relationship_type?: string | null;
  is_primary_contact?: boolean;
  death_certificate?: DeathCertificateCreate | null;
}

export interface DeceasedPublicLookupResponse {
  deceased_code: string;
  full_name: string;
  year_of_birth: number | null;
  date_of_death: string;
  hometown: string | null;
  zone_name: string | null;
  row_code: string | null;
  plot_code: string | null;
  slot_number: number | null;
  is_kim_tinh: boolean;
}
