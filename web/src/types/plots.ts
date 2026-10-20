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
  plot_length?: number | string;
  plot_width?: number | string;
  is_synthetic?: boolean;
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

export interface MediaItemBrief {
  file_id: string;
  caption?: string | null;
  uploaded_at: string;
  media_url?: string | null;
  download_url?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  uploader_name?: string | null;
}

export interface PlotTimelineEvent {
  event_type: 'BURIAL' | 'CONSTRUCTION' | 'CARE' | 'EXHUMATION' | string;
  title?: string;
  event_title?: string;
  event_date: string;
  description?: string | null;
  status: string;
  performed_by?: string | null;
  executor_name?: string | null;
  evidences?: MediaItemBrief[];
  media_evidences?: MediaItemBrief[];
}

export interface PlotDeceasedBrief {
  deceased_id: number;
  deceased_code: string;
  full_name: string;
  slot_number?: number | null;
  date_of_death: string;
  year_of_birth?: number | null;
  birth_year?: number | null;
  is_kim_tinh: boolean;
  tribute_notes?: string | null;
}

export interface PlotTimelineResponse {
  plot_id: number;
  plot_code: string;
  zone_name: string;
  row_code: string;
  type_name: string;
  orientation?: string | null;
  dimensions?: string | null;
  is_kim_tinh: boolean;
  is_locked?: boolean;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  maps_url?: string | null;
  walking_directions?: string | null;
  navigation_guidance?: string | null;
  deceased_list: PlotDeceasedBrief[];
  events?: PlotTimelineEvent[];
  timeline?: PlotTimelineEvent[];
}
