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

  // Helper for status badge
  const renderStatusBadge = (status: string, isKimTinh: boolean, isLocked: boolean) => {
    let bg = 'bg-gray-100 text-gray-700 border-gray-200';
    let text = status;

    switch (status) {
      case 'EMPTY_UNSOLD':
        bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        text = 'Đất trống chưa bán';
        break;
      case 'RESERVED':
        bg = 'bg-amber-50 text-amber-700 border-amber-200';
        text = 'Đang tạm giữ chỗ';
        break;
      case 'OWNED_EMPTY':
        bg = 'bg-blue-50 text-blue-700 border-blue-200';
        text = 'Đã có chủ (Chờ an táng)';
        break;
      case 'UNDER_CONSTRUCTION':
        bg = 'bg-purple-50 text-purple-700 border-purple-200';
        text = 'Đang thi công huyệt';
        break;
      case 'OCCUPIED':
        bg = 'bg-red-50 text-red-700 border-red-200';
        text = 'Đã an táng';
        break;
      case 'UNDER_EXHUMATION':
        bg = 'bg-zinc-100 text-zinc-700 border-zinc-300';
        text = 'Đang cải táng';
        break;
    }

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${bg}`}>
          {text}
        </span>
        {isKimTinh && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300" title="Kết cấu Kim Tĩnh kiên cố">
            <Shield className="w-3 h-3 text-amber-600" />
            Kim Tĩnh
          </span>
        )}
        {isLocked && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-300" title="Khóa vĩnh viễn (Quy tắc Kim Tĩnh)">
            🔒 Khóa
          </span>
        )}
      </div>
    );
  };

  // If not logged in
  if (!token) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center max-w-xl mx-auto my-12 shadow-sm">
        <div className="w-16 h-16 bg-[#24594D]/10 rounded-full flex items-center justify-center mx-auto mb-4 text-[#24594D]">
          <MapPin className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Quản Lý Không Gian & Bản Đồ Ô Mộ</h3>
        <p className="text-gray-600 mb-6 text-sm">
          Vui lòng đăng nhập với tài khoản Kinh Doanh, Quản Trang hoặc Quản Trị để tra cứu bản đồ số GIS, vị trí ô mộ, kiểm tra Kim Tĩnh và thực hiện giữ chỗ độc quyền.
        </p>
        <button
          onClick={onRequireLogin}
          className="px-6 py-2.5 bg-[#24594D] text-white rounded-lg font-medium hover:bg-[#1b433a] transition-colors shadow-sm"
        >
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & KPI Statistics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-[#24594D]" />
            Bản Đồ Số GIS & Quản Lý Ô Mộ
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Không gian thực địa, phân lô, giám sát kết cấu Kim Tĩnh kiên cố và chống tranh chấp đặt chỗ.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-xs font-medium text-gray-500">Tổng số ô mộ</span>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total_plots}</div>
          </div>
          <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 shadow-sm">
            <span className="text-xs font-medium text-emerald-800">Đất trống chưa bán</span>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{stats.empty_unsold}</div>
          </div>
          <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 shadow-sm">
            <span className="text-xs font-medium text-amber-800">Đang tạm giữ chỗ</span>
            <div className="text-2xl font-bold text-amber-700 mt-1">{stats.reserved}</div>
          </div>
          <div className="bg-red-50/60 p-4 rounded-xl border border-red-200 shadow-sm">
            <span className="text-xs font-medium text-red-800">Đã an táng</span>
            <div className="text-2xl font-bold text-red-700 mt-1">{stats.occupied}</div>
          </div>
          <div className="bg-yellow-50/60 p-4 rounded-xl border border-yellow-300 shadow-sm">
            <span className="text-xs font-medium text-yellow-900 flex items-center gap-1">
              <Shield className="w-3 h-3 text-yellow-600" />
              Mộ Kim Tĩnh
            </span>
            <div className="text-2xl font-bold text-yellow-800 mt-1">{stats.kim_tinh_count}</div>
          </div>
          <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-200 shadow-sm">
            <span className="text-xs font-medium text-rose-900 flex items-center gap-1">
              🔒 Đã khóa vĩnh viễn
            </span>
            <div className="text-2xl font-bold text-rose-700 mt-1">{stats.locked_count}</div>
          </div>
        </div>
      )}

      {/* 2. Navigation Tabs & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('map')}
              className={`py-4 px-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'map'
                  ? 'border-[#24594D] text-[#24594D]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <MapPin className="w-4 h-4" />
              Bản Đồ Số GIS (Leaflet Map)
            </button>
            <button
              onClick={() => setActiveTab('grid')}
              className={`py-4 px-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'grid'
                  ? 'border-[#24594D] text-[#24594D]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Grid className="w-4 h-4" />
              Ma Trận Phân Lô Thực Địa
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`py-4 px-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'catalog'
                  ? 'border-[#24594D] text-[#24594D]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Layers className="w-4 h-4" />
              Danh Mục Khu Vực & Loại Mộ
            </button>
          </div>
        </div>

        {/* Global Filters Bar */}
        <div className="p-4 bg-gray-50/50 border-b border-gray-200 flex flex-wrap items-center gap-3">
          {/* Zone filter */}
          <select
            value={selectedZoneId || ''}
            onChange={(e) => setSelectedZoneId(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#24594D]"
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
            className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#24594D]"
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
            className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#24594D]"
          >
            <option value="">-- Tất cả kết cấu --</option>
            <option value="true">Chỉ mộ Kim Tĩnh</option>
            <option value="false">Mộ tiêu chuẩn (Không Kim Tĩnh)</option>
          </select>

          {/* Search box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo mã ô mộ (ví dụ: A-H01-01)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#24594D]"
            />
          </div>

          <span className="text-xs text-gray-500 font-medium">
            Hiển thị: <b>{filteredPlots.length}</b> / {plots.length} ô
          </span>
        </div>

        {/* 3. Main Tab Contents */}
        {isLoading && (
          <div className="p-16 text-center">
            <RefreshCw className="w-8 h-8 text-[#24594D] animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Đang tải dữ liệu không gian và bản đồ...</p>
          </div>
        )}

        {errorMessage && (
          <div className="p-6 bg-red-50 text-red-700 border-b border-red-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm font-medium">{errorMessage}</span>
            </div>
            <button
              onClick={fetchData}
              className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* TAB 1: Leaflet Interactive GIS Map */}
        {activeTab === 'map' && !isLoading && (
          <div className="relative h-[650px] w-full flex">
            {/* Left: Leaflet Map Container */}
            <div ref={mapContainerRef} className="flex-1 h-full z-0" />

            {/* Right: Floating Plot Detail Sidebar */}
            <div className="w-80 md:w-96 border-l border-gray-200 bg-white h-full overflow-y-auto p-5 shadow-lg z-10 flex flex-col">
              {selectedPlotId && plotDetail ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{plotDetail.plot_code}</h3>
                      <p className="text-xs text-gray-500">
                        {plotDetail.zone_name} · {plotDetail.row_code}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPlotId(null);
                        setPlotDetail(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Status & Kim Tinh Badges */}
                  <div>
                    {renderStatusBadge(plotDetail.status, plotDetail.is_kim_tinh, plotDetail.is_locked)}
                  </div>

                  {/* Kim Tinh Warning Banner if locked */}
                  {plotDetail.is_kim_tinh && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-800 mb-1">
                        <Shield className="w-4 h-4 text-amber-600" />
                        Quy Tắc Kim Tĩnh Bất Biến
                      </div>
                      Huyệt mộ được xây dựng kết cấu Kim Tĩnh kiên cố. Mọi can thiệp hạ cờ, cải táng hoặc mở khóa đều bị từ chối ở cấp CSDL.
                    </div>
                  )}

                  {/* Specs */}
                  <div className="bg-gray-50 p-3 rounded-lg space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Loại mộ:</span>
                      <span className="font-semibold text-gray-800">{plotDetail.type_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Dung lượng:</span>
                      <span className="font-semibold text-gray-800">{plotDetail.default_slots} slot an táng</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Hướng phong thủy:</span>
                      <span className="font-semibold text-gray-800">{plotDetail.orientation || 'Chưa định hướng'}</span>
                    </div>
                    {plotDetail.latitude && plotDetail.longitude && (
                      <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                        <span className="text-gray-500">Tọa độ GPS:</span>
                        <a
                          href={`https://www.google.com/maps?q=${plotDetail.latitude},${plotDetail.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#24594D] hover:underline flex items-center gap-1 font-mono text-[11px]"
                        >
                          {Number(plotDetail.latitude).toFixed(6)}, {Number(plotDetail.longitude).toFixed(6)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Active Reservation Banner */}
                  {plotDetail.active_reservation && (
                    <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-300 text-xs space-y-1">
                      <div className="flex items-center gap-1 text-amber-800 font-bold">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Lệnh giữ chỗ độc quyền (ACTIVE)
                      </div>
                      <div className="text-gray-700">
                        Khách hàng: <b>{plotDetail.active_reservation.customer_name || 'Khách lẻ'}</b>
                      </div>
                      {plotDetail.active_reservation.customer_phone && (
                        <div className="text-gray-700">
                          SĐT: <b>{plotDetail.active_reservation.customer_phone}</b>
                        </div>
                      )}
                      <div className="text-gray-500 text-[11px]">
                        Hết hạn lúc: {new Date(plotDetail.active_reservation.expires_at).toLocaleString('vi-VN')}
                      </div>
                      <button
                        onClick={() => handleCancelReservation(plotDetail.plot_id)}
                        className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700 underline"
                      >
                        Hủy giữ chỗ này
                      </button>
                    </div>
                  )}

                  {/* Slots list */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Chi Tiết Các Huyệt / Slot ({plotDetail.slots.length})
                    </h4>
                    <div className="space-y-1.5">
                      {plotDetail.slots.map((s) => (
                        <div
                          key={s.slot_id}
                          className="flex items-center justify-between p-2 rounded border border-gray-200 bg-white text-xs"
                        >
                          <span className="font-semibold text-gray-800">Slot #{s.slot_number}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                              s.status === 'OCCUPIED'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {s.status === 'OCCUPIED' ? 'Đã an táng' : 'Còn trống'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-gray-200 flex flex-col gap-2">
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
                        className="w-full py-2 bg-[#24594D] text-white rounded-lg text-xs font-semibold hover:bg-[#1b433a] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Tạm Giữ Chỗ Cho Khách (Anti-Double Booking)
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                  <MapPin className="w-10 h-10 mb-2 stroke-1 text-gray-300" />
                  <p className="text-xs text-gray-500">
                    Nhấp vào một điểm ô mộ trên bản đồ để xem chi tiết kết cấu Kim Tĩnh, danh sách slot và thao tác giữ chỗ.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Grid Layout Matrix (Khu -> Hàng -> Ô mộ) */}
        {activeTab === 'grid' && !isLoading && (
          <div className="p-6 space-y-6">
            {filteredPlots.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Grid className="w-12 h-12 mx-auto mb-2 text-gray-300 stroke-1" />
                <p className="text-sm">Không tìm thấy ô mộ nào thỏa mãn tiêu chí lọc.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {filteredPlots.map((p) => {
                  let statusBg = 'bg-emerald-50 border-emerald-200 hover:border-emerald-400';
                  if (p.status === 'RESERVED') statusBg = 'bg-amber-50 border-amber-300 hover:border-amber-400';
                  else if (p.status === 'OWNED_EMPTY') statusBg = 'bg-blue-50 border-blue-200 hover:border-blue-400';
                  else if (p.status === 'OCCUPIED') statusBg = 'bg-red-50 border-red-200 hover:border-red-400';

                  const isSelected = selectedPlotId === p.plot_id;

                  return (
                    <div
                      key={p.plot_id}
                      onClick={() => handleSelectPlot(p.plot_id)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${statusBg} ${
                        isSelected ? 'ring-2 ring-[#24594D] shadow-md' : 'hover:shadow'
                      } ${p.is_kim_tinh ? 'border-l-4 border-l-amber-500' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-900 text-xs">{p.plot_code}</span>
                        {p.is_kim_tinh && <Shield className="w-3.5 h-3.5 text-amber-600" />}
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">{p.type_name}</div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        {p.zone_code} · {p.default_slots} slot
                      </div>
                      <div className="mt-2 text-[10px] font-semibold">
                        {p.status === 'EMPTY_UNSOLD' && <span className="text-emerald-700">Trống</span>}
                        {p.status === 'RESERVED' && <span className="text-amber-700">Giữ chỗ</span>}
                        {p.status === 'OCCUPIED' && <span className="text-red-700">Đã chôn</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Catalog & Specifications (Khu & Loại Mộ) */}
        {activeTab === 'catalog' && !isLoading && (
          <div className="p-6 space-y-8">
            {/* Zones & Rows */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3">
                Danh Mục Khu Vực (Zones) & Hàng Mộ (Rows)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {zones.map((z) => {
                  const zoneRows = rows.filter((r) => r.zone_id === z.zone_id);
                  return (
                    <div key={z.zone_id} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-gray-900">{z.zone_code}</span>
                        <span className="text-xs bg-gray-200 px-2 py-0.5 rounded font-medium text-gray-700">
                          {zoneRows.length} hàng
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[#24594D] mb-2">{z.zone_name}</div>
                      <p className="text-xs text-gray-500 mb-3">{z.description || 'Không có mô tả.'}</p>
                      <div className="space-y-1">
                        {zoneRows.map((r) => (
                          <div
                            key={r.row_id}
                            className="flex justify-between items-center text-xs py-1 px-2 bg-white rounded border border-gray-200"
                          >
                            <span className="font-medium text-gray-700">{r.row_code}</span>
                            <span className="text-gray-500">{r.total_plots} ô</span>
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
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3">
                Quy Cách & Kích Thước Loại Mộ (Plot Types)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plotTypes.map((pt) => (
                  <div key={pt.type_id} className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-gray-900">{pt.type_name}</span>
                      <span className="text-xs bg-[#24594D]/10 text-[#24594D] px-2 py-0.5 rounded font-bold">
                        {pt.default_slots} slot
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mt-2 space-y-1">
                      <div>
                        Kích thước: <b>{pt.length}m</b> dài × <b>{pt.width}m</b> rộng
                      </div>
                      <div>
                        Diện tích: <b>{(Number(pt.length) * Number(pt.width)).toFixed(2)} m²</b>
                      </div>
                      <p className="text-xs text-gray-500 pt-2 border-t mt-2">
                        {pt.description || 'Quy cách mộ theo chuẩn cảnh quan.'}
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#24594D]" />
                <h3 className="text-lg font-bold text-gray-900">Giữ Chỗ Ô Đất Độc Quyền</h3>
              </div>
              <button onClick={() => setIsReserveModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {reserveError && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium">
                {reserveError}
              </div>
            )}

            {reserveSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium">
                {reserveSuccess}
              </div>
            )}

            <form onSubmit={handleReserveSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Họ tên khách hàng
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={reserveCustName}
                  onChange={(e) => setReserveCustName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#24594D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Số điện thoại liên hệ
                </label>
                <input
                  type="tel"
                  required
                  placeholder="0912345678"
                  value={reserveCustPhone}
                  onChange={(e) => setReserveCustPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#24594D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Thời hạn giữ chỗ
                </label>
                <select
                  value={reserveHours}
                  onChange={(e) => setReserveHours(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#24594D]"
                >
                  <option value={24}>24 giờ (1 ngày)</option>
                  <option value={48}>48 giờ (2 ngày - Tiêu chuẩn)</option>
                  <option value={72}>72 giờ (3 ngày)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Ghi chú giữ chỗ
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú thêm về yêu cầu giữ chỗ của khách..."
                  value={reserveNotes}
                  onChange={(e) => setReserveNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#24594D]"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsReserveModalOpen(false)}
                  className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isReserving}
                  className="flex-1 py-2 bg-[#24594D] text-white rounded-lg text-xs font-semibold hover:bg-[#1b433a] disabled:opacity-50"
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
