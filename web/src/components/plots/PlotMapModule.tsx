import { apiFetch } from '../../services/apiClient'
import React, { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { GeographicPlotMap } from './GeographicPlotMap';
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
  ChevronDown,
  ChevronRight,
  Zap,
  ArrowUpDown,
  Filter,
  Eye,
  List,
  Table,
  Copy,
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
import { useAuth } from '../../context/useAuth';
import { useNotificationModal } from '../../context/NotificationModalContext';
import { SimulatedPlotMap } from './SimulatedPlotMap';

interface PlotMapModuleProps {
  token: string | null;
  onRequireLogin: () => void;
}

export const PlotMapModule: React.FC<PlotMapModuleProps> = ({
  token,
  onRequireLogin,
}) => {
  const { hasPermission } = useAuth();
  const { confirm, alert: modalAlert } = useNotificationModal();
  const canManagePlots = hasPermission('plots:manage');

  // Tab state: Default to Simulated Layout
  const [activeTab, setActiveTab] = useState<'simulated' | 'map' | 'grid' | 'catalog'>('map');

  // Data states
  const [plots, setPlots] = useState<Plot[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [plotTypes, setPlotTypes] = useState<PlotType[]>([]);
  const [stats, setStats] = useState<PlotStats | null>(null);

  // Filter states
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedFilterRowId, setSelectedFilterRowId] = useState<number | null>(null);
  const [modalZoneId, setModalZoneId] = useState<number | null>(null);
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

  // Catalog tab advanced management state
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [catalogOccupancyFilter, setCatalogOccupancyFilter] = useState<'ALL' | 'AVAILABLE' | 'OCCUPIED' | 'HIGH_OCCUPANCY'>('ALL');
  const [catalogSort, setCatalogSort] = useState<'CODE_ASC' | 'CODE_DESC' | 'OCCUPANCY_DESC' | 'OCCUPANCY_ASC' | 'PLOTS_DESC'>('CODE_ASC');
  const [catalogViewMode, setCatalogViewMode] = useState<'CARDS' | 'TREE' | 'TABLE'>('CARDS');
  const [expandedZoneIds, setExpandedZoneIds] = useState<number[]>([]);
  const [expandedRowIds, setExpandedRowIds] = useState<number[]>([]);

  // Plot Types filter/sort state
  const [ptSearch, setPtSearch] = useState<string>('');
  const [ptSort, setPtSort] = useState<'NAME_ASC' | 'NAME_DESC' | 'AREA_DESC' | 'SLOTS_DESC'>('NAME_ASC');

  // Modals for batch generator & row plot view
  const [rowPlotsModal, setRowPlotsModal] = useState<{ isOpen: boolean; row: Row | null; zone: Zone | null }>({
    isOpen: false,
    row: null,
    zone: null,
  });
  const [batchRowModal, setBatchRowModal] = useState<{ isOpen: boolean; defaultZoneId?: number }>({
    isOpen: false,
  });
  const [batchPlotModal, setBatchPlotModal] = useState<{ isOpen: boolean; defaultZoneId?: number; defaultRowId?: number }>({
    isOpen: false,
  });
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; message: string } | null>(null);

  // Form states
  const [crudError, setCrudError] = useState<string | null>(null);
  const [crudSuccess, setCrudSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Standard states: loading, error
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Leaflet map container reference

  // 1. Fetch initial data
  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      const loadPlots = async (): Promise<Plot[]> => {
        const all: Plot[] = [];
        for (let offset = 0; ; offset += 500) {
          const res = await apiFetch(`/api/v1/plots?limit=500&skip=${offset}`, { headers });
          if (!res.ok) throw new Error('Chưa tải được danh sách ô mộ.');
          const page: Plot[] = await res.json();
          all.push(...page);
          if (page.length < 500) return all;
        }
      };
      const [plotsData, zonesRes, rowsRes, typesRes, statsRes] = await Promise.all([
        loadPlots(),
        apiFetch('/api/v1/plots/zones', { headers }),
        apiFetch('/api/v1/plots/rows', { headers }),
        apiFetch('/api/v1/plots/types', { headers }),
        apiFetch('/api/v1/plots/stats', { headers }),
      ]);

      if (![zonesRes, rowsRes, typesRes, statsRes].every(res => res.ok)) throw new Error('Chưa tải đủ thông tin khu và hàng mộ.');
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
      const res = await apiFetch(`/api/v1/plots/${plotId}`, {
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
      if (selectedFilterRowId !== null && p.row_id !== selectedFilterRowId) return false;
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

  // 4. Handle Reserve Submission (Anti-Double Booking)
  const handleReserveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedPlotId) return;

    setIsReserving(true);
    setReserveError(null);
    setReserveSuccess(null);

    try {
      const res = await apiFetch(`/api/v1/plots/${selectedPlotId}/reserve`, {
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
    const confirmed = await confirm({
      title: 'Hủy giữ chỗ ô mộ',
      message: 'Bạn có chắc chắn muốn hủy giữ chỗ cho ô mộ này không? Ô mộ sẽ quay về trạng thái Trống và mở lại cho khách hàng khác.',
      confirmText: 'Hủy giữ chỗ',
      cancelText: 'Quay lại',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      const res = await apiFetch(`/api/v1/plots/${plotId}/cancel-reservation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        await modalAlert({ message: data.detail || 'Không thể hủy giữ chỗ.', type: 'error' });
        return;
      }
      await fetchData();
      await fetchPlotDetail(plotId);
    } catch {
      await modalAlert({ message: 'Lỗi kết nối khi hủy giữ chỗ.', type: 'error' });
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

  // Precompute statistics for zones & rows to provide instant navigation, search, and occupancy filtering
  const { zoneStatsMap, rowStatsMap } = React.useMemo(() => {
    const zMap = new Map<number, { totalPlots: number; occupiedPlots: number; availablePlots: number; reservedPlots: number }>();
    const rMap = new Map<number, { totalPlots: number; occupiedPlots: number; availablePlots: number; reservedPlots: number }>();

    for (const z of zones) {
      zMap.set(z.zone_id, { totalPlots: 0, occupiedPlots: 0, availablePlots: 0, reservedPlots: 0 });
    }
    for (const r of rows) {
      rMap.set(r.row_id, { totalPlots: 0, occupiedPlots: 0, availablePlots: 0, reservedPlots: 0 });
    }

    for (const p of plots) {
      const zStat = zMap.get(p.zone_id);
      if (zStat) {
        zStat.totalPlots += 1;
        if (p.status === 'OCCUPIED') zStat.occupiedPlots += 1;
        else if (p.status === 'EMPTY_UNSOLD') zStat.availablePlots += 1;
        else if (p.status === 'RESERVED') zStat.reservedPlots += 1;
      }
      const rStat = rMap.get(p.row_id);
      if (rStat) {
        rStat.totalPlots += 1;
        if (p.status === 'OCCUPIED') rStat.occupiedPlots += 1;
        else if (p.status === 'EMPTY_UNSOLD') rStat.availablePlots += 1;
        else if (p.status === 'RESERVED') rStat.reservedPlots += 1;
      }
    }

    return { zoneStatsMap: zMap, rowStatsMap: rMap };
  }, [zones, rows, plots]);

  // Filtered & sorted zones for Catalog Tab
  const filteredZones = React.useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return zones.filter((z) => {
      const zoneRows = rows.filter((r) => r.zone_id === z.zone_id);
      const zonePlots = plots.filter((p) => p.zone_id === z.zone_id);

      // Search matching zone code/name, row codes, or plot codes
      if (q) {
        const matchesZone = z.zone_code.toLowerCase().includes(q) || z.zone_name.toLowerCase().includes(q) || (z.description && z.description.toLowerCase().includes(q));
        const matchesRow = zoneRows.some((r) => r.row_code.toLowerCase().includes(q));
        const matchesPlot = zonePlots.some((p) => p.plot_code.toLowerCase().includes(q));
        if (!matchesZone && !matchesRow && !matchesPlot) return false;
      }

      // Occupancy filter
      const stat = zoneStatsMap.get(z.zone_id) || { totalPlots: 0, occupiedPlots: 0, availablePlots: 0, reservedPlots: 0 };
      const rate = stat.totalPlots > 0 ? (stat.occupiedPlots / stat.totalPlots) * 100 : 0;
      if (catalogOccupancyFilter === 'AVAILABLE' && stat.availablePlots === 0) return false;
      if (catalogOccupancyFilter === 'OCCUPIED' && stat.occupiedPlots === 0) return false;
      if (catalogOccupancyFilter === 'HIGH_OCCUPANCY' && rate < 80) return false;

      return true;
    }).sort((a, b) => {
      const statA = zoneStatsMap.get(a.zone_id) || { totalPlots: 0, occupiedPlots: 0, availablePlots: 0, reservedPlots: 0 };
      const statB = zoneStatsMap.get(b.zone_id) || { totalPlots: 0, occupiedPlots: 0, availablePlots: 0, reservedPlots: 0 };
      const rateA = statA.totalPlots > 0 ? statA.occupiedPlots / statA.totalPlots : 0;
      const rateB = statB.totalPlots > 0 ? statB.occupiedPlots / statB.totalPlots : 0;

      if (catalogSort === 'CODE_ASC') return a.zone_code.localeCompare(b.zone_code);
      if (catalogSort === 'CODE_DESC') return b.zone_code.localeCompare(a.zone_code);
      if (catalogSort === 'OCCUPANCY_DESC') return rateB - rateA;
      if (catalogSort === 'OCCUPANCY_ASC') return rateA - rateB;
      if (catalogSort === 'PLOTS_DESC') return statB.totalPlots - statA.totalPlots;
      return 0;
    });
  }, [zones, rows, plots, catalogSearch, catalogOccupancyFilter, catalogSort, zoneStatsMap]);

  // Filtered & sorted Plot Types
  const filteredPlotTypes = React.useMemo(() => {
    const q = ptSearch.trim().toLowerCase();
    return plotTypes.filter((pt) => {
      if (!q) return true;
      return pt.type_name.toLowerCase().includes(q) || (pt.description && pt.description.toLowerCase().includes(q));
    }).sort((a, b) => {
      if (ptSort === 'NAME_ASC') return a.type_name.localeCompare(b.type_name);
      if (ptSort === 'NAME_DESC') return b.type_name.localeCompare(a.type_name);
      if (ptSort === 'AREA_DESC') return (Number(b.length) * Number(b.width)) - (Number(a.length) * Number(a.width));
      if (ptSort === 'SLOTS_DESC') return b.default_slots - a.default_slots;
      return 0;
    });
  }, [plotTypes, ptSearch, ptSort]);

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
  } = usePagination(filteredPlotTypes, 6);

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
  } = usePagination(filteredZones, 6);

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
        const res = await apiFetch('/api/v1/plots/zones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ zone_code: code, zone_name: name, total_rows: rowsCount, description: desc }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Không thể tạo khu vực.');
        }
      } else if (zoneModal.data) {
        const res = await apiFetch(`/api/v1/plots/zones/${zoneModal.data.zone_id}`, {
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
        const res = await apiFetch('/api/v1/plots/rows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ zone_id: zoneId, row_code: code, total_plots: plotsCount }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Không thể tạo hàng mộ.');
        }
      } else if (rowModal.data) {
        const res = await apiFetch(`/api/v1/plots/rows/${rowModal.data.row_id}`, {
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
        const res = await apiFetch('/api/v1/plots/types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ type_name: name, default_slots: defaultSlots, length, width, description: desc }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Không thể tạo loại mộ.');
        }
      } else if (plotTypeModal.data) {
        const res = await apiFetch(`/api/v1/plots/types/${plotTypeModal.data.type_id}`, {
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
        const res = await apiFetch('/api/v1/plots', {
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
            is_kim_tinh: false,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Không thể tạo ô mộ.');
        }
      } else if (plotModal.data) {
        const pId = 'plot_id' in plotModal.data ? plotModal.data.plot_id : 0;
        const res = await apiFetch(`/api/v1/plots/${pId}`, {
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

      const res = await apiFetch(endpoint, {
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

  // Batch Row Generator Handler
  const handleBatchCreateRows = async (
    zoneId: number,
    prefix: string,
    startNum: number,
    endNum: number,
    digits: number,
    totalPlotsPerRow: number
  ) => {
    if (!token) return;
    setIsBatchGenerating(true);
    setCrudError(null);
    const total = Math.max(1, endNum - startNum + 1);
    setBatchProgress({ current: 0, total, message: 'Đang bắt đầu tạo hàng loạt dãy hàng...' });
    try {
      let createdCount = 0;
      for (let i = startNum; i <= endNum; i++) {
        const paddedNum = String(i).padStart(digits, '0');
        const rowCode = `${prefix}${paddedNum}`;
        setBatchProgress({ current: createdCount + 1, total, message: `Đang tạo hàng ${rowCode}...` });

        const res = await apiFetch('/api/v1/plots/rows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            zone_id: zoneId,
            row_code: rowCode,
            total_plots: totalPlotsPerRow,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn(`Bỏ qua hàng ${rowCode}:`, errData.detail || 'Đã tồn tại hoặc lỗi tạo.');
        } else {
          createdCount++;
        }
      }
      setCrudSuccess(`Đã tạo thành công ${createdCount} dãy hàng!`);
      await fetchData();
      setBatchRowModal({ isOpen: false });
      setTimeout(() => setCrudSuccess(null), 3500);
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : 'Lỗi khi tạo hàng loạt dãy hàng.');
    } finally {
      setIsBatchGenerating(false);
      setBatchProgress(null);
    }
  };

  // Batch Plot Generator Handler
  const handleBatchCreatePlots = async (
    zoneId: number,
    rowId: number,
    typeId: number,
    orientation: string,
    prefix: string,
    startNum: number,
    endNum: number,
    digits: number,
    isKimTinh: boolean
  ) => {
    if (!token) return;
    setIsBatchGenerating(true);
    setCrudError(null);
    const total = Math.max(1, endNum - startNum + 1);
    setBatchProgress({ current: 0, total, message: 'Đang bắt đầu tạo hàng loạt ô mộ...' });
    try {
      let createdCount = 0;
      const targetRow = rows.find((r) => r.row_id === rowId);
      const rowCode = targetRow?.row_code || '';

      for (let i = startNum; i <= endNum; i++) {
        const paddedNum = String(i).padStart(digits, '0');
        const plotCode = prefix ? `${prefix}${paddedNum}` : (rowCode ? `${rowCode}-${paddedNum}` : `M${paddedNum}`);
        setBatchProgress({ current: createdCount + 1, total, message: `Đang tạo ô mộ ${plotCode}...` });

        const res = await apiFetch('/api/v1/plots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            zone_id: zoneId,
            row_id: rowId,
            type_id: typeId,
            plot_code: plotCode,
            orientation: orientation || 'BẮC',
            is_kim_tinh: isKimTinh,
            notes: 'Tạo hàng loạt từ tiện ích quản lý danh mục',
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn(`Bỏ qua ô ${plotCode}:`, errData.detail || 'Đã tồn tại hoặc lỗi tạo.');
        } else {
          createdCount++;
        }
      }
      setCrudSuccess(`Đã tạo thành công ${createdCount} ô mộ!`);
      await fetchData();
      setBatchPlotModal({ isOpen: false });
      setTimeout(() => setCrudSuccess(null), 3500);
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : 'Lỗi khi tạo hàng loạt ô mộ.');
    } finally {
      setIsBatchGenerating(false);
      setBatchProgress(null);
    }
  };

  const toggleZoneExpand = (zoneId: number) => {
    setExpandedZoneIds((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]
    );
  };

  const toggleRowExpand = (rowId: number) => {
    setExpandedRowIds((prev) =>
      prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]
    );
  };

  const expandAllZones = () => {
    setExpandedZoneIds(zones.map((z) => z.zone_id));
    setExpandedRowIds(rows.map((r) => r.row_id));
  };

  const collapseAllZones = () => {
    setExpandedZoneIds([]);
    setExpandedRowIds([]);
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
          padding: '14px 18px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <h2 style={{ fontSize: 'clamp(16px, 3.5vw, 20px)', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <MapPin size={22} color="#24594D" style={{ flexShrink: 0 }} />
            <span className="text-truncate-safe">Vị trí ô mộ</span>
          </h2>
          <p className="line-clamp-2-safe" style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0' }}>
            Tra vị trí, tình trạng và thông tin ô mộ.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="touch-target"
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
            gap: '10px',
          }}
        >
          <div style={{ backgroundColor: '#FFFFFF', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '11px', fontWeight: 500, color: '#64748B' }}>Tổng số ô mộ</span>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>{stats.total_plots}</div>
          </div>
          <div style={{ backgroundColor: '#F0FDF4', padding: '12px 14px', borderRadius: '10px', border: '1px solid #BBF7D0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#166534' }}>Đất trống chưa bán</span>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#15803D', marginTop: '4px' }}>{stats.empty_unsold}</div>
          </div>
          <div style={{ backgroundColor: '#FFFBEB', padding: '12px 14px', borderRadius: '10px', border: '1px solid #FDE68A', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#92400E' }}>Đang tạm giữ chỗ</span>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#B45309', marginTop: '4px' }}>{stats.reserved}</div>
          </div>
          <div style={{ backgroundColor: '#FEF2F2', padding: '12px 14px', borderRadius: '10px', border: '1px solid #FECACA', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#991B1B' }}>Đã an táng</span>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#B91C1C', marginTop: '4px' }}>{stats.occupied}</div>
          </div>
          <div style={{ backgroundColor: '#FEFCE8', padding: '12px 14px', borderRadius: '10px', border: '1px solid #FEF08A', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#713F12', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Shield size={12} color="#D97706" />
              Mộ Kim Tĩnh
            </span>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#A16207', marginTop: '4px' }}>{stats.kim_tinh_count}</div>
          </div>
          <div style={{ backgroundColor: '#FFF1F2', padding: '12px 14px', borderRadius: '10px', border: '1px solid #FECDD3', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#881337' }}>🔒 Khóa vĩnh viễn</span>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#BE123C', marginTop: '4px' }}>{stats.locked_count}</div>
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
            onClick={() => setActiveTab('simulated')}
            style={{
              padding: '12px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              borderBottom: activeTab === 'simulated' ? '3px solid #24594D' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'simulated' ? '#24594D' : '#64748B',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Layers size={16} />
            <span>Sơ đồ minh họa</span>
          </button>
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
            <span>Bản đồ vị trí</span>
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
            <span>Danh sách theo khu</span>
          </button>
          {canManagePlots && <button
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
          </button>}
        </div>

        {/* Global Filters Bar */}
        {(activeTab === 'map' || activeTab === 'grid') && <div
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
            onChange={(e) => {
              setSelectedZoneId(e.target.value ? Number(e.target.value) : null);
              setSelectedFilterRowId(null);
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
            <option value="">-- Tất cả khu vực --</option>
            {zones.map((z) => (
              <option key={z.zone_id} value={z.zone_id}>
                {z.zone_code} - {z.zone_name}
              </option>
            ))}
          </select>

          {/* Row filter (Cascading) */}
          {selectedZoneId && (
            <select
              value={selectedFilterRowId || ''}
              onChange={(e) => setSelectedFilterRowId(e.target.value ? Number(e.target.value) : null)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                backgroundColor: '#FFFFFF',
                color: '#334155',
              }}
            >
              <option value="">-- Tất cả hàng trong khu --</option>
              {rows
                .filter((r) => r.zone_id === selectedZoneId)
                .map((r) => (
                  <option key={r.row_id} value={r.row_id}>
                    Dãy {r.row_code}
                  </option>
                ))}
            </select>
          )}

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

          {token && canManagePlots && (
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

        }
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

        {/* TAB 0: Simulated Layout (384 Plots & Walking Paths) */}
        {activeTab === 'simulated' && !isLoading && (
          <div style={{ padding: '16px' }}>
            <SimulatedPlotMap />
          </div>
        )}

        {/* TAB 1: Leaflet Interactive GIS Map */}
        {activeTab === 'map' && !isLoading && (
          <div className="plot-map-wrapper">
            {/* Left: Leaflet Map Container */}
            <GeographicPlotMap plots={filteredPlots} onSelect={handleSelectPlot} focusId={selectedPlotId} />

            {/* Right: Floating Plot Detail Sidebar (Responsive Drawer/Panel) */}
            <div className="plot-detail-panel">
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
                        <span>Mộ Kim tĩnh</span>
                      </div>
                      Mộ Kim tĩnh đã an táng không được cải táng hoặc thay đổi kết cấu.
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
                      <strong style={{ color: '#1E293B' }}>{plotDetail.default_slots} huyệt an táng</strong>
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
                  {hasPermission('contracts:read') && plotDetail.active_reservation && (
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
                        <span>Đang giữ chỗ</span>
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
                      Các huyệt trong ô mộ ({plotDetail.slots.length})
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
                          <strong style={{ color: '#1E293B' }}>Huyệt số {s.slot_number}</strong>
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
                    {plotDetail.latitude && plotDetail.longitude && (
                      <a
                        href={`https://www.google.com/maps?q=${plotDetail.latitude},${plotDetail.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="touch-target"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          backgroundColor: '#EFF6FF',
                          color: '#1D4ED8',
                          borderRadius: '8px',
                          border: '1px solid #BFDBFE',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          textDecoration: 'none',
                          marginBottom: '8px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        }}
                      >
                        <MapPin size={15} />
                        <span>Dẫn Đường Tới Mộ (Google Maps)</span>
                        <ExternalLink size={13} />
                      </a>
                    )}

                    {hasPermission('contracts:write') && plotDetail.status === 'EMPTY_UNSOLD' && (
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

                    {token && canManagePlots && (
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
                    Chọn một ô trên bản đồ để xem thông tin.
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
                          {p.zone_code} · {p.default_slots} huyệt
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
        {activeTab === 'catalog' && canManagePlots && !isLoading && (
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

            {/* Overall Metrics & Quick Batch Actions Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px',
                backgroundColor: '#F8FAFC',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={20} color="#24594D" />
                  <span>Quản Lý Quy Hoạch Không Gian & Danh Mục Kích Thước</span>
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>
                  Hệ thống phân cấp: <strong>Khu Vực (Zones)</strong> → <strong>Hàng Mộ (Rows)</strong> → <strong>Ô Mộ (Plots)</strong>. Hỗ trợ tìm kiếm, mở rộng cây phân cấp và công cụ sinh nhanh hàng loạt.
                </p>
                {/* Metrics Pill Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#E2E8F0', borderRadius: '20px', color: '#334155', fontWeight: 600 }}>
                    🏛️ {zones.length} Khu Vực
                  </span>
                  <span style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#E0F2FE', borderRadius: '20px', color: '#0369A1', fontWeight: 600 }}>
                    📑 {rows.length} Dãy Hàng
                  </span>
                  <span style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#ECFDF5', borderRadius: '20px', color: '#047857', fontWeight: 600 }}>
                    🪦 {plots.length} Ô Mộ Toàn Viện
                  </span>
                  <span style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#FEF3C7', borderRadius: '20px', color: '#92400E', fontWeight: 600 }}>
                    📊 Lấp Đầy: {plots.length > 0 ? Math.round((plots.filter(p => p.status === 'OCCUPIED').length / plots.length) * 100) : 0}%
                  </span>
                </div>
              </div>

              {canManagePlots && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setBatchRowModal({ isOpen: true })}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#F59E0B',
                      color: '#FFFFFF',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)',
                    }}
                    title="Sinh nhanh nhiều hàng mộ cùng lúc vào một khu"
                  >
                    <Zap size={14} />
                    <span>⚡ Sinh Dãy Hàng Nhanh</span>
                  </button>
                  <button
                    onClick={() => setBatchPlotModal({ isOpen: true })}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: '#24594D',
                      color: '#FFFFFF',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 4px rgba(36, 89, 77, 0.2)',
                    }}
                    title="Sinh nhanh hàng loạt ô mộ vào một hàng"
                  >
                    <Zap size={14} />
                    <span>⚡ Sinh Ô Mộ Nhanh</span>
                  </button>
                  <button
                    onClick={() => {
                      setCrudError(null);
                      setZoneModal({ isOpen: true, mode: 'create', data: null });
                    }}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#FFFFFF',
                      color: '#24594D',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Plus size={14} />
                    <span>Khu Vực</span>
                  </button>
                  <button
                    onClick={() => {
                      setCrudError(null);
                      setRowModal({ isOpen: true, mode: 'create', data: null });
                    }}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#FFFFFF',
                      color: '#24594D',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Plus size={14} />
                    <span>Hàng Mộ</span>
                  </button>
                  <button
                    onClick={() => {
                      setCrudError(null);
                      setPlotTypeModal({ isOpen: true, mode: 'create', data: null });
                    }}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#FFFFFF',
                      color: '#24594D',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Plus size={14} />
                    <span>Loại Mộ</span>
                  </button>
                </div>
              )}
            </div>

            {/* Batch Progress Bar if running */}
            {isBatchGenerating && batchProgress && (
              <div style={{ padding: '16px 20px', backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#92400E' }}>
                  <span>{batchProgress.message}</span>
                  <span>{batchProgress.current} / {batchProgress.total}</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: '#FDE68A', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(batchProgress.current / batchProgress.total) * 100}%`,
                      height: '100%',
                      backgroundColor: '#D97706',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Zones & Rows Section with Advanced Filter, Search, and View Modes */}
            <div>
              {/* Toolbar Section */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                  gap: '12px',
                  padding: '14px 16px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                {/* Search Bar */}
                <div style={{ position: 'relative', minWidth: '280px', flex: 1 }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Tìm theo mã khu, tên khu, mã hàng (VD: A, H01, A-H01)..."
                    style={{
                      width: '100%',
                      padding: '8px 30px 8px 32px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                  {catalogSearch && (
                    <button
                      onClick={() => setCatalogSearch('')}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Occupancy Filter Chips */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Filter size={13} /> Lọc:
                  </span>
                  {[
                    { key: 'ALL', label: 'Tất cả' },
                    { key: 'AVAILABLE', label: 'Còn ô trống' },
                    { key: 'OCCUPIED', label: 'Đã có mộ' },
                    { key: 'HIGH_OCCUPANCY', label: 'Lấp đầy ≥ 80%' },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setCatalogOccupancyFilter(f.key as any)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: catalogOccupancyFilter === f.key ? 700 : 500,
                        border: '1px solid',
                        borderColor: catalogOccupancyFilter === f.key ? '#24594D' : '#E2E8F0',
                        backgroundColor: catalogOccupancyFilter === f.key ? '#E8F1EE' : '#FFFFFF',
                        color: catalogOccupancyFilter === f.key ? '#24594D' : '#64748B',
                        cursor: 'pointer',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Sorter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ArrowUpDown size={14} color="#64748B" />
                  <select
                    value={catalogSort}
                    onChange={(e) => setCatalogSort(e.target.value as any)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '12px',
                      color: '#334155',
                      backgroundColor: '#FFFFFF',
                      outline: 'none',
                    }}
                  >
                    <option value="CODE_ASC">Mã khu (A → Z)</option>
                    <option value="CODE_DESC">Mã khu (Z → A)</option>
                    <option value="OCCUPANCY_DESC">Tỷ lệ lấp đầy cao nhất</option>
                    <option value="OCCUPANCY_ASC">Tỷ lệ lấp đầy thấp nhất</option>
                    <option value="PLOTS_DESC">Nhiều ô mộ nhất</option>
                  </select>
                </div>

                {/* View Mode Toggle Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
                  <button
                    onClick={() => setCatalogViewMode('CARDS')}
                    title="Chế độ Thẻ phân khu"
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: catalogViewMode === 'CARDS' ? '#FFFFFF' : 'transparent',
                      color: catalogViewMode === 'CARDS' ? '#24594D' : '#64748B',
                      boxShadow: catalogViewMode === 'CARDS' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Grid size={13} /> Thẻ
                  </button>
                  <button
                    onClick={() => setCatalogViewMode('TREE')}
                    title="Chế độ Cây phân cấp Khu → Hàng → Ô"
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: catalogViewMode === 'TREE' ? '#FFFFFF' : 'transparent',
                      color: catalogViewMode === 'TREE' ? '#24594D' : '#64748B',
                      boxShadow: catalogViewMode === 'TREE' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <List size={13} /> Cây Phân Cấp
                  </button>
                  <button
                    onClick={() => setCatalogViewMode('TABLE')}
                    title="Chế độ Bảng tổng hợp chi tiết"
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: catalogViewMode === 'TABLE' ? '#FFFFFF' : 'transparent',
                      color: catalogViewMode === 'TABLE' ? '#24594D' : '#64748B',
                      boxShadow: catalogViewMode === 'TABLE' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Table size={13} /> Bảng
                  </button>
                </div>
              </div>

              {/* Tree Expansion Controls if in TREE mode */}
              {catalogViewMode === 'TREE' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', padding: '0 4px' }}>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    Nhấn vào từng Khu vực hoặc Dãy hàng để mở rộng/thu gọn và xem trực tiếp từng ô mộ:
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={expandAllZones}
                      style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', cursor: 'pointer' }}
                    >
                      Mở rộng tất cả
                    </button>
                    <button
                      onClick={collapseAllZones}
                      style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', cursor: 'pointer' }}
                    >
                      Thu gọn tất cả
                    </button>
                  </div>
                </div>
              )}

              {/* Empty state for zones */}
              {filteredZones.length === 0 && (
                <div style={{ padding: '36px', textAlign: 'center', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
                  <AlertCircle size={28} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
                  <p style={{ margin: 0, fontSize: '14px', color: '#64748B', fontWeight: 600 }}>Không tìm thấy phân khu nào phù hợp bộ lọc.</p>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94A3B8' }}>Thử xóa từ khóa tìm kiếm hoặc chọn bộ lọc trạng thái khác.</p>
                </div>
              )}

              {/* VIEW 1: CARDS VIEW */}
              {catalogViewMode === 'CARDS' && (
                <div className="responsive-auto-cards">
                  {paginatedZones.map((z) => {
                    const zoneRows = rows.filter((r) => r.zone_id === z.zone_id);
                    const stat = zoneStatsMap.get(z.zone_id) || { totalPlots: 0, occupiedPlots: 0, availablePlots: 0, reservedPlots: 0 };
                    const occupancyPct = stat.totalPlots > 0 ? Math.round((stat.occupiedPlots / stat.totalPlots) * 100) : 0;

                    return (
                      <div
                        key={z.zone_id}
                        style={{
                          padding: '16px',
                          borderRadius: '12px',
                          border: '1px solid #E2E8F0',
                          backgroundColor: '#FFFFFF',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div>
                          {/* Zone Header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', backgroundColor: '#F1F5F9', padding: '2px 8px', borderRadius: '6px' }}>
                                {z.zone_code}
                              </span>
                              <strong style={{ fontSize: '14px', color: '#24594D' }}>{z.zone_name}</strong>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {token && canManagePlots && (
                                <>
                                  <button
                                    onClick={() => {
                                      setCrudError(null);
                                      setZoneModal({ isOpen: true, mode: 'edit', data: z });
                                    }}
                                    title="Chỉnh sửa khu vực"
                                    style={{ padding: '5px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', borderRadius: '4px' }}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCrudError(null);
                                      setDeleteModal({ isOpen: true, type: 'zone', id: z.zone_id, name: `${z.zone_code} - ${z.zone_name}` });
                                    }}
                                    title="Xóa khu vực"
                                    style={{ padding: '5px', background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', borderRadius: '4px' }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                            {z.description || 'Khuôn viên tiêu chuẩn.'}
                          </p>

                          {/* Occupancy Progress Gauge */}
                          <div style={{ marginBottom: '12px', backgroundColor: '#F8FAFC', padding: '8px 10px', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                              <span>Lấp đầy: {stat.occupiedPlots} / {stat.totalPlots} ô</span>
                              <span style={{ color: occupancyPct >= 80 ? '#B91C1C' : '#047857' }}>{occupancyPct}%</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${occupancyPct}%`,
                                  height: '100%',
                                  backgroundColor: occupancyPct >= 80 ? '#EF4444' : occupancyPct >= 50 ? '#F59E0B' : '#10B981',
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '10px', color: '#64748B' }}>
                              <span>🟢 Trống: {stat.availablePlots}</span>
                              <span>🟡 Giữ chỗ: {stat.reservedPlots}</span>
                              <span>🔴 Đã chôn: {stat.occupiedPlots}</span>
                            </div>
                          </div>

                          {/* Rows List inside this Zone */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
                              Dãy Hàng ({zoneRows.length}):
                            </div>
                            {zoneRows.map((r) => {
                              const rStat = rowStatsMap.get(r.row_id) || { totalPlots: 0, occupiedPlots: 0, availablePlots: 0, reservedPlots: 0 };
                              return (
                                <div
                                  key={r.row_id}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '12px',
                                    padding: '6px 10px',
                                    backgroundColor: '#F8FAFC',
                                    borderRadius: '6px',
                                    border: '1px solid #E2E8F0',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontWeight: 700, color: '#1E293B' }}>{r.row_code}</span>
                                    <span style={{ color: '#64748B', fontSize: '11px' }}>
                                      ({rStat.totalPlots} ô · {rStat.occupiedPlots} đ.chôn)
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <button
                                      onClick={() => setRowPlotsModal({ isOpen: true, row: r, zone: z })}
                                      title="Xem danh sách ô của hàng này"
                                      style={{ padding: '3px 6px', fontSize: '11px', border: '1px solid #CBD5E1', borderRadius: '4px', backgroundColor: '#FFFFFF', color: '#24594D', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                                    >
                                      <Eye size={11} /> Ô
                                    </button>
                                    {token && canManagePlots && (
                                      <>
                                        <button
                                          onClick={() => {
                                            setCrudError(null);
                                            setRowModal({ isOpen: true, mode: 'edit', data: r });
                                          }}
                                          title="Sửa hàng"
                                          style={{ padding: '3px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                                        >
                                          <Edit2 size={12} />
                                        </button>
                                        <button
                                          onClick={() => {
                                            setCrudError(null);
                                            setDeleteModal({ isOpen: true, type: 'row', id: r.row_id, name: `${r.row_code} (${z.zone_code})` });
                                          }}
                                          title="Xóa hàng"
                                          style={{ padding: '3px', background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Zone Card Bottom Action Buttons */}
                        {token && canManagePlots && (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                            <button
                              onClick={() => {
                                setCrudError(null);
                                setRowModal({ isOpen: true, mode: 'create', data: null, defaultZoneId: z.zone_id });
                              }}
                              style={{
                                flex: 1,
                                padding: '6px',
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
                              <span>Hàng</span>
                            </button>
                            <button
                              onClick={() => setBatchRowModal({ isOpen: true, defaultZoneId: z.zone_id })}
                              style={{
                                padding: '6px 8px',
                                border: '1px solid #FCD34D',
                                borderRadius: '6px',
                                backgroundColor: '#FFFBEB',
                                color: '#92400E',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title="Sinh nhanh nhiều hàng vào khu này"
                            >
                              <Zap size={12} />
                              <span>⚡ Sinh hàng</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* VIEW 2: TREE DRILL-DOWN VIEW (Khu -> Hàng -> Ô) */}
              {catalogViewMode === 'TREE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredZones.map((z) => {
                    const zoneRows = rows.filter((r) => r.zone_id === z.zone_id);
                    const isZoneExpanded = expandedZoneIds.includes(z.zone_id);
                    const stat = zoneStatsMap.get(z.zone_id) || { totalPlots: 0, occupiedPlots: 0, availablePlots: 0, reservedPlots: 0 };
                    const occupancyPct = stat.totalPlots > 0 ? Math.round((stat.occupiedPlots / stat.totalPlots) * 100) : 0;

                    return (
                      <div
                        key={z.zone_id}
                        style={{
                          borderRadius: '10px',
                          border: '1px solid #E2E8F0',
                          backgroundColor: '#FFFFFF',
                          overflow: 'hidden',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        }}
                      >
                        {/* Zone Row Header */}
                        <div
                          style={{
                            padding: '12px 16px',
                            backgroundColor: isZoneExpanded ? '#F1F5F9' : '#F8FAFC',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            borderBottom: isZoneExpanded ? '1px solid #E2E8F0' : 'none',
                          }}
                          onClick={() => toggleZoneExpand(z.zone_id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {isZoneExpanded ? <ChevronDown size={18} color="#24594D" /> : <ChevronRight size={18} color="#64748B" />}
                            <span style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', backgroundColor: '#FFFFFF', padding: '2px 8px', borderRadius: '4px', border: '1px solid #CBD5E1' }}>
                              {z.zone_code}
                            </span>
                            <strong style={{ fontSize: '14px', color: '#1E293B' }}>{z.zone_name}</strong>
                            <span style={{ fontSize: '11px', color: '#64748B' }}>({zoneRows.length} dãy hàng)</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 600 }}>
                              <span style={{ color: '#047857' }}>Trống: {stat.availablePlots}</span>
                              <span style={{ color: '#D97706' }}>Giữ: {stat.reservedPlots}</span>
                              <span style={{ color: '#B91C1C' }}>Chôn: {stat.occupiedPlots}</span>
                              <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: occupancyPct >= 80 ? '#FEE2E2' : '#ECFDF5', color: occupancyPct >= 80 ? '#B91C1C' : '#047857' }}>
                                {occupancyPct}%
                              </span>
                            </div>

                            {token && canManagePlots && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                  onClick={() => setBatchRowModal({ isOpen: true, defaultZoneId: z.zone_id })}
                                  title="Sinh nhanh hàng loạt dãy hàng vào khu này"
                                  style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FCD34D', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                                >
                                  <Zap size={11} /> Sinh hàng
                                </button>
                                <button
                                  onClick={() => {
                                    setCrudError(null);
                                    setRowModal({ isOpen: true, mode: 'create', data: null, defaultZoneId: z.zone_id });
                                  }}
                                  title="Thêm một hàng mới"
                                  style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#FFFFFF', color: '#24594D', border: '1px solid #CBD5E1', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                                >
                                  <Plus size={11} /> Hàng
                                </button>
                                <button
                                  onClick={() => {
                                    setCrudError(null);
                                    setZoneModal({ isOpen: true, mode: 'edit', data: z });
                                  }}
                                  title="Sửa khu"
                                  style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                                >
                                  <Edit2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Zone Body: Rows inside Zone */}
                        {isZoneExpanded && (
                          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {zoneRows.length === 0 ? (
                              <div style={{ padding: '12px', fontSize: '12px', color: '#94A3B8', textAlign: 'center' }}>
                                Khu này chưa có dãy hàng nào. Bấm <strong>Hàng</strong> hoặc <strong>⚡ Sinh hàng</strong> để tạo.
                              </div>
                            ) : (
                              zoneRows.map((r) => {
                                const isRowExpanded = expandedRowIds.includes(r.row_id);
                                const rStat = rowStatsMap.get(r.row_id) || { totalPlots: 0, occupiedPlots: 0, availablePlots: 0, reservedPlots: 0 };
                                const rowPlots = plots.filter((p) => p.row_id === r.row_id);

                                return (
                                  <div
                                    key={r.row_id}
                                    style={{
                                      borderRadius: '8px',
                                      border: '1px solid #E2E8F0',
                                      backgroundColor: '#F8FAFC',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {/* Row Header */}
                                    <div
                                      style={{
                                        padding: '8px 12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        backgroundColor: isRowExpanded ? '#EEF2F6' : '#FFFFFF',
                                      }}
                                      onClick={() => toggleRowExpand(r.row_id)}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {isRowExpanded ? <ChevronDown size={14} color="#24594D" /> : <ChevronRight size={14} color="#64748B" />}
                                        <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>{r.row_code}</span>
                                        <span style={{ fontSize: '11px', color: '#64748B' }}>({rowPlots.length} ô hiện có / {r.total_plots} quy hoạch)</span>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                                        <span style={{ fontSize: '11px', color: '#64748B' }}>
                                          Trống: <strong style={{ color: '#047857' }}>{rStat.availablePlots}</strong> · Đã chôn: <strong style={{ color: '#B91C1C' }}>{rStat.occupiedPlots}</strong>
                                        </span>

                                        {token && canManagePlots && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <button
                                              onClick={() => setBatchPlotModal({ isOpen: true, defaultZoneId: z.zone_id, defaultRowId: r.row_id })}
                                              title="Sinh hàng loạt ô vào dãy này"
                                              style={{ padding: '3px 6px', fontSize: '11px', backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FCD34D', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                                            >
                                              <Zap size={11} /> Sinh ô
                                            </button>
                                            <button
                                              onClick={() => {
                                                setCrudError(null);
                                                setPlotModal({
                                                  isOpen: true,
                                                  mode: 'create',
                                                  data: {
                                                    zone_id: z.zone_id,
                                                    row_id: r.row_id,
                                                    type_id: plotTypes[0]?.type_id || 1,
                                                    plot_code: `${r.row_code}-${String(rowPlots.length + 1).padStart(2, '0')}`,
                                                    orientation: 'BẮC',
                                                    is_kim_tinh: false,
                                                  } as any,
                                                });
                                              }}
                                              title="Thêm một ô mộ mới vào hàng này"
                                              style={{ padding: '3px 6px', fontSize: '11px', backgroundColor: '#FFFFFF', color: '#24594D', border: '1px solid #CBD5E1', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                                            >
                                              <Plus size={11} /> Ô
                                            </button>
                                            <button
                                              onClick={() => {
                                                setCrudError(null);
                                                setRowModal({ isOpen: true, mode: 'edit', data: r });
                                              }}
                                              title="Sửa hàng"
                                              style={{ padding: '3px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                                            >
                                              <Edit2 size={12} />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Level 3: Plots inside Row */}
                                    {isRowExpanded && (
                                      <div style={{ padding: '10px 12px', backgroundColor: '#FAFAFA', borderTop: '1px solid #E2E8F0' }}>
                                        {rowPlots.length === 0 ? (
                                          <div style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center', padding: '6px' }}>
                                            Hàng này chưa có ô mộ nào. Bấm <strong>⚡ Sinh ô</strong> để tạo nhanh hàng loạt ô.
                                          </div>
                                        ) : (
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
                                            {rowPlots.map((p) => {
                                              let pBg = '#ECFDF5';
                                              let pBorder = '#A7F3D0';
                                              let pColor = '#047857';
                                              let pLabel = 'Trống';
                                              if (p.status === 'OCCUPIED') {
                                                pBg = '#FEF2F2';
                                                pBorder = '#FECACA';
                                                pColor = '#B91C1C';
                                                pLabel = 'Đã chôn';
                                              } else if (p.status === 'RESERVED') {
                                                pBg = '#FEF3C7';
                                                pBorder = '#FDE68A';
                                                pColor = '#B45309';
                                                pLabel = 'Giữ chỗ';
                                              }

                                              return (
                                                <div
                                                  key={p.plot_id}
                                                  style={{
                                                    padding: '6px 8px',
                                                    backgroundColor: pBg,
                                                    border: `1px solid ${pBorder}`,
                                                    borderRadius: '6px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'space-between',
                                                    fontSize: '11px',
                                                    position: 'relative',
                                                  }}
                                                >
                                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <strong style={{ color: '#0F172A' }}>{p.plot_code}</strong>
                                                    {p.is_kim_tinh && <span title="Kim Tĩnh Bất Biến"><Shield size={11} color="#D97706" /></span>}
                                                  </div>
                                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                                    <span style={{ fontWeight: 600, color: pColor }}>{pLabel}</span>
                                                    {token && canManagePlots && (
                                                      <button
                                                        onClick={() => {
                                                          setCrudError(null);
                                                          setPlotModal({ isOpen: true, mode: 'edit', data: p });
                                                        }}
                                                        title="Sửa thông tin ô"
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', color: '#475569' }}
                                                      >
                                                        <Edit2 size={11} />
                                                      </button>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* VIEW 3: TABLE VIEW */}
              {catalogViewMode === 'TABLE' && (
                <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '12px', fontWeight: 700 }}>
                        <th style={{ padding: '10px 14px' }}>Mã Khu</th>
                        <th style={{ padding: '10px 14px' }}>Tên Khu</th>
                        <th style={{ padding: '10px 14px' }}>Mã Hàng</th>
                        <th style={{ padding: '10px 14px' }}>Ô Quy Hoạch</th>
                        <th style={{ padding: '10px 14px' }}>Ô Thực Tế</th>
                        <th style={{ padding: '10px 14px' }}>Đã Chôn</th>
                        <th style={{ padding: '10px 14px' }}>Còn Trống</th>
                        <th style={{ padding: '10px 14px' }}>Lấp Đầy</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredZones.flatMap((z) => {
                        const zoneRows = rows.filter((r) => r.zone_id === z.zone_id);
                        if (zoneRows.length === 0) {
                          return [
                            <tr key={`z-${z.zone_id}-empty`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0F172A' }}>{z.zone_code}</td>
                              <td style={{ padding: '10px 14px', color: '#24594D' }}>{z.zone_name}</td>
                              <td colSpan={6} style={{ padding: '10px 14px', color: '#94A3B8', fontStyle: 'italic' }}>Chưa có dãy hàng</td>
                              <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                {token && canManagePlots && (
                                  <button
                                    onClick={() => setBatchRowModal({ isOpen: true, defaultZoneId: z.zone_id })}
                                    style={{ padding: '3px 8px', fontSize: '11px', backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FCD34D', borderRadius: '4px', cursor: 'pointer' }}
                                  >
                                    ⚡ Sinh hàng
                                  </button>
                                )}
                              </td>
                            </tr>,
                          ];
                        }
                        return zoneRows.map((r, rIdx) => {
                          const rStat = rowStatsMap.get(r.row_id) || { totalPlots: 0, occupiedPlots: 0, availablePlots: 0, reservedPlots: 0 };
                          const rOccupancy = rStat.totalPlots > 0 ? Math.round((rStat.occupiedPlots / rStat.totalPlots) * 100) : 0;
                          return (
                            <tr key={`r-${r.row_id}`} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: rIdx % 2 === 0 ? '#FFFFFF' : '#FDFDFD' }}>
                              <td style={{ padding: '8px 14px', fontWeight: 700, color: '#0F172A' }}>{rIdx === 0 ? z.zone_code : ''}</td>
                              <td style={{ padding: '8px 14px', color: '#24594D' }}>{rIdx === 0 ? z.zone_name : ''}</td>
                              <td style={{ padding: '8px 14px', fontWeight: 700, color: '#1E293B' }}>{r.row_code}</td>
                              <td style={{ padding: '8px 14px', color: '#64748B' }}>{r.total_plots}</td>
                              <td style={{ padding: '8px 14px', fontWeight: 600 }}>{rStat.totalPlots}</td>
                              <td style={{ padding: '8px 14px', color: '#B91C1C', fontWeight: 600 }}>{rStat.occupiedPlots}</td>
                              <td style={{ padding: '8px 14px', color: '#047857', fontWeight: 600 }}>{rStat.availablePlots}</td>
                              <td style={{ padding: '8px 14px' }}>
                                <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: rOccupancy >= 80 ? '#FEE2E2' : '#ECFDF5', color: rOccupancy >= 80 ? '#B91C1C' : '#047857', fontWeight: 600 }}>
                                  {rOccupancy}%
                                </span>
                              </td>
                              <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                                  <button
                                    onClick={() => setRowPlotsModal({ isOpen: true, row: r, zone: z })}
                                    style={{ padding: '3px 6px', fontSize: '11px', border: '1px solid #CBD5E1', borderRadius: '4px', backgroundColor: '#FFFFFF', color: '#24594D', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                                  >
                                    <Eye size={11} /> Xem ô
                                  </button>
                                  {token && canManagePlots && (
                                    <>
                                      <button
                                        onClick={() => setBatchPlotModal({ isOpen: true, defaultZoneId: z.zone_id, defaultRowId: r.row_id })}
                                        style={{ padding: '3px 6px', fontSize: '11px', backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FCD34D', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                                      >
                                        <Zap size={11} /> Sinh ô
                                      </button>
                                      <button
                                        onClick={() => {
                                          setCrudError(null);
                                          setRowModal({ isOpen: true, mode: 'edit', data: r });
                                        }}
                                        style={{ padding: '3px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Advanced Modern Pagination for Zones (in Cards mode) */}
              {catalogViewMode === 'CARDS' && (
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
              )}
            </div>

            {/* Plot Types Section with Search, Sort, and Clone Utility */}
            <div style={{ paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                    Quy Cách & Kích Thước Loại Mộ (Plot Types) ({plotTypes.length} loại)
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>
                    Quy chuẩn diện tích, số lượng huyệt mặc định và thông số kỹ thuật xây dựng từng mẫu mộ.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', width: '200px' }}>
                    <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                    <input
                      type="text"
                      value={ptSearch}
                      onChange={(e) => setPtSearch(e.target.value)}
                      placeholder="Tìm loại mộ..."
                      style={{
                        width: '100%',
                        padding: '6px 10px 6px 26px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '12px',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <select
                    value={ptSort}
                    onChange={(e) => setPtSort(e.target.value as any)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '12px',
                      color: '#334155',
                      backgroundColor: '#FFFFFF',
                      outline: 'none',
                    }}
                  >
                    <option value="NAME_ASC">Tên (A → Z)</option>
                    <option value="NAME_DESC">Tên (Z → A)</option>
                    <option value="AREA_DESC">Diện tích lớn nhất</option>
                    <option value="SLOTS_DESC">Nhiều huyệt nhất</option>
                  </select>

                  {canManagePlots && (
                    <button
                      onClick={() => {
                        setCrudError(null);
                        setPlotTypeModal({ isOpen: true, mode: 'create', data: null });
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#24594D',
                        color: '#FFFFFF',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Plus size={13} /> Thêm Loại Mộ
                    </button>
                  )}
                </div>
              </div>

              <div className="responsive-auto-cards">
                {paginatedPlotTypes.map((pt) => (
                  <div
                    key={pt.type_id}
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '15px', color: '#0F172A' }}>{pt.type_name}</strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', backgroundColor: '#E8F1EE', color: '#24594D', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                            {pt.default_slots} huyệt
                          </span>
                          {token && canManagePlots && (
                            <>
                              <button
                                onClick={() => {
                                  // Quick Clone Utility: Duplicate plot type with modified name
                                  setCrudError(null);
                                  setPlotTypeModal({
                                    isOpen: true,
                                    mode: 'create',
                                    data: {
                                      ...pt,
                                      type_name: `${pt.type_name} (Bản sao)`,
                                      description: `Nhân bản từ ${pt.type_name}. ${pt.description || ''}`,
                                    },
                                  });
                                }}
                                title="Nhân bản loại mộ này (Clone)"
                                style={{ padding: '3px', background: 'none', border: 'none', cursor: 'pointer', color: '#0369A1' }}
                              >
                                <Copy size={13} />
                              </button>
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
                  Số huyệt an táng mặc định *
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

              <div className="responsive-form-row">
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
              {plotModal.mode === 'create' ? (() => {
                const activeModalZoneId = modalZoneId ?? (selectedZoneId || zones[0]?.zone_id || null);
                const modalRows = rows.filter((r) => r.zone_id === activeModalZoneId);

                return (
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
                        1. Chọn Khu Vực Mộ (Zone) *
                      </label>
                      <select
                        value={activeModalZoneId || ''}
                        onChange={(e) => setModalZoneId(Number(e.target.value))}
                        style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: '#FFFFFF' }}
                        required
                      >
                        {zones.map((z) => (
                          <option key={z.zone_id} value={z.zone_id}>
                            Khu {z.zone_code} - {z.zone_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        2. Chọn Hàng / Dãy Mộ Khả Dụng (Row) *
                      </label>
                      <select
                        key={activeModalZoneId}
                        name="row_id"
                        required
                        defaultValue={modalRows[0]?.row_id}
                        style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: '#FFFFFF' }}
                      >
                        {modalRows.length === 0 ? (
                          <option value="">-- Khu này chưa có hàng mộ --</option>
                        ) : (
                          modalRows.map((r) => (
                            <option key={r.row_id} value={r.row_id}>
                              Dãy {r.row_code}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </>
                );
              })() : null}

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
                      {pt.type_name} ({pt.default_slots} huyệt, {pt.length}m × {pt.width}m)
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

              <div className="responsive-form-row">
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

              {/* Kim Tĩnh Invariant Information */}
              {plotModal.mode === 'edit' && Boolean(plotModal.data?.is_kim_tinh) ? (
                <div style={{ padding: '10px 12px', backgroundColor: '#FEF3C7', borderRadius: '8px', border: '1px solid #FDE68A' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#92400E' }}>
                    <Shield size={16} />
                    <span>Mộ đã an táng kết cấu Kim Tĩnh (Bất biến)</span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#B45309', lineHeight: '1.4' }}>
                    Theo quy tắc bất biến, ô mộ Kim Tĩnh đã an táng không thể mở khóa, cải táng hoặc thay đổi kết cấu.
                  </p>
                </div>
              ) : (
                <div style={{ padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748B', lineHeight: '1.4' }}>
                    💡 <strong>Lưu ý nghiệp vụ:</strong> Ô mộ mới tạo là đất trống chưa bán. Cờ Kim Tĩnh chỉ được gán và khóa vĩnh viễn khi khách hàng ký và hoàn tất Phụ lục An táng có thi công Kim Tĩnh.
                  </p>
                </div>
              )}

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

      {/* 10. Row Plots Viewer Modal */}
      {rowPlotsModal.isOpen && rowPlotsModal.row && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', maxWidth: '780px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            {/* Modal Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Grid size={18} color="#24594D" />
                  <span>Danh Sách Ô Mộ - Hàng {rowPlotsModal.row.row_code}</span>
                  {rowPlotsModal.zone && (
                    <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
                      (Khu {rowPlotsModal.zone.zone_code} - {rowPlotsModal.zone.zone_name})
                    </span>
                  )}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                  Xem nhanh toàn bộ các ô mộ thuộc hàng này, trạng thái lấp đầy và chỉnh sửa trực tiếp.
                </p>
              </div>
              <button
                onClick={() => setRowPlotsModal({ isOpen: false, row: null, zone: null })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {(() => {
                const targetPlots = plots.filter((p) => p.row_id === rowPlotsModal.row?.row_id);
                const occupiedCount = targetPlots.filter((p) => p.status === 'OCCUPIED').length;
                const availableCount = targetPlots.filter((p) => p.status === 'EMPTY_UNSOLD').length;
                const reservedCount = targetPlots.filter((p) => p.status === 'RESERVED').length;

                return (
                  <div>
                    {/* Row Summary Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontWeight: 600 }}>
                        <span style={{ color: '#334155' }}>Tổng: {targetPlots.length} / {rowPlotsModal.row.total_plots} ô</span>
                        <span style={{ color: '#047857' }}>🟢 Trống: {availableCount}</span>
                        <span style={{ color: '#D97706' }}>🟡 Giữ chỗ: {reservedCount}</span>
                        <span style={{ color: '#B91C1C' }}>🔴 Đã chôn: {occupiedCount}</span>
                      </div>

                      {token && canManagePlots && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => {
                              const r = rowPlotsModal.row!;
                              const z = rowPlotsModal.zone;
                              setRowPlotsModal({ isOpen: false, row: null, zone: null });
                              setBatchPlotModal({ isOpen: true, defaultZoneId: z?.zone_id, defaultRowId: r.row_id });
                            }}
                            style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 700, backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FCD34D', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Zap size={12} /> ⚡ Sinh hàng loạt ô
                          </button>
                          <button
                            onClick={() => {
                              const r = rowPlotsModal.row!;
                              const z = rowPlotsModal.zone;
                              setRowPlotsModal({ isOpen: false, row: null, zone: null });
                              setPlotModal({
                                isOpen: true,
                                mode: 'create',
                                data: {
                                  zone_id: z?.zone_id || r.zone_id,
                                  row_id: r.row_id,
                                  type_id: plotTypes[0]?.type_id || 1,
                                  plot_code: `${r.row_code}-${String(targetPlots.length + 1).padStart(2, '0')}`,
                                  orientation: 'BẮC',
                                  is_kim_tinh: false,
                                } as any,
                              });
                            }}
                            style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 600, backgroundColor: '#24594D', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Plus size={12} /> Thêm ô mới
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Plots Grid */}
                    {targetPlots.length === 0 ? (
                      <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8' }}>
                        Chưa có ô mộ nào được khởi tạo trong hàng này.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                        {targetPlots.map((p) => {
                          let pBg = '#ECFDF5';
                          let pBorder = '#A7F3D0';
                          let pColor = '#047857';
                          let pLabel = 'Trống chưa bán';
                          if (p.status === 'OCCUPIED') {
                            pBg = '#FEF2F2';
                            pBorder = '#FECACA';
                            pColor = '#B91C1C';
                            pLabel = 'Đã an táng';
                          } else if (p.status === 'RESERVED') {
                            pBg = '#FEF3C7';
                            pBorder = '#FDE68A';
                            pColor = '#B45309';
                            pLabel = 'Đang giữ chỗ';
                          }

                          return (
                            <div
                              key={p.plot_id}
                              style={{
                                padding: '10px 12px',
                                backgroundColor: pBg,
                                border: `1px solid ${pBorder}`,
                                borderRadius: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                gap: '6px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <strong style={{ fontSize: '13px', color: '#0F172A' }}>{p.plot_code}</strong>
                                {p.is_kim_tinh && <span title="Kim Tĩnh Bất Biến"><Shield size={13} color="#D97706" /></span>}
                              </div>

                              <div style={{ fontSize: '11px', color: '#64748B' }}>
                                {p.type_name} · {p.orientation || 'BẮC'}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: pColor }}>{pLabel}</span>
                                {token && canManagePlots && (
                                  <button
                                    onClick={() => {
                                      setRowPlotsModal({ isOpen: false, row: null, zone: null });
                                      setCrudError(null);
                                      setPlotModal({ isOpen: true, mode: 'edit', data: p });
                                    }}
                                    title="Chỉnh sửa ô mộ"
                                    style={{ padding: '2px 5px', fontSize: '10px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '4px', cursor: 'pointer', color: '#334155' }}
                                  >
                                    Sửa
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 11. Batch Row Generator Modal */}
      {batchRowModal.isOpen && (
        <BatchRowGeneratorModal
          isOpen={batchRowModal.isOpen}
          defaultZoneId={batchRowModal.defaultZoneId}
          zones={zones}
          onClose={() => setBatchRowModal({ isOpen: false })}
          onSubmit={handleBatchCreateRows}
          isGenerating={isBatchGenerating}
        />
      )}

      {/* 12. Batch Plot Generator Modal */}
      {batchPlotModal.isOpen && (
        <BatchPlotGeneratorModal
          isOpen={batchPlotModal.isOpen}
          defaultZoneId={batchPlotModal.defaultZoneId}
          defaultRowId={batchPlotModal.defaultRowId}
          zones={zones}
          rows={rows}
          plotTypes={plotTypes}
          onClose={() => setBatchPlotModal({ isOpen: false })}
          onSubmit={handleBatchCreatePlots}
          isGenerating={isBatchGenerating}
        />
      )}
    </div>
  );
};

// Batch Row Generator Modal Component
interface BatchRowGeneratorModalProps {
  isOpen: boolean;
  defaultZoneId?: number;
  zones: Zone[];
  onClose: () => void;
  onSubmit: (zoneId: number, prefix: string, startNum: number, endNum: number, digits: number, totalPlotsPerRow: number) => Promise<void>;
  isGenerating: boolean;
}

const BatchRowGeneratorModal: React.FC<BatchRowGeneratorModalProps> = ({
  isOpen,
  defaultZoneId,
  zones,
  onClose,
  onSubmit,
  isGenerating,
}) => {
  const [zoneId, setZoneId] = useState<number>(defaultZoneId || zones[0]?.zone_id || 1);
  const [prefix, setPrefix] = useState<string>('H');
  const [startNum, setStartNum] = useState<number>(1);
  const [endNum, setEndNum] = useState<number>(10);
  const [digits, setDigits] = useState<number>(2);
  const [totalPlotsPerRow, setTotalPlotsPerRow] = useState<number>(20);

  if (!isOpen) return null;

  const count = Math.max(0, endNum - startNum + 1);
  const previewSample: string[] = [];
  for (let i = startNum; i <= Math.min(startNum + 4, endNum); i++) {
    previewSample.push(`${prefix}${String(i).padStart(digits, '0')}`);
  }
  if (count > 5) {
    previewSample.push('...');
    previewSample.push(`${prefix}${String(endNum).padStart(digits, '0')}`);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(zoneId, prefix, startNum, endNum, digits, totalPlotsPerRow);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', maxWidth: '480px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color="#D97706" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Sinh Dãy Hàng Nhanh Hàng Loạt</h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>Tự động khởi tạo nhiều hàng liên tiếp vào khu chỉ định</p>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Khu vực tiếp nhận *
            </label>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(Number(e.target.value))}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
            >
              {zones.map((z) => (
                <option key={z.zone_id} value={z.zone_id}>
                  {z.zone_code} - {z.zone_name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Tiền tố mã hàng *
              </label>
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                placeholder="H"
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Số chữ số đệm
              </label>
              <select
                value={digits}
                onChange={(e) => setDigits(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              >
                <option value={1}>1 chữ số (H1, H2...)</option>
                <option value={2}>2 chữ số (H01, H02...)</option>
                <option value={3}>3 chữ số (H001, H002...)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Số bắt đầu *
              </label>
              <input
                type="number"
                min={1}
                value={startNum}
                onChange={(e) => setStartNum(Number(e.target.value))}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Số kết thúc *
              </label>
              <input
                type="number"
                min={startNum}
                value={endNum}
                onChange={(e) => setEndNum(Number(e.target.value))}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Quy hoạch số ô trên mỗi hàng
            </label>
            <input
              type="number"
              min={1}
              value={totalPlotsPerRow}
              onChange={(e) => setTotalPlotsPerRow(Number(e.target.value))}
              required
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
            />
          </div>

          {/* Live Preview Box */}
          <div style={{ padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }}>
            <div style={{ color: '#64748B', marginBottom: '4px' }}>
              Xem trước: Sẽ sinh <strong>{count}</strong> dãy hàng:
            </div>
            <div style={{ fontWeight: 700, color: '#24594D' }}>
              {previewSample.join(', ')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              style={{ flex: 1, padding: '9px', backgroundColor: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isGenerating || count <= 0}
              style={{ flex: 1, padding: '9px', backgroundColor: '#F59E0B', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Zap size={14} />
              <span>{isGenerating ? 'Đang khởi tạo...' : `Tạo ${count} Dãy Hàng`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Batch Plot Generator Modal Component
interface BatchPlotGeneratorModalProps {
  isOpen: boolean;
  defaultZoneId?: number;
  defaultRowId?: number;
  zones: Zone[];
  rows: Row[];
  plotTypes: PlotType[];
  onClose: () => void;
  onSubmit: (
    zoneId: number,
    rowId: number,
    typeId: number,
    orientation: string,
    prefix: string,
    startNum: number,
    endNum: number,
    digits: number,
    isKimTinh: boolean
  ) => Promise<void>;
  isGenerating: boolean;
}

const BatchPlotGeneratorModal: React.FC<BatchPlotGeneratorModalProps> = ({
  isOpen,
  defaultZoneId,
  defaultRowId,
  zones,
  rows,
  plotTypes,
  onClose,
  onSubmit,
  isGenerating,
}) => {
  const [selectedZoneId, setSelectedZoneId] = useState<number>(
    defaultZoneId || (defaultRowId ? rows.find((r) => r.row_id === defaultRowId)?.zone_id || zones[0]?.zone_id : zones[0]?.zone_id) || 1
  );

  const availableRows = rows.filter((r) => r.zone_id === selectedZoneId);

  const [selectedRowId, setSelectedRowId] = useState<number>(
    defaultRowId && availableRows.some((r) => r.row_id === defaultRowId)
      ? defaultRowId
      : (availableRows[0]?.row_id || 1)
  );

  const [selectedTypeId, setSelectedTypeId] = useState<number>(plotTypes[0]?.type_id || 1);
  const [orientation, setOrientation] = useState<string>('BẮC');
  const [prefix, setPrefix] = useState<string>('');
  const [startNum, setStartNum] = useState<number>(1);
  const [endNum, setEndNum] = useState<number>(20);
  const [digits, setDigits] = useState<number>(2);
  const [isKimTinh, setIsKimTinh] = useState<boolean>(false);

  // Sync rowId when selectedZoneId changes if current row is not in zone
  useEffect(() => {
    if (!availableRows.some((r) => r.row_id === selectedRowId) && availableRows.length > 0) {
      setSelectedRowId(availableRows[0].row_id);
    }
  }, [selectedZoneId, availableRows, selectedRowId]);

  if (!isOpen) return null;

  const currentRow = rows.find((r) => r.row_id === selectedRowId);
  const rowCode = currentRow?.row_code || '';
  const effectivePrefix = prefix.trim() ? prefix.trim() : (rowCode ? `${rowCode}-` : 'M');

  const count = Math.max(0, endNum - startNum + 1);
  const previewSample: string[] = [];
  for (let i = startNum; i <= Math.min(startNum + 3, endNum); i++) {
    previewSample.push(`${effectivePrefix}${String(i).padStart(digits, '0')}`);
  }
  if (count > 4) {
    previewSample.push('...');
    previewSample.push(`${effectivePrefix}${String(endNum).padStart(digits, '0')}`);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(selectedZoneId, selectedRowId, selectedTypeId, orientation, prefix, startNum, endNum, digits, isKimTinh);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#E8F1EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color="#24594D" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Sinh Ô Mộ Nhanh Hàng Loạt</h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>Tạo nhanh danh sách ô mộ vào dãy hàng được chọn</p>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Khu vực *
              </label>
              <select
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              >
                {zones.map((z) => (
                  <option key={z.zone_id} value={z.zone_id}>
                    {z.zone_code} - {z.zone_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Dãy hàng tiếp nhận *
              </label>
              <select
                value={selectedRowId}
                onChange={(e) => setSelectedRowId(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              >
                {availableRows.map((r) => (
                  <option key={r.row_id} value={r.row_id}>
                    {r.row_code} ({r.total_plots} ô)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Quy cách loại mộ *
              </label>
              <select
                value={selectedTypeId}
                onChange={(e) => setSelectedTypeId(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              >
                {plotTypes.map((pt) => (
                  <option key={pt.type_id} value={pt.type_id}>
                    {pt.type_name} ({pt.default_slots} huyệt)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Hướng phong thủy *
              </label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              >
                <option value="BẮC">BẮC</option>
                <option value="NAM">NAM</option>
                <option value="ĐÔNG">ĐÔNG</option>
                <option value="TÂY">TÂY</option>
                <option value="ĐÔNG BẮC">ĐÔNG BẮC</option>
                <option value="ĐÔNG NAM">ĐÔNG NAM</option>
                <option value="TÂY BẮC">TÂY BẮC</option>
                <option value="TÂY NAM">TÂY NAM</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Tiền tố mã ô (tùy chọn)
              </label>
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder={`Mặc định: ${rowCode}-`}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Số chữ số đệm
              </label>
              <select
                value={digits}
                onChange={(e) => setDigits(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              >
                <option value={1}>1 chữ số (-1, -2...)</option>
                <option value={2}>2 chữ số (-01, -02...)</option>
                <option value={3}>3 chữ số (-001, -002...)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Số bắt đầu *
              </label>
              <input
                type="number"
                min={1}
                value={startNum}
                onChange={(e) => setStartNum(Number(e.target.value))}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Số kết thúc *
              </label>
              <input
                type="number"
                min={startNum}
                value={endNum}
                onChange={(e) => setEndNum(Number(e.target.value))}
                required
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>
          </div>

          <div style={{ padding: '8px 12px', backgroundColor: '#FFFBEB', borderRadius: '8px', border: '1px solid #FCD34D' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#92400E', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isKimTinh}
                onChange={(e) => setIsKimTinh(e.target.checked)}
              />
              <span>Thiết kế Kim Tĩnh Bất Biến (Khóa kiên cố theo quy tắc Kim Tĩnh)</span>
            </label>
          </div>

          {/* Live Preview Box */}
          <div style={{ padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }}>
            <div style={{ color: '#64748B', marginBottom: '4px' }}>
              Xem trước: Sẽ sinh <strong>{count}</strong> ô mộ:
            </div>
            <div style={{ fontWeight: 700, color: '#24594D' }}>
              {previewSample.join(', ')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              style={{ flex: 1, padding: '9px', backgroundColor: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isGenerating || count <= 0 || availableRows.length === 0}
              style={{ flex: 1, padding: '9px', backgroundColor: '#24594D', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Zap size={14} />
              <span>{isGenerating ? 'Đang tạo ô...' : `Tạo ${count} Ô Mộ`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

