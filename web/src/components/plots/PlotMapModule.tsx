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
            {/* Zones & Rows */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
                Danh Mục Khu Vực (Zones) & Hàng Mộ (Rows)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {zones.map((z) => {
                  const zoneRows = rows.filter((r) => r.zone_id === z.zone_id);
                  return (
                    <div key={z.zone_id} style={{ padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '15px', color: '#0F172A' }}>{z.zone_code}</strong>
                        <span style={{ fontSize: '11px', backgroundColor: '#E2E8F0', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, color: '#475569' }}>
                          {zoneRows.length} hàng
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#24594D', marginBottom: '8px' }}>{z.zone_name}</div>
                      <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px', lineHeight: '1.4' }}>{z.description || 'Khuôn viên tiêu chuẩn.'}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {zoneRows.map((r) => (
                          <div
                            key={r.row_id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '12px',
                              padding: '4px 8px',
                              backgroundColor: '#FFFFFF',
                              borderRadius: '4px',
                              border: '1px solid #E2E8F0',
                            }}
                          >
                            <span style={{ fontWeight: 500, color: '#334155' }}>{r.row_code}</span>
                            <span style={{ color: '#64748B' }}>{r.total_plots} ô</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Plot Types */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
                Quy Cách & Kích Thước Loại Mộ (Plot Types)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {plotTypes.map((pt) => (
                  <div key={pt.type_id} style={{ padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '15px', color: '#0F172A' }}>{pt.type_name}</strong>
                      <span style={{ fontSize: '11px', backgroundColor: '#E8F1EE', color: '#24594D', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        {pt.default_slots} slot
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>Kích thước: <strong>{pt.length}m</strong> dài × <strong>{pt.width}m</strong> rộng</div>
                      <div>Diện tích: <strong>{(Number(pt.length) * Number(pt.width)).toFixed(2)} m²</strong></div>
                      <p style={{ fontSize: '11px', color: '#94A3B8', paddingTop: '8px', borderTop: '1px solid #F1F5F9', marginTop: '4px' }}>
                        {pt.description || 'Quy cách mộ tiêu chuẩn khuôn viên.'}
                      </p>
                    </div>
                  </div>
                ))}
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
    </div>
  );
};
