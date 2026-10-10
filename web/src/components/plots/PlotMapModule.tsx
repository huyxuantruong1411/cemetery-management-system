import React, { useEffect, useState, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  MapPin,
  Shield,
  Layers,
  Grid,
  Clock,
  AlertCircle,
  X,
  RefreshCw,
  Search,
  ExternalLink,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import type {
  Plot,
  PlotDetail,
  PlotStats,
  Zone,
  Row,
  PlotType,
} from '../../types/plots';
import { Pagination, usePagination } from '../common/Pagination';

interface PlotMapModuleProps {
  token: string | null;
  onRequireLogin: () => void;
}

export const PlotMapModule: React.FC<PlotMapModuleProps> = ({
  token,
  onRequireLogin,
}) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<'map' | 'grid' | 'catalog'>('map');

  // Data states
  const [plots, setPlots] = useState<Plot[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [plotTypes, setPlotTypes] = useState<PlotType[]>([]);
  const [stats, setStats] = useState<PlotStats | null>(null);

  // Filter states
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [kimTinhFilter, setKimTinhFilter] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected plot detail
  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);
  const [plotDetail, setPlotDetail] = useState<PlotDetail | null>(null);

  // Reservation Modal state
  const [isReserveModalOpen, setIsReserveModalOpen] = useState<boolean>(false);
  const [reserveCustName, setReserveCustName] = useState<string>('');
  const [reserveCustPhone, setReserveCustPhone] = useState<string>('');
  const [reserveHours, setReserveHours] = useState<number>(48);
  const [reserveNotes, setReserveNotes] = useState<string>('');
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [reserveSuccess, setReserveSuccess] = useState<string | null>(null);
  const [isReserving, setIsReserving] = useState<boolean>(false);

  // CRUD Modal states
  const [zoneModal, setZoneModal] = useState<{ isOpen: boolean; mode: 'create' | 'edit'; data?: Zone | null }>({
    isOpen: false,
    mode: 'create',
    data: null,
  });
  const [rowModal, setRowModal] = useState<{ isOpen: boolean; mode: 'create' | 'edit'; data?: Row | null; defaultZoneId?: number }>({
    isOpen: false,
    mode: 'create',
    data: null,
  });
  const [plotTypeModal, setPlotTypeModal] = useState<{ isOpen: boolean; mode: 'create' | 'edit'; data?: PlotType | null }>({
    isOpen: false,
    mode: 'create',
    data: null,
  });
  const [plotModal, setPlotModal] = useState<{ isOpen: boolean; mode: 'create' | 'edit'; data?: PlotDetail | Plot | null }>({
    isOpen: false,
    mode: 'create',
    data: null,
  });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; type: 'zone' | 'row' | 'plot_type' | 'plot'; id: number; name: string } | null>(null);

  // Form states
  const [crudError, setCrudError] = useState<string | null>(null);
  const [crudSuccess, setCrudSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Standard states: loading, error
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Leaflet map container reference
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // 1. Fetch initial data
  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [plotsRes, zonesRes, rowsRes, typesRes, statsRes] = await Promise.all([
        fetch('/api/v1/plots?limit=500', { headers }),
        fetch('/api/v1/plots/zones', { headers }),
        fetch('/api/v1/plots/rows', { headers }),
        fetch('/api/v1/plots/types', { headers }),
        fetch('/api/v1/plots/stats', { headers }),
      ]);

      if (!plotsRes.ok) throw new Error('Không thể tải danh sách ô mộ.');
      const plotsData = await plotsRes.json();
      const zonesData = await zonesRes.json();
      const rowsData = await rowsRes.json();
      const typesData = await typesRes.json();
      const statsData = await statsRes.json();

      setPlots(plotsData);
      setZones(zonesData);
      setRows(rowsData);
      setPlotTypes(typesData);
      setStats(statsData);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // 2. Fetch Plot Detail when selected
  const fetchPlotDetail = async (plotId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/plots/${plotId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPlotDetail(data);
      }
    } catch {
      // ignore
    }
  };

  const handleSelectPlot = (plotId: number) => {
    setSelectedPlotId(plotId);
    fetchPlotDetail(plotId);
  };

  // Filter helper
  const getFilteredPlots = () => {
    return plots.filter((p) => {
      if (selectedZoneId !== null && p.zone_id !== selectedZoneId) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (kimTinhFilter !== null && p.is_kim_tinh !== kimTinhFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.plot_code.toLowerCase().includes(q) ||
          p.zone_name.toLowerCase().includes(q) ||
          p.type_name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  };

  // 3. Leaflet Map Initialization and Marker Management
  useEffect(() => {
    if (activeTab !== 'map' || !mapContainerRef.current) return;

    // Initialize Map if not already created
    if (!mapInstanceRef.current) {
      // Default center: [10.925200, 106.825200]
      const map = L.map(mapContainerRef.current, {
        center: [10.925200, 106.825200],
        zoom: 18,
        maxZoom: 20,
        minZoom: 15,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const markersLayer = markersLayerRef.current;
    if (markersLayer) {
      markersLayer.clearLayers();

      const filteredPlots = getFilteredPlots();
      const bounds: L.LatLngTuple[] = [];

      filteredPlots.forEach((p) => {
        if (p.latitude && p.longitude) {
          const lat = Number(p.latitude);
          const lng = Number(p.longitude);
          bounds.push([lat, lng]);

          // Marker color based on status
          let color = '#10B981'; // EMPTY_UNSOLD: Green
          if (p.status === 'RESERVED') color = '#F59E0B'; // Orange
          else if (p.status === 'OWNED_EMPTY') color = '#3B82F6'; // Blue
          else if (p.status === 'UNDER_CONSTRUCTION') color = '#8B5CF6'; // Purple
          else if (p.status === 'OCCUPIED') color = '#DC2626'; // Red
          else if (p.status === 'UNDER_EXHUMATION') color = '#6B7280'; // Gray

          const isKt = p.is_kim_tinh;
          const isLocked = p.is_locked;

          // Custom SVG icon
          const iconHtml = `
            <div style="
              width: 32px;
              height: 32px;
              border-radius: 8px;
              background-color: ${color};
              border: ${isKt ? '3px solid #EAB308' : '2px solid white'};
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 11px;
              font-weight: bold;
              position: relative;
              cursor: pointer;
            ">
              ${p.plot_code.split('-').pop() || 'P'}
              ${isKt ? `<div style="position: absolute; top: -5px; right: -5px; background: #EAB308; border-radius: 50%; width: 12px; height: 12px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: black;">🛡️</div>` : ''}
              ${isLocked ? `<div style="position: absolute; bottom: -5px; right: -5px; background: #991B1B; border-radius: 50%; width: 12px; height: 12px; display: flex; align-items: center; justify-content: center; font-size: 8px;">🔒</div>` : ''}
            </div>
          `;

          const customIcon = L.divIcon({
            html: iconHtml,
            className: 'custom-plot-marker',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          const marker = L.marker([lat, lng], { icon: customIcon });
          marker.on('click', () => {
            handleSelectPlot(p.plot_id);
          });
          marker.bindTooltip(`<b>${p.plot_code}</b><br/>${p.type_name}<br/>${p.status}`, {
            direction: 'top',
          });

          markersLayer.addLayer(marker);
        }
      });

      if (bounds.length > 0 && mapInstanceRef.current) {
        mapInstanceRef.current.fitBounds(L.latLngBounds(bounds), {
          padding: [40, 40],
          maxZoom: 18,
        });
      }
    }
  }, [activeTab, plots, selectedZoneId, statusFilter, kimTinhFilter, searchQuery]);

  // 4. Handle Reserve Submission (Anti-Double Booking)
  const handleReserveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedPlotId) return;

    setIsReserving(true);
    setReserveError(null);
    setReserveSuccess(null);

    try {
      const res = await fetch(`/api/v1/plots/${selectedPlotId}/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer_name: reserveCustName.trim() || undefined,
          customer_phone: reserveCustPhone.trim() || undefined,
          duration_hours: Number(reserveHours),
          notes: reserveNotes.trim() || undefined,
        }),
      });

      if (res.status === 409) {
        const data = await res.json();
        throw new Error(data.detail || 'Xung đột giữ chỗ: Ô mộ này đã có người giữ chỗ!');
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Không thể thực hiện giữ chỗ.');
      }

      setReserveSuccess('Giữ chỗ thành công! Ô mộ đã được khóa tạm thời chống trùng lặp.');
      await fetchData();
      await fetchPlotDetail(selectedPlotId);
      setTimeout(() => {
        setIsReserveModalOpen(false);
        setReserveSuccess(null);
      }, 1500);
    } catch (err: unknown) {
      setReserveError(err instanceof Error ? err.message : 'Lỗi giữ chỗ.');
    } finally {
      setIsReserving(false);
    }
  };

  // 5. Handle Cancel Reservation
  const handleCancelReservation = async (plotId: number) => {
    if (!token) return;
    if (!window.confirm('Bạn có chắc chắn muốn hủy giữ chỗ cho ô mộ này không?')) return;

    try {
      const res = await fetch(`/api/v1/plots/${plotId}/cancel-reservation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.detail || 'Không thể hủy giữ chỗ.');
        return;
      }
      await fetchData();
      await fetchPlotDetail(plotId);
    } catch {
      alert('Lỗi kết nối khi hủy giữ chỗ.');
    }
  };

  const filteredPlots = getFilteredPlots();

  // Pagination for Grid Matrix View
  const {
    currentPage: gridPage,
    pageSize: gridPageSize,
    totalPages: gridTotalPages,
    totalItems: gridTotalItems,
    paginatedItems: paginatedGridPlots,
    setCurrentPage: setGridPage,
    setPageSize: setGridPageSize,
    startIndex: gridStartIndex,
    endIndex: gridEndIndex,
  } = usePagination(filteredPlots, 24);

  // Pagination for Plot Types (Tab 3)
  const {
    currentPage: ptPage,
    pageSize: ptPageSize,
    totalPages: ptTotalPages,
    totalItems: ptTotalItems,
    paginatedItems: paginatedPlotTypes,
    setCurrentPage: setPtPage,
    setPageSize: setPtPageSize,
    startIndex: ptStartIndex,
    endIndex: ptEndIndex,
  } = usePagination(plotTypes, 6);

  // Pagination for Zones (Tab 3)
  const {
    currentPage: zonePage,
    pageSize: zonePageSize,
    totalPages: zoneTotalPages,
    totalItems: zoneTotalItems,
    paginatedItems: paginatedZones,
    setCurrentPage: setZonePage,
    setPageSize: setZonePageSize,
    startIndex: zoneStartIndex,
    endIndex: zoneEndIndex,
  } = usePagination(zones, 6);

  // Handle Save Zone
  const handleSaveZone = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    const formData = new FormData(e.currentTarget);
    const code = formData.get('zone_code')?.toString().trim();
    const name = formData.get('zone_name')?.toString().trim();
    const rowsCount = Number(formData.get('total_rows')) || 0;
    const desc = formData.get('description')?.toString().trim() || undefined;

    setIsSubmitting(true);
    setCrudError(null);
    try {
      if (zoneModal.mode === 'create') {
        const res = await fetch('/api/v1/plots/zones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ zone_code: code, zone_name: name, total_rows: rowsCount, description: desc }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Không thể tạo khu vực.');
        }
      } else if (zoneModal.data) {
        const res = await fetch(`/api/v1/plots/zones/${zoneModal.data.zone_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ zone_name: name, total_rows: rowsCount, description: desc }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Không thể cập nhật khu vực.');
        }
      }
      setCrudSuccess('Lưu khu vực thành công!');
      await fetchData();
      setZoneModal({ isOpen: false, mode: 'create', data: null });
      setTimeout(() => setCrudSuccess(null), 3000);
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : 'Lỗi xử lý khu vực.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Save Row
  const handleSaveRow = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    const formData = new FormData(e.currentTarget);
    const zoneId = Number(formData.get('zone_id'));
    const code = formData.get('row_code')?.toString().trim();
    const plotsCount = Number(formData.get('total_plots')) || 0;

    setIsSubmitting(true);
    setCrudError(null);
    try {
      if (rowModal.mode === 'create') {
        const res = await fetch('/api/v1/plots/rows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ zone_id: zoneId, row_code: code, total_plots: plotsCount }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Không thể tạo hàng mộ.');
        }
      } else if (rowModal.data) {
        const res = await fetch(`/api/v1/plots/rows/${rowModal.data.row_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ row_code: code, total_plots: plotsCount }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Không thể cập nhật hàng mộ.');
        }
      }
      setCrudSuccess('Lưu hàng mộ thành công!');
      await fetchData();
      setRowModal({ isOpen: false, mode: 'create', data: null });
      setTimeout(() => setCrudSuccess(null), 3000);
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : 'Lỗi xử lý hàng mộ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Save PlotType
  const handleSavePlotType = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    const formData = new FormData(e.currentTarget);
    const name = formData.get('type_name')?.toString().trim();
    const defaultSlots = Number(formData.get('default_slots'));
    const length = Number(formData.get('length'));
    const width = Number(formData.get('width'));
    const desc = formData.get('description')?.toString().trim() || undefined;

    setIsSubmitting(true);
    setCrudError(null);
    try {
      if (plotTypeModal.mode === 'create') {
        const res = await fetch('/api/v1/plots/types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ type_name: name, default_slots: defaultSlots, length, width, description: desc }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Không thể tạo loại mộ.');
        }
      } else if (plotTypeModal.data) {
        const res = await fetch(`/api/v1/plots/types/${plotTypeModal.data.type_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ type_name: name, default_slots: defaultSlots, length, width, description: desc }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Không thể cập nhật loại mộ.');
        }
      }
      setCrudSuccess('Lưu loại mộ thành công!');
      await fetchData();
      setPlotTypeModal({ isOpen: false, mode: 'create', data: null });
      setTimeout(() => setCrudSuccess(null), 3000);
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : 'Lỗi xử lý loại mộ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Save Plot
  const handleSavePlot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    const formData = new FormData(e.currentTarget);
    const code = formData.get('plot_code')?.toString().trim();
    const rowId = Number(formData.get('row_id'));
    const typeId = Number(formData.get('type_id'));
    const orientation = formData.get('orientation')?.toString().trim() || undefined;
    const latStr = formData.get('latitude')?.toString().trim();
    const lngStr = formData.get('longitude')?.toString().trim();
    const latitude = latStr ? Number(latStr) : undefined;
    const longitude = lngStr ? Number(lngStr) : undefined;
    const notes = formData.get('notes')?.toString().trim() || undefined;
    const isKimTinh = formData.get('is_kim_tinh') === 'on';

    setIsSubmitting(true);
    setCrudError(null);
    try {
      if (plotModal.mode === 'create') {
        const res = await fetch('/api/v1/plots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            plot_code: code,
            row_id: rowId,
            type_id: typeId,
            orientation,
            latitude,
            longitude,
            notes,
            is_kim_tinh: isKimTinh,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Không thể tạo ô mộ.');
        }
      } else if (plotModal.data) {
        const pId = 'plot_id' in plotModal.data ? plotModal.data.plot_id : 0;
        const res = await fetch(`/api/v1/plots/${pId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            orientation,
            latitude,
            longitude,
            notes,
            ...(isKimTinh ? { is_kim_tinh: true } : {}),
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Không thể cập nhật ô mộ.');
        }
      }
      setCrudSuccess('Lưu ô mộ thành công!');
      await fetchData();
      if (selectedPlotId) await fetchPlotDetail(selectedPlotId);
      setPlotModal({ isOpen: false, mode: 'create', data: null });
      setTimeout(() => setCrudSuccess(null), 3000);
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : 'Lỗi xử lý ô mộ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!token || !deleteModal) return;
    setIsSubmitting(true);
    setCrudError(null);
    try {
      let endpoint = '';
      if (deleteModal.type === 'zone') endpoint = `/api/v1/plots/zones/${deleteModal.id}`;
      else if (deleteModal.type === 'row') endpoint = `/api/v1/plots/rows/${deleteModal.id}`;
      else if (deleteModal.type === 'plot_type') endpoint = `/api/v1/plots/types/${deleteModal.id}`;
      else if (deleteModal.type === 'plot') endpoint = `/api/v1/plots/${deleteModal.id}`;

      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Không thể xóa mục này.');
      }
      if (deleteModal.type === 'plot' && selectedPlotId === deleteModal.id) {
        setSelectedPlotId(null);
        setPlotDetail(null);
      }
      setCrudSuccess('Đã xóa thành công!');
      await fetchData();
      setDeleteModal(null);
      setTimeout(() => setCrudSuccess(null), 3000);
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : 'Lỗi khi xóa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for status badge
  const renderStatusBadge = (status: string, isKimTinh: boolean, isLocked: boolean) => {
    let bg = '#F1F5F9';
    let color = '#475569';
    let border = '#CBD5E1';
    let text = status;

    switch (status) {
      case 'EMPTY_UNSOLD':
        bg = '#ECFDF5';
        color = '#047857';
        border = '#A7F3D0';
        text = 'Đất trống chưa bán';
        break;
      case 'RESERVED':
        bg = '#FEF3C7';
        color = '#B45309';
        border = '#FDE68A';
        text = 'Đang tạm giữ chỗ';
        break;
      case 'OWNED_EMPTY':
        bg = '#EFF6FF';
        color = '#1D4ED8';
        border = '#BFDBFE';
        text = 'Đã có chủ (Chờ an táng)';
        break;
      case 'UNDER_CONSTRUCTION':
        bg = '#FAF5FF';
        color = '#7E22CE';
        border = '#E9D5FF';
        text = 'Đang thi công huyệt';
        break;
      case 'OCCUPIED':
        bg = '#FEF2F2';
        color = '#B91C1C';
        border = '#FECACA';
        text = 'Đã an táng';
        break;
      case 'UNDER_EXHUMATION':
        bg = '#F4F4F5';
        color = '#3F3F46';
        border = '#E4E4E7';
        text = 'Đang cải táng';
        break;
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            border: `1px solid ${border}`,
            backgroundColor: bg,
            color: color,
          }}
        >
          {text}
        </span>
        {isKimTinh && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#FEF3C7',
              color: '#92400E',
              border: '1px solid #FCD34D',
            }}
            title="Kết cấu Kim Tĩnh kiên cố"
          >
            <Shield size={12} color="#D97706" />
            Kim Tĩnh
          </span>
        )}
        {isLocked && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 6px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#FEE2E2',
              color: '#991B1B',
              border: '1px solid #FCA5A5',
            }}
            title="Khóa vĩnh viễn (Quy tắc Kim Tĩnh)"
          >
            🔒 Khóa vĩnh viễn
          </span>
        )}
      </div>
    );
  };

  // If not logged in
  if (!token) {
    return (
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '48px 24px',
          textAlign: 'center',
          maxWidth: '540px',
          margin: '48px auto',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#E8F1EE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: '#24594D',
          }}
        >
          <MapPin size={32} />
        </div>
        <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
          Quản Lý Không Gian & Bản Đồ Ô Mộ
        </h3>
        <p style={{ color: '#64748B', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
          Vui lòng đăng nhập với tài khoản Kinh Doanh, Quản Trang hoặc Quản Trị để tra cứu bản đồ số GIS, vị trí ô mộ, kiểm tra Kim Tĩnh và thực hiện giữ chỗ độc quyền.
        </p>
        <button
          onClick={onRequireLogin}
          style={{
            padding: '10px 24px',
            backgroundColor: '#24594D',
            color: '#FFFFFF',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header & KPI Statistics */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          padding: '20px 24px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <MapPin size={22} color="#24594D" />
            <span>Bản Đồ Số GIS & Quản Lý Ô Mộ</span>
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
            Không gian thực địa, phân lô, giám sát kết cấu Kim Tĩnh kiên cố và chống tranh chấp đặt chỗ.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={fetchData}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 500,
              backgroundColor: '#F1F5F9',
              color: '#334155',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
          }}
        >
          <div style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748B' }}>Tổng số ô mộ</span>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>{stats.total_plots}</div>
          </div>
          <div style={{ backgroundColor: '#F0FDF4', padding: '16px', borderRadius: '10px', border: '1px solid #BBF7D0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#166534' }}>Đất trống chưa bán</span>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#15803D', marginTop: '4px' }}>{stats.empty_unsold}</div>
          </div>
          <div style={{ backgroundColor: '#FFFBEB', padding: '16px', borderRadius: '10px', border: '1px solid #FDE68A', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#92400E' }}>Đang tạm giữ chỗ</span>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#B45309', marginTop: '4px' }}>{stats.reserved}</div>
          </div>
          <div style={{ backgroundColor: '#FEF2F2', padding: '16px', borderRadius: '10px', border: '1px solid #FECACA', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#991B1B' }}>Đã an táng</span>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#B91C1C', marginTop: '4px' }}>{stats.occupied}</div>
          </div>
          <div style={{ backgroundColor: '#FEFCE8', padding: '16px', borderRadius: '10px', border: '1px solid #FEF08A', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#713F12', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Shield size={14} color="#D97706" />
              Mộ Kim Tĩnh
            </span>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#A16207', marginTop: '4px' }}>{stats.kim_tinh_count}</div>
          </div>
          <div style={{ backgroundColor: '#FFF1F2', padding: '16px', borderRadius: '10px', border: '1px solid #FECDD3', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#881337' }}>🔒 Đã khóa vĩnh viễn</span>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#BE123C', marginTop: '4px' }}>{stats.locked_count}</div>
          </div>
        </div>
      )}

      {/* 2. Navigation Tabs & Filters */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Sub tabs */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            borderBottom: '1px solid #E2E8F0',
            padding: '4px 16px 0',
            backgroundColor: '#F8FAFC',
          }}
        >
          <button
            onClick={() => setActiveTab('map')}
            style={{
              padding: '12px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              borderBottom: activeTab === 'map' ? '3px solid #24594D' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'map' ? '#24594D' : '#64748B',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <MapPin size={16} />
            <span>Bản Đồ Số GIS (Leaflet Map)</span>
          </button>
          <button
            onClick={() => setActiveTab('grid')}
            style={{
              padding: '12px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              borderBottom: activeTab === 'grid' ? '3px solid #24594D' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'grid' ? '#24594D' : '#64748B',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Grid size={16} />
            <span>Ma Trận Phân Lô Thực Địa</span>
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            style={{
              padding: '12px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              borderBottom: activeTab === 'catalog' ? '3px solid #24594D' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'catalog' ? '#24594D' : '#64748B',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Layers size={16} />
            <span>Danh Mục Khu Vực & Loại Mộ</span>
          </button>
        </div>

        {/* Global Filters Bar */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {/* Zone filter */}
          <select
            value={selectedZoneId || ''}
            onChange={(e) => setSelectedZoneId(e.target.value ? Number(e.target.value) : null)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              backgroundColor: '#FFFFFF',
              color: '#334155',
            }}
          >
            <option value="">-- Tất cả khu vực --</option>
            {zones.map((z) => (
              <option key={z.zone_id} value={z.zone_id}>
                {z.zone_code} - {z.zone_name}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              backgroundColor: '#FFFFFF',
              color: '#334155',
            }}
          >
            <option value="">-- Tất cả trạng thái --</option>
            <option value="EMPTY_UNSOLD">Đất trống chưa bán</option>
            <option value="RESERVED">Đang tạm giữ chỗ</option>
            <option value="OWNED_EMPTY">Đã có chủ (Chờ an táng)</option>
            <option value="OCCUPIED">Đã an táng</option>
          </select>

          {/* Kim Tinh filter */}
          <select
            value={kimTinhFilter === null ? '' : kimTinhFilter ? 'true' : 'false'}
            onChange={(e) => {
              if (e.target.value === '') setKimTinhFilter(null);
              else setKimTinhFilter(e.target.value === 'true');
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              backgroundColor: '#FFFFFF',
              color: '#334155',
            }}
          >
            <option value="">-- Tất cả kết cấu --</option>
            <option value="true">Chỉ mộ Kim Tĩnh</option>
            <option value="false">Mộ tiêu chuẩn (Không Kim Tĩnh)</option>
          </select>

          {/* Search box */}
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Tìm theo mã ô mộ (ví dụ: A-H01-01)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
              }}
            />
          </div>

          <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
            Hiển thị: <strong style={{ color: '#0F172A' }}>{filteredPlots.length}</strong> / {plots.length} ô
          </span>

          {token && (
            <button
              onClick={() => {
                setCrudError(null);
                setPlotModal({ isOpen: true, mode: 'create', data: null });
              }}
              style={{
                marginLeft: 'auto',
                padding: '8px 14px',
                backgroundColor: '#24594D',
                color: '#FFFFFF',
                borderRadius: '6px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              <Plus size={15} />
              <span>Thêm Ô Mộ Mới</span>
            </button>
          )}
        </div>

        {/* 3. Main Tab Contents */}
        {isLoading && (
          <div style={{ padding: '64px 24px', textAlign: 'center', color: '#64748B' }}>
            <RefreshCw size={32} color="#24594D" className="animate-spin" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: '14px' }}>Đang tải dữ liệu không gian và bản đồ...</div>
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: '#FEF2F2',
              borderBottom: '1px solid #FECACA',
              color: '#991B1B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} color="#DC2626" />
              <span style={{ fontSize: '13px', fontWeight: 500 }}>{errorMessage}</span>
            </div>
            <button
              onClick={fetchData}
              style={{
                padding: '6px 12px',
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                borderRadius: '6px',
                border: 'none',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Thử lại
            </button>
          </div>
        )}

        {/* TAB 1: Leaflet Interactive GIS Map */}
        {activeTab === 'map' && !isLoading && (
          <div style={{ position: 'relative', height: '620px', width: '100%', display: 'flex' }}>
            {/* Left: Leaflet Map Container */}
            <div ref={mapContainerRef} style={{ flex: 1, height: '100%', minHeight: '620px', zIndex: 0 }} />

            {/* Right: Floating Plot Detail Sidebar */}
            <div
              style={{
                width: '380px',
                borderLeft: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                height: '100%',
                overflowY: 'auto',
                padding: '20px',
                boxShadow: '-4px 0 12px rgba(0,0,0,0.05)',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {selectedPlotId && plotDetail ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>{plotDetail.plot_code}</h3>
                      <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                        {plotDetail.zone_name} · {plotDetail.row_code}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPlotId(null);
                        setPlotDetail(null);
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px' }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Status & Kim Tinh Badges */}
                  <div>{renderStatusBadge(plotDetail.status, plotDetail.is_kim_tinh, plotDetail.is_locked)}</div>

                  {/* Kim Tinh Warning Banner if locked */}
                  {plotDetail.is_kim_tinh && (
                    <div
                      style={{
                        padding: '12px',
                        backgroundColor: '#FEF3C7',
                        borderRadius: '8px',
                        border: '1px solid #FDE68A',
                        fontSize: '12px',
                        color: '#92400E',
                        lineHeight: '1.5',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#B45309', marginBottom: '4px' }}>
                        <Shield size={14} color="#D97706" />
                        <span>Quy Tắc Kim Tĩnh Bất Biến</span>
                      </div>
                      Huyệt mộ được xây dựng kết cấu Kim Tĩnh kiên cố. Mọi can thiệp hạ cờ, cải táng hoặc mở khóa đều bị từ chối ở cấp CSDL.
                    </div>
                  )}

                  {/* Specs */}
                  <div
                    style={{
                      backgroundColor: '#F8FAFC',
                      padding: '14px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Loại mộ:</span>
                      <strong style={{ color: '#1E293B' }}>{plotDetail.type_name}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Dung lượng:</span>
                      <strong style={{ color: '#1E293B' }}>{plotDetail.default_slots} slot an táng</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Hướng phong thủy:</span>
                      <strong style={{ color: '#1E293B' }}>{plotDetail.orientation || 'Chưa định hướng'}</strong>
                    </div>
                    {plotDetail.latitude && plotDetail.longitude && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid #E2E8F0' }}>
                        <span style={{ color: '#64748B' }}>Tọa độ GPS:</span>
                        <a
                          href={`https://www.google.com/maps?q=${plotDetail.latitude},${plotDetail.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: '#24594D',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 600,
                            fontFamily: 'monospace',
                            fontSize: '11px',
                          }}
                        >
                          {Number(plotDetail.latitude).toFixed(6)}, {Number(plotDetail.longitude).toFixed(6)}
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Active Reservation Banner */}
                  {plotDetail.active_reservation && (
                    <div
                      style={{
                        padding: '12px',
                        backgroundColor: '#FFFBEB',
                        borderRadius: '8px',
                        border: '1px solid #FCD34D',
                        fontSize: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#92400E', fontWeight: 700 }}>
                        <Clock size={14} color="#D97706" />
                        <span>Lệnh giữ chỗ độc quyền (ACTIVE)</span>
                      </div>
                      <div style={{ color: '#334155' }}>
                        Khách hàng: <strong>{plotDetail.active_reservation.customer_name || 'Khách lẻ'}</strong>
                      </div>
                      {plotDetail.active_reservation.customer_phone && (
                        <div style={{ color: '#334155' }}>
                          SĐT: <strong>{plotDetail.active_reservation.customer_phone}</strong>
                        </div>
                      )}
                      <div style={{ color: '#64748B', fontSize: '11px' }}>
                        Hết hạn lúc: {new Date(plotDetail.active_reservation.expires_at).toLocaleString('vi-VN')}
                      </div>
                      <button
                        onClick={() => handleCancelReservation(plotDetail.plot_id)}
                        style={{
                          marginTop: '6px',
                          border: 'none',
                          background: 'none',
                          color: '#DC2626',
                          fontWeight: 600,
                          fontSize: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        Hủy giữ chỗ này
                      </button>
                    </div>
                  )}

                  {/* Slots list */}
                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      Chi Tiết Các Huyệt / Slot ({plotDetail.slots.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {plotDetail.slots.map((s) => (
                        <div
                          key={s.slot_id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            backgroundColor: '#FFFFFF',
                            fontSize: '12px',
                          }}
                        >
                          <strong style={{ color: '#1E293B' }}>Slot #{s.slot_number}</strong>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: s.status === 'OCCUPIED' ? '#FEE2E2' : '#DCFCE7',
                              color: s.status === 'OCCUPIED' ? '#991B1B' : '#166534',
                            }}
                          >
                            {s.status === 'OCCUPIED' ? 'Đã an táng' : 'Còn trống'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ paddingTop: '12px', borderTop: '1px solid #E2E8F0' }}>
                    {plotDetail.status === 'EMPTY_UNSOLD' && (
                      <button
                        onClick={() => {
                          setReserveCustName('');
                          setReserveCustPhone('');
                          setReserveHours(48);
                          setReserveNotes('');
                          setReserveError(null);
                          setReserveSuccess(null);
                          setIsReserveModalOpen(true);
                        }}
                        style={{
                          width: '100%',
                          padding: '10px',
                          backgroundColor: '#24594D',
                          color: '#FFFFFF',
                          borderRadius: '8px',
                          border: 'none',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        }}
                      >
                        <Clock size={15} />
                        <span>Tạm Giữ Chỗ Cho Khách</span>
                      </button>
                    )}

                    {token && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                        <button
                          onClick={() => {
                            setCrudError(null);
                            setPlotModal({ isOpen: true, mode: 'edit', data: plotDetail });
                          }}
                          style={{
                            width: '100%',
                            padding: '9px',
                            backgroundColor: '#F8FAFC',
                            color: '#1E293B',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                          }}
                        >
                          <Edit2 size={14} />
                          <span>Chỉnh Sửa Thông Tin Ô Mộ</span>
                        </button>

                        {plotDetail.status === 'EMPTY_UNSOLD' && !plotDetail.is_kim_tinh && (
                          <button
                            onClick={() => {
                              setCrudError(null);
                              setDeleteModal({
                                isOpen: true,
                                type: 'plot',
                                id: plotDetail.plot_id,
                                name: plotDetail.plot_code,
                              });
                            }}
                            style={{
                              width: '100%',
                              padding: '9px',
                              backgroundColor: '#FEF2F2',
                              color: '#DC2626',
                              borderRadius: '8px',
                              border: '1px solid #FECACA',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                            }}
                          >
                            <Trash2 size={14} />
                            <span>Xóa Ô Mộ Này</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px', color: '#94A3B8' }}>
                  <MapPin size={40} strokeWidth={1.5} color="#CBD5E1" style={{ marginBottom: '12px' }} />
                  <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.5', margin: 0 }}>
                    Nhấp vào một điểm ô mộ trên bản đồ để xem chi tiết kết cấu Kim Tĩnh, danh sách slot và thao tác giữ chỗ.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Grid Layout Matrix (Khu -> Hàng -> Ô mộ) */}
        {activeTab === 'grid' && !isLoading && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredPlots.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94A3B8' }}>
                <Grid size={48} strokeWidth={1} color="#CBD5E1" style={{ margin: '0 auto 10px' }} />
                <p style={{ fontSize: '14px', color: '#64748B' }}>Không tìm thấy ô mộ nào thỏa mãn tiêu chí lọc.</p>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '12px',
                  }}
                >
                  {paginatedGridPlots.map((p) => {
                    let cardBg = '#F0FDF4';
                    let cardBorder = '#BBF7D0';
                    let statusLabel = 'Trống';
                    let statusColor = '#15803D';

                    if (p.status === 'RESERVED') {
                      cardBg = '#FFFBEB';
                      cardBorder = '#FDE68A';
                      statusLabel = 'Giữ chỗ';
                      statusColor = '#B45309';
                    } else if (p.status === 'OWNED_EMPTY') {
                      cardBg = '#EFF6FF';
                      cardBorder = '#BFDBFE';
                      statusLabel = 'Đã có chủ';
                      statusColor = '#1D4ED8';
                    } else if (p.status === 'OCCUPIED') {
                      cardBg = '#FEF2F2';
                      cardBorder = '#FECACA';
                      statusLabel = 'Đã chôn';
                      statusColor = '#B91C1C';
                    }

                    const isSelected = selectedPlotId === p.plot_id;

                    return (
                      <div
                        key={p.plot_id}
                        onClick={() => handleSelectPlot(p.plot_id)}
                        style={{
                          padding: '12px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #24594D' : `1px solid ${cardBorder}`,
                          borderLeft: p.is_kim_tinh ? '4px solid #D97706' : undefined,
                          backgroundColor: cardBg,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 4px 6px -1px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.03)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <strong style={{ fontSize: '13px', color: '#0F172A' }}>{p.plot_code}</strong>
                          {p.is_kim_tinh && (
                            <span title="Kim Tĩnh">
                              <Shield size={14} color="#D97706" />
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.type_name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                          {p.zone_code} · {p.default_slots} slot
                        </div>
                        <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 600, color: statusColor }}>
                          {statusLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: '16px' }}>
                  <Pagination
                    currentPage={gridPage}
                    totalPages={gridTotalPages}
                    totalItems={gridTotalItems}
                    pageSize={gridPageSize}
                    pageSizeOptions={[12, 24, 48, 96]}
                    onPageChange={setGridPage}
                    onPageSizeChange={setGridPageSize}
                    startIndex={gridStartIndex}
                    endIndex={gridEndIndex}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Catalog & Specifications (Khu & Loại Mộ) */}
        {activeTab === 'catalog' && !isLoading && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* CRUD Feedback Alerts */}
            {crudSuccess && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#ECFDF5',
                  color: '#047857',
                  border: '1px solid #A7F3D0',
                  borderRadius: '8px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={16} />
                <span>{crudSuccess}</span>
              </div>
            )}
            {crudError && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#FEF2F2',
                  color: '#B91C1C',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} />
                <span>{crudError}</span>
              </div>
            )}

            {/* Global Actions Toolbar for Tab 3 */}
            {token && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                    Quản Lý Quy Hoạch Không Gian & Danh Mục Kích Thước
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>
                    Cấu hình các phân khu an táng, số lượng hàng mộ và quy cách kích thước huyệt mộ.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      setCrudError(null);
                      setZoneModal({ isOpen: true, mode: 'create', data: null });
                    }}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#24594D',
                      color: '#FFFFFF',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Plus size={14} />
                    <span>Thêm Khu Vực</span>
                  </button>
                  <button
                    onClick={() => {
                      setCrudError(null);
                      setRowModal({ isOpen: true, mode: 'create', data: null });
                    }}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#FFFFFF',
                      color: '#24594D',
                      border: '1px solid #24594D',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Plus size={14} />
                    <span>Thêm Hàng Mộ</span>
                  </button>
                  <button
                    onClick={() => {
                      setCrudError(null);
                      setPlotTypeModal({ isOpen: true, mode: 'create', data: null });
                    }}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#FFFFFF',
                      color: '#24594D',
                      border: '1px solid #24594D',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Plus size={14} />
                    <span>Thêm Loại Mộ</span>
                  </button>
                </div>
              </div>
            )}

            {/* Zones & Rows Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                  Danh Mục Khu Vực (Zones) & Hàng Mộ (Rows) ({zones.length} khu)
                </h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {paginatedZones.map((z) => {
                  const zoneRows = rows.filter((r) => r.zone_id === z.zone_id);
                  return (
                    <div key={z.zone_id} style={{ padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <strong style={{ fontSize: '15px', color: '#0F172A' }}>{z.zone_code}</strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', backgroundColor: '#E2E8F0', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, color: '#475569' }}>
                              {zoneRows.length} hàng
                            </span>
                            {token && (
                              <>
                                <button
                                  onClick={() => {
                                    setCrudError(null);
                                    setZoneModal({ isOpen: true, mode: 'edit', data: z });
                                  }}
                                  title="Chỉnh sửa khu vực"
                                  style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => {
                                    setCrudError(null);
                                    setDeleteModal({ isOpen: true, type: 'zone', id: z.zone_id, name: `${z.zone_code} - ${z.zone_name}` });
                                  }}
                                  title="Xóa khu vực"
                                  style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#24594D', marginBottom: '8px' }}>{z.zone_name}</div>
                        <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px', lineHeight: '1.4' }}>{z.description || 'Khuôn viên tiêu chuẩn.'}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {zoneRows.map((r) => (
                            <div
                              key={r.row_id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '12px',
                                padding: '6px 10px',
                                backgroundColor: '#FFFFFF',
                                borderRadius: '6px',
                                border: '1px solid #E2E8F0',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 600, color: '#334155' }}>{r.row_code}</span>
                                <span style={{ color: '#94A3B8', fontSize: '11px' }}>({r.total_plots} ô)</span>
                              </div>
                              {token && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <button
                                    onClick={() => {
                                      setCrudError(null);
                                      setRowModal({ isOpen: true, mode: 'edit', data: r });
                                    }}
                                    title="Sửa hàng"
                                    style={{ padding: '2px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCrudError(null);
                                      setDeleteModal({ isOpen: true, type: 'row', id: r.row_id, name: `${r.row_code} (${z.zone_code})` });
                                    }}
                                    title="Xóa hàng"
                                    style={{ padding: '2px', background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      {token && (
                        <button
                          onClick={() => {
                            setCrudError(null);
                            setRowModal({ isOpen: true, mode: 'create', data: null, defaultZoneId: z.zone_id });
                          }}
                          style={{
                            marginTop: '12px',
                            padding: '6px',
                            width: '100%',
                            border: '1px dashed #CBD5E1',
                            borderRadius: '6px',
                            backgroundColor: '#FFFFFF',
                            color: '#475569',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                          }}
                        >
                          <Plus size={12} />
                          <span>Thêm hàng vào khu này</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Advanced Modern Pagination for Zones */}
              <div style={{ marginTop: '16px' }}>
                <Pagination
                  currentPage={zonePage}
                  totalPages={zoneTotalPages}
                  totalItems={zoneTotalItems}
                  pageSize={zonePageSize}
                  pageSizeOptions={[6, 12, 24]}
                  onPageChange={setZonePage}
                  onPageSizeChange={setZonePageSize}
                  startIndex={zoneStartIndex}
                  endIndex={zoneEndIndex}
                />
              </div>
            </div>

            {/* Plot Types Section with Pagination */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                  Quy Cách & Kích Thước Loại Mộ (Plot Types) ({plotTypes.length} loại)
                </h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {paginatedPlotTypes.map((pt) => (
                  <div key={pt.type_id} style={{ padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '15px', color: '#0F172A' }}>{pt.type_name}</strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', backgroundColor: '#E8F1EE', color: '#24594D', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                            {pt.default_slots} slot
                          </span>
                          {token && (
                            <>
                              <button
                                onClick={() => {
                                  setCrudError(null);
                                  setPlotTypeModal({ isOpen: true, mode: 'edit', data: pt });
                                }}
                                title="Chỉnh sửa loại mộ"
                                style={{ padding: '3px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => {
                                  setCrudError(null);
                                  setDeleteModal({ isOpen: true, type: 'plot_type', id: pt.type_id, name: pt.type_name });
                                }}
                                title="Xóa loại mộ"
                                style={{ padding: '3px', background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>Kích thước: <strong>{pt.length}m</strong> dài × <strong>{pt.width}m</strong> rộng</div>
                        <div>Diện tích: <strong>{(Number(pt.length) * Number(pt.width)).toFixed(2)} m²</strong></div>
                        <p style={{ fontSize: '11px', color: '#94A3B8', paddingTop: '8px', borderTop: '1px solid #F1F5F9', marginTop: '4px', lineHeight: '1.4' }}>
                          {pt.description || 'Quy cách mộ tiêu chuẩn khuôn viên.'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Advanced Modern Pagination for Plot Types */}
              <div style={{ marginTop: '16px' }}>
                <Pagination
                  currentPage={ptPage}
                  totalPages={ptTotalPages}
                  totalItems={ptTotalItems}
                  pageSize={ptPageSize}
                  pageSizeOptions={[6, 12, 24]}
                  onPageChange={setPtPage}
                  onPageSizeChange={setPtPageSize}
                  startIndex={ptStartIndex}
                  endIndex={ptEndIndex}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Anti-Double Booking Reservation Modal */}
      {isReserveModalOpen && selectedPlotId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', maxWidth: '440px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="#24594D" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Giữ Chỗ Ô Đất Độc Quyền</h3>
              </div>
              <button onClick={() => setIsReserveModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={18} />
              </button>
            </div>

            {reserveError && (
              <div style={{ padding: '10px 14px', backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', marginBottom: '14px' }}>
                {reserveError}
              </div>
            )}

            {reserveSuccess && (
              <div style={{ padding: '10px 14px', backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', borderRadius: '8px', fontSize: '12px', marginBottom: '14px' }}>
                {reserveSuccess}
              </div>
            )}

            <form onSubmit={handleReserveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Họ tên khách hàng
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={reserveCustName}
                  onChange={(e) => setReserveCustName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Số điện thoại liên hệ
                </label>
                <input
                  type="tel"
                  required
                  placeholder="0912345678"
                  value={reserveCustPhone}
                  onChange={(e) => setReserveCustPhone(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Thời hạn giữ chỗ
                </label>
                <select
                  value={reserveHours}
                  onChange={(e) => setReserveHours(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: '#FFFFFF' }}
                >
                  <option value={24}>24 giờ (1 ngày)</option>
                  <option value={48}>48 giờ (2 ngày - Tiêu chuẩn)</option>
                  <option value={72}>72 giờ (3 ngày)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Ghi chú giữ chỗ
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú thêm về yêu cầu giữ chỗ của khách..."
                  value={reserveNotes}
                  onChange={(e) => setReserveNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setIsReserveModalOpen(false)}
                  style={{ flex: 1, padding: '9px', backgroundColor: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isReserving}
                  style={{ flex: 1, padding: '9px', backgroundColor: '#24594D', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isReserving ? 'Đang xác thực...' : 'Xác nhận giữ chỗ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 5. Zone Create / Edit Modal */}
      {zoneModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', maxWidth: '440px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {zoneModal.mode === 'create' ? 'Thêm Phân Khu Mới (Zone)' : `Chỉnh Sửa Khu ${zoneModal.data?.zone_code}`}
              </h3>
              <button onClick={() => setZoneModal({ isOpen: false, mode: 'create', data: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={18} />
              </button>
            </div>

            {crudError && (
              <div style={{ padding: '10px 14px', backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', marginBottom: '14px' }}>
                {crudError}
              </div>
            )}

            <form onSubmit={handleSaveZone} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {zoneModal.mode === 'create' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Mã khu vực (Zone Code) *
                  </label>
                  <input
                    type="text"
                    name="zone_code"
                    required
                    placeholder="Ví dụ: KHU-A, KHU-VIP"
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Tên phân khu *
                </label>
                <input
                  type="text"
                  name="zone_name"
                  required
                  defaultValue={zoneModal.data?.zone_name || ''}
                  placeholder="Ví dụ: Khu An Lạc, Khu Vĩnh Hằng"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Tổng số hàng dự kiến
                </label>
                <input
                  type="number"
                  name="total_rows"
                  min={0}
                  defaultValue={zoneModal.data?.total_rows || 0}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Mô tả phân khu
                </label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={zoneModal.data?.description || ''}
                  placeholder="Vị trí phong thủy, cảnh quan..."
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setZoneModal({ isOpen: false, mode: 'create', data: null })}
                  style={{ flex: 1, padding: '9px', backgroundColor: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ flex: 1, padding: '9px', backgroundColor: '#24594D', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu Khu Vực'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Row Create / Edit Modal */}
      {rowModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', maxWidth: '440px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {rowModal.mode === 'create' ? 'Thêm Hàng Mộ Mới (Row)' : `Chỉnh Sửa Hàng ${rowModal.data?.row_code}`}
              </h3>
              <button onClick={() => setRowModal({ isOpen: false, mode: 'create', data: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={18} />
              </button>
            </div>

            {crudError && (
              <div style={{ padding: '10px 14px', backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', marginBottom: '14px' }}>
                {crudError}
              </div>
            )}

            <form onSubmit={handleSaveRow} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {rowModal.mode === 'create' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Thuộc khu vực (Zone) *
                  </label>
                  <select
                    name="zone_id"
                    required
                    defaultValue={rowModal.defaultZoneId || zones[0]?.zone_id}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: '#FFFFFF' }}
                  >
                    {zones.map((z) => (
                      <option key={z.zone_id} value={z.zone_id}>
                        {z.zone_code} - {z.zone_name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Mã hàng mộ (Row Code) *
                </label>
                <input
                  type="text"
                  name="row_code"
                  required
                  defaultValue={rowModal.data?.row_code || ''}
                  placeholder="Ví dụ: H01, H02, HANG-A"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Tổng số ô mộ trong hàng
                </label>
                <input
                  type="number"
                  name="total_plots"
                  min={0}
                  defaultValue={rowModal.data?.total_plots || 0}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setRowModal({ isOpen: false, mode: 'create', data: null })}
                  style={{ flex: 1, padding: '9px', backgroundColor: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ flex: 1, padding: '9px', backgroundColor: '#24594D', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu Hàng Mộ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Plot Type Create / Edit Modal */}
      {plotTypeModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', maxWidth: '440px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {plotTypeModal.mode === 'create' ? 'Thêm Quy Cách Loại Mộ' : `Chỉnh Sửa Loại ${plotTypeModal.data?.type_name}`}
              </h3>
              <button onClick={() => setPlotTypeModal({ isOpen: false, mode: 'create', data: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={18} />
              </button>
            </div>

            {crudError && (
              <div style={{ padding: '10px 14px', backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', marginBottom: '14px' }}>
                {crudError}
              </div>
            )}

            <form onSubmit={handleSavePlotType} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Tên loại mộ *
                </label>
                <input
                  type="text"
                  name="type_name"
                  required
                  defaultValue={plotTypeModal.data?.type_name || ''}
                  placeholder="Ví dụ: Mộ đơn tiêu chuẩn, Mộ đôi gia tộc"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Số slot an táng mặc định *
                </label>
                <input
                  type="number"
                  name="default_slots"
                  min={1}
                  required
                  defaultValue={plotTypeModal.data?.default_slots || 1}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Chiều dài (m) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="length"
                    required
                    defaultValue={plotTypeModal.data?.length || 2.4}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Chiều rộng (m) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="width"
                    required
                    defaultValue={plotTypeModal.data?.width || 1.2}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Mô tả quy cách
                </label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={plotTypeModal.data?.description || ''}
                  placeholder="Đặc điểm xây dựng, loại đá hoa cương..."
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setPlotTypeModal({ isOpen: false, mode: 'create', data: null })}
                  style={{ flex: 1, padding: '9px', backgroundColor: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ flex: 1, padding: '9px', backgroundColor: '#24594D', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu Loại Mộ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Plot Create / Edit Modal */}
      {plotModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', maxWidth: '480px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {plotModal.mode === 'create' ? 'Khởi Tạo Ô Mộ Mới' : `Chỉnh Sửa Ô Mộ ${plotModal.data?.plot_code}`}
              </h3>
              <button onClick={() => setPlotModal({ isOpen: false, mode: 'create', data: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={18} />
              </button>
            </div>

            {crudError && (
              <div style={{ padding: '10px 14px', backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', marginBottom: '14px' }}>
                {crudError}
              </div>
            )}

            <form onSubmit={handleSavePlot} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {plotModal.mode === 'create' ? (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Mã số ô mộ *
                    </label>
                    <input
                      type="text"
                      name="plot_code"
                      required
                      placeholder="Ví dụ: A-H01-P01"
                      style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Thuộc Hàng Mộ (Row) *
                    </label>
                    <select
                      name="row_id"
                      required
                      defaultValue={rows[0]?.row_id}
                      style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: '#FFFFFF' }}
                    >
                      {rows.map((r) => {
                        const z = zones.find((zItem) => zItem.zone_id === r.zone_id);
                        return (
                          <option key={r.row_id} value={r.row_id}>
                            {z?.zone_code || 'Khu'} · {r.row_code}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </>
              ) : null}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Quy cách Loại Mộ *
                </label>
                <select
                  name="type_id"
                  required
                  defaultValue={plotModal.data ? ('type_id' in plotModal.data ? plotModal.data.type_id : plotTypes[0]?.type_id) : plotTypes[0]?.type_id}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: '#FFFFFF' }}
                >
                  {plotTypes.map((pt) => (
                    <option key={pt.type_id} value={pt.type_id}>
                      {pt.type_name} ({pt.default_slots} slot, {pt.length}m × {pt.width}m)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Hướng phong thủy
                </label>
                <select
                  name="orientation"
                  defaultValue={plotModal.data && 'orientation' in plotModal.data && plotModal.data.orientation ? plotModal.data.orientation : 'ĐÔNG'}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: '#FFFFFF' }}
                >
                  <option value="ĐÔNG">ĐÔNG</option>
                  <option value="TÂY">TÂY</option>
                  <option value="NAM">NAM</option>
                  <option value="BẮC">BẮC</option>
                  <option value="ĐÔNG NAM">ĐÔNG NAM</option>
                  <option value="ĐÔNG BẮC">ĐÔNG BẮC</option>
                  <option value="TÂY NAM">TÂY NAM</option>
                  <option value="TÂY BẮC">TÂY BẮC</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Vĩ độ (Latitude)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    name="latitude"
                    defaultValue={plotModal.data && 'latitude' in plotModal.data && plotModal.data.latitude ? Number(plotModal.data.latitude) : 10.925200}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Kinh độ (Longitude)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    name="longitude"
                    defaultValue={plotModal.data && 'longitude' in plotModal.data && plotModal.data.longitude ? Number(plotModal.data.longitude) : 106.825200}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                  />
                </div>
              </div>

              {/* Kim Tĩnh Invariant Checkbox */}
              <div style={{ padding: '10px 12px', backgroundColor: '#FEF3C7', borderRadius: '8px', border: '1px solid #FDE68A' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#92400E', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="is_kim_tinh"
                    defaultChecked={Boolean(plotModal.data?.is_kim_tinh)}
                    disabled={Boolean(plotModal.data?.is_kim_tinh)}
                  />
                  <span>Kết cấu Kim Tĩnh kiên cố (Bất biến)</span>
                </label>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#B45309', lineHeight: '1.4' }}>
                  Lưu ý: Một khi đã bật cờ Kim Tĩnh, ô mộ sẽ bị khóa vĩnh viễn ở cấp CSDL, không thể hạ cờ hay xóa bỏ.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Ghi chú ô mộ
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={plotModal.data && 'notes' in plotModal.data && plotModal.data.notes ? plotModal.data.notes : ''}
                  placeholder="Ghi chú thêm về vị trí, khuôn viên..."
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setPlotModal({ isOpen: false, mode: 'create', data: null })}
                  style={{ flex: 1, padding: '9px', backgroundColor: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ flex: 1, padding: '9px', backgroundColor: '#24594D', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu Ô Mộ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Delete Confirmation Modal */}
      {deleteModal && deleteModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', maxWidth: '420px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={20} color="#DC2626" />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Xác Nhận Xóa Dữ Liệu
              </h3>
            </div>

            {crudError && (
              <div style={{ padding: '10px 14px', backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', marginBottom: '14px' }}>
                {crudError}
              </div>
            )}

            <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6', margin: '0 0 16px 0' }}>
              Bạn có chắc chắn muốn xóa <strong>{deleteModal.name}</strong> không?
              Hành động này không thể hoàn tác nếu mục này chưa có dữ liệu phụ thuộc hoặc hợp đồng liên kết.
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                style={{ flex: 1, padding: '9px', backgroundColor: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDelete}
                style={{ flex: 1, padding: '9px', backgroundColor: '#DC2626', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                {isSubmitting ? 'Đang xóa...' : 'Xác Nhận Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
