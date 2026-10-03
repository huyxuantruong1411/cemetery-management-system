export interface Zone {
  zone_id: number;
  zone_code: string;
  zone_name: string;
  total_rows: number;
  description?: string | null;
}

export interface Row {
  row_id: number;
  zone_id: number;
  row_code: string;
  total_plots: number;
}

export interface PlotType {
  type_id: number;
  type_name: string;
  default_slots: number;
  length: number;
  width: number;
  description?: string | null;
}

export interface PlotSlot {
  slot_id: number;
  plot_id: number;
  slot_number: number;
  status: 'EMPTY' | 'OCCUPIED';
  current_deceased_id?: number | null;
  deceased_name?: string | null;
}

export interface PlotReservation {
  reservation_id: number;
  plot_id: number;
  reserved_by: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  state: 'ACTIVE' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';
  reserved_at: string;
  expires_at: string;
  notes?: string | null;
}

export type PlotStatus =
  | 'EMPTY_UNSOLD'
  | 'RESERVED'
  | 'OWNED_EMPTY'
  | 'UNDER_CONSTRUCTION'
  | 'OCCUPIED'
  | 'UNDER_EXHUMATION';

export interface Plot {
  plot_id: number;
  plot_code: string;
  row_id: number;
  row_code: string;
  zone_id: number;
  zone_code: string;
  zone_name: string;
  type_id: number;
  type_name: string;
  default_slots: number;
  status: PlotStatus;
  is_kim_tinh: boolean;
  is_locked: boolean;
  latitude?: number | null;
  longitude?: number | null;
  orientation?: string | null;
  owner_id?: number | null;
  owner_name?: string | null;
  active_reservation?: PlotReservation | null;
}

export interface PlotDetail extends Plot {
  slots: PlotSlot[];
  created_at: string;
  updated_at: string;
  notes?: string | null;
}

export interface PlotStats {
  total_plots: number;
  empty_unsold: number;
  reserved: number;
  owned_empty: number;
  under_construction: number;
  occupied: number;
  under_exhumation: number;
  kim_tinh_count: number;
  locked_count: number;
}
