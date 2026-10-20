import { apiFetch } from '../../services/apiClient'
import React, { useState, useEffect, useMemo } from 'react'
import {
  Tag,
  HeartHandshake,
  FileCode,
  Calculator,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Search,
  Edit3,
  Copy,
  Trash2,
  CalendarOff,
  Filter,
  ArrowUpDown,
} from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { useNotificationModal } from '../../context/NotificationModalContext'
import { Pagination } from '../common/Pagination'
import type { CarePackage, ContractTemplate, PriceItem, PriceList, PriceLookupResult } from '../../types/catalog'

export const CatalogModule: React.FC = () => {
  const { accessToken } = useAuth()
  const { alert: modalAlert, confirm: modalConfirm } = useNotificationModal()
  const [subTab, setSubTab] = useState<'prices' | 'care' | 'templates' | 'simulator'>('prices')
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [carePackages, setCarePackages] = useState<CarePackage[]>([])
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Helper date
  const getTodayStr = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  // Selected price list
  const [selectedPriceListId, setSelectedPriceListId] = useState<number | null>(null)

  // Price Items filter & pagination
  const [priceItemSearch, setPriceItemSearch] = useState<string>('')
  const [priceItemServiceFilter, setPriceItemServiceFilter] = useState<string>('ALL')
  const [priceItemPage, setPriceItemPage] = useState<number>(1)
  const [priceItemPageSize, setPriceItemPageSize] = useState<number>(10)

  // Care Packages search, filter, sort & pagination (For 189+ items)
  const [careSearch, setCareSearch] = useState<string>('')
  const [careCycleFilter, setCareCycleFilter] = useState<string>('ALL')
  const [careStatusFilter, setCareStatusFilter] = useState<string>('ALL')
  const [careSortBy, setCareSortBy] = useState<'code_asc' | 'name_asc' | 'price_asc' | 'price_desc'>('code_asc')
  const [carePage, setCarePage] = useState<number>(1)
  const [carePageSize, setCarePageSize] = useState<number>(12)

  // Contract Templates pagination
  const [templatePage, setTemplatePage] = useState<number>(1)
  const [templatePageSize, setTemplatePageSize] = useState<number>(10)

  // Simulation state
  const [simDate, setSimDate] = useState<string>(getTodayStr())
  const [simServiceCode, setSimServiceCode] = useState<string>('BURIAL')
  const [simResult, setSimResult] = useState<PriceLookupResult | null>(null)
  const [simLoading, setSimLoading] = useState<boolean>(false)

  // Modals state
  type ModalType =
    | 'new_price_list'
    | 'edit_price_list'
    | 'close_price_list'
    | 'clone_price_list'
    | 'new_item'
    | 'edit_item'
    | 'new_package'
    | 'edit_package'
    | 'view_template'
    | null

  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null)

  // Price List form states
  const [newPlName, setNewPlName] = useState('')
  const [newPlFrom, setNewPlFrom] = useState(getTodayStr())
  const [newPlTo, setNewPlTo] = useState('')
  const [newPlActive, setNewPlActive] = useState(true)
  const [newPlAutoClosePrevious, setNewPlAutoClosePrevious] = useState(true)

  const [editingPl, setEditingPl] = useState<PriceList | null>(null)
  const [editPlName, setEditPlName] = useState('')
  const [editPlFrom, setEditPlFrom] = useState('')
  const [editPlTo, setEditPlTo] = useState('')
  const [editPlActive, setEditPlActive] = useState(true)

  const [closingPl, setClosingPl] = useState<PriceList | null>(null)
  const [closePlDate, setClosePlDate] = useState(getTodayStr())
  const [closePlDeactivate, setClosePlDeactivate] = useState(false)

  const [cloningPl, setCloningPl] = useState<PriceList | null>(null)
  const [clonePlName, setClonePlName] = useState('')
  const [clonePlFrom, setClonePlFrom] = useState(getTodayStr())
  const [clonePlTo, setClonePlTo] = useState('')
  const [clonePlActive, setClonePlActive] = useState(true)
  const [clonePlAutoClose, setClonePlAutoClose] = useState(false)

  // Price Item form states
  const [newItemCode, setNewItemCode] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('ô mộ')
  const [newItemService, setNewItemService] = useState('BURIAL')

  const [editingItem, setEditingItem] = useState<PriceItem | null>(null)
  const [editItemName, setEditItemName] = useState('')
  const [editItemPrice, setEditItemPrice] = useState('')
  const [editItemUnit, setEditItemUnit] = useState('ô mộ')
  const [editItemService, setEditItemService] = useState('BURIAL')

  // Care Package form states
  const [newPkgCode, setNewPkgCode] = useState('')
  const [newPkgName, setNewPkgName] = useState('')
  const [newPkgCycle, setNewPkgCycle] = useState<'MONTHLY' | 'QUARTERLY' | 'YEARLY'>('MONTHLY')
  const [newPkgPrice, setNewPkgPrice] = useState('')
  const [newPkgTasks, setNewPkgTasks] = useState('Dọn cỏ, Lau bia đá, Thắp hương tuần rằm')

  const [editingPkg, setEditingPkg] = useState<CarePackage | null>(null)
  const [editPkgName, setEditPkgName] = useState('')
  const [editPkgCycle, setEditPkgCycle] = useState<'MONTHLY' | 'QUARTERLY' | 'YEARLY'>('MONTHLY')
  const [editPkgPrice, setEditPkgPrice] = useState('')
  const [editPkgTasks, setEditPkgTasks] = useState('')
  const [editPkgActive, setEditPkgActive] = useState(true)

  const getAuthToken = () =>
    accessToken ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('cemetery_access_token') ||
    ''

  const showNotification = (msg: string) => {
    setStatusMessage(msg)
    setTimeout(() => setStatusMessage(null), 5000)
  }

  const loadAllData = async () => {
    setLoading(true)
    setError(null)
    const token = getAuthToken()
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const [plRes, careRes, tmplRes] = await Promise.all([
        apiFetch('/api/v1/catalog/price-lists', { headers }),
        apiFetch('/api/v1/catalog/care-packages', { headers }),
        apiFetch('/api/v1/catalog/contract-templates', { headers }),
      ])

      if (!plRes.ok || !careRes.ok || !tmplRes.ok) {
        throw new Error('Không thể tải danh mục cấu hình nền từ máy chủ. Vui lòng kiểm tra quyền truy cập.')
      }

      const [plData, careData, tmplData] = await Promise.all([
        plRes.json(),
        careRes.json(),
        tmplRes.json(),
      ])

      setPriceLists(plData)
      setCarePackages(careData)
      setTemplates(tmplData)
      if (plData.length > 0 && !selectedPriceListId) {
        setSelectedPriceListId(plData[0].price_list_id)
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Đã xảy ra lỗi nạp dữ liệu')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllData()
  }, [accessToken])

  // Price Simulation Handler
  const handleSimulatePrice = async () => {
    setSimLoading(true)
    try {
      const res = await apiFetch('/api/v1/catalog/lookup-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          target_date: simDate || undefined,
          service_code: simServiceCode || undefined,
        }),
      })
      if (!res.ok) throw new Error('Không thể tra cứu giá')
      const result: PriceLookupResult = await res.json()
      setSimResult(result)
    } catch (err) {
      modalAlert({ message: err instanceof Error ? err.message : 'Lỗi tra cứu', type: 'error' })
    } finally {
      setSimLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Price List Handlers
  // ---------------------------------------------------------------------------
  const handleCreatePriceList = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await apiFetch('/api/v1/catalog/price-lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          price_list_name: newPlName,
          effective_from_date: newPlFrom,
          effective_to_date: newPlTo || null,
          is_active: newPlActive,
          auto_close_previous: newPlAutoClosePrevious,
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Lỗi tạo bảng giá')
      }
      const created: PriceList = await res.json()
      showNotification('Tạo bảng giá mới thành công!')
      setActiveModal(null)
      setNewPlName('')
      setSelectedPriceListId(created.price_list_id)
      await loadAllData()
    } catch (err) {
      modalAlert({ message: err instanceof Error ? err.message : 'Lỗi tạo bảng giá', type: 'error' })
    }
  }

  const openEditPriceList = (pl: PriceList) => {
    setEditingPl(pl)
    setEditPlName(pl.price_list_name)
    setEditPlFrom(pl.effective_from_date)
    setEditPlTo(pl.effective_to_date || '')
    setEditPlActive(pl.is_active)
    setActiveModal('edit_price_list')
  }

  const handleEditPriceList = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPl) return
    try {
      const res = await apiFetch(`/api/v1/catalog/price-lists/${editingPl.price_list_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          price_list_name: editPlName,
          effective_from_date: editPlFrom,
          effective_to_date: editPlTo || null,
          is_active: editPlActive,
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Lỗi cập nhật bảng giá')
      }
      showNotification('Cập nhật bảng giá thành công!')
      setActiveModal(null)
      await loadAllData()
    } catch (err) {
      modalAlert({ message: err instanceof Error ? err.message : 'Lỗi cập nhật', type: 'error' })
    }
  }

  const openClosePriceList = (pl: PriceList) => {
    setClosingPl(pl)
    setClosePlDate(getTodayStr())
    setClosePlDeactivate(false)
    setActiveModal('close_price_list')
  }

  const handleClosePriceList = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!closingPl) return
    try {
      const res = await apiFetch(`/api/v1/catalog/price-lists/${closingPl.price_list_id}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          close_date: closePlDate || undefined,
          deactivate: closePlDeactivate,
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Lỗi đóng hiệu lực bảng giá')
      }
      showNotification(`Đã thiết lập kết thúc hiệu lực bảng giá vào ngày ${closePlDate}`)
      setActiveModal(null)
      await loadAllData()
    } catch (err) {
      modalAlert({ message: err instanceof Error ? err.message : 'Lỗi đóng bảng giá', type: 'error' })
    }
  }

  const openClonePriceList = (pl: PriceList) => {
    setCloningPl(pl)
    setClonePlName(`Bản sao của ${pl.price_list_name}`)
    setClonePlFrom(getTodayStr())
    setClonePlTo('')
    setClonePlActive(false)
    setClonePlAutoClose(false)
    setActiveModal('clone_price_list')
  }

  const handleClonePriceList = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cloningPl) return
    try {
      const res = await apiFetch(`/api/v1/catalog/price-lists/${cloningPl.price_list_id}/clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          new_price_list_name: clonePlName,
          effective_from_date: clonePlFrom,
          effective_to_date: clonePlTo || null,
          is_active: clonePlActive,
          auto_close_previous: clonePlAutoClose,
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Lỗi sao chép bảng giá')
      }
      const cloned: PriceList = await res.json()
      showNotification(`Đã sao chép thành công sang bảng giá mới với ${cloned.items.length} khoản mục!`)
      setActiveModal(null)
      setSelectedPriceListId(cloned.price_list_id)
      await loadAllData()
    } catch (err) {
      modalAlert({ message: err instanceof Error ? err.message : 'Lỗi sao chép', type: 'error' })
    }
  }

  const handleDeletePriceList = async (pl: PriceList) => {
    const confirmed = await modalConfirm({
      title: 'Xác Nhận Xóa Bảng Giá',
      message: `Bạn có chắc chắn muốn xóa bảng giá "${pl.price_list_name}" cùng toàn bộ ${pl.items.length} khoản mục giá con? Hành động này không thể hoàn tác.`,
      confirmText: 'Xác nhận xóa',
      cancelText: 'Hủy bỏ',
      isDestructive: true,
    })
    if (!confirmed) return

    try {
      const res = await apiFetch(`/api/v1/catalog/price-lists/${pl.price_list_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Không thể xóa bảng giá')
      }
      showNotification('Đã xóa bảng giá thành công')
      setSelectedPriceListId(null)
      await loadAllData()
    } catch (err) {
      modalAlert({ message: err instanceof Error ? err.message : 'Lỗi xóa bảng giá', type: 'error' })
    }
  }

  // ---------------------------------------------------------------------------
  // Price Item Handlers
  // ---------------------------------------------------------------------------
  const handleAddPriceItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPriceListId) return
    try {
      const res = await apiFetch('/api/v1/catalog/price-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          price_list_id: selectedPriceListId,
          item_code: newItemCode.trim(),
          item_name: newItemName.trim(),
          unit_price: parseFloat(newItemPrice),
          unit: newItemUnit.trim(),
          service_code: newItemService,
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Lỗi thêm khoản mục giá')
      }
      showNotification('Thêm khoản mục giá thành công!')
      setActiveModal(null)
      setNewItemCode('')
      setNewItemName('')
      setNewItemPrice('')
      await loadAllData()
    } catch (err) {
      modalAlert({ message: err instanceof Error ? err.message : 'Lỗi thêm hạng mục', type: 'error' })
    }
  }

  const openEditPriceItem = (item: PriceItem) => {
    setEditingItem(item)
    setEditItemName(item.item_name)
    setEditItemPrice(String(item.unit_price))
    setEditItemUnit(item.unit)
    setEditItemService(item.service_code || 'BURIAL')
    setActiveModal('edit_item')
  }

  const handleEditPriceItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return
    try {
      const res = await apiFetch(`/api/v1/catalog/price-items/${editingItem.item_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          item_name: editItemName.trim(),
          unit_price: parseFloat(editItemPrice),
          unit: editItemUnit.trim(),
          service_code: editItemService,
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Lỗi cập nhật khoản mục giá')
      }
      showNotification('Cập nhật khoản mục giá thành công!')
      setActiveModal(null)
      await loadAllData()
    } catch (err) {
      modalAlert({ message: err instanceof Error ? err.message : 'Lỗi cập nhật hạng mục', type: 'error' })
    }
  }

  const handleDeletePriceItem = async (item: PriceItem) => {
    const confirmed = await modalConfirm({
      title: 'Xóa Khoản Mục Giá',
      message: `Bạn có chắc chắn muốn xóa khoản mục "${item.item_name}" (${item.item_code}) khỏi bảng giá?`,
      confirmText: 'Xóa khoản mục',
      cancelText: 'Hủy',
      isDestructive: true,
    })
    if (!confirmed) return

    try {
      const res = await apiFetch(`/api/v1/catalog/price-items/${item.item_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Không thể xóa khoản mục')
      }
      showNotification('Đã xóa khoản mục giá thành công')
      await loadAllData()
    } catch (err) {
      modalAlert({ message: err instanceof Error ? err.message : 'Lỗi xóa', type: 'error' })
    }
  }

  // ---------------------------------------------------------------------------
  // Care Package Handlers
  // ---------------------------------------------------------------------------
  const handleTogglePackageActive = async (pkg: CarePackage) => {
    try {
      const res = await apiFetch(`/api/v1/catalog/care-packages/${pkg.package_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          is_active: !pkg.is_active,
        }),
      })
      if (!res.ok) throw new Error('Không thể thay đổi trạng thái gói')
      showNotification(`Đã ${pkg.is_active ? 'ngừng áp dụng' : 'kích hoạt lại'} gói ${pkg.package_code}`)
      await loadAllData()
    } catch (err) {
      modalAlert({ message: err instanceof Error ? err.message : 'Lỗi cập nhật gói', type: 'error' })
    }
  }

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const taskList = newPkgTasks.split(',').map((t) => t.trim()).filter(Boolean)
      const res = await apiFetch('/api/v1/catalog/care-packages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          package_code: newPkgCode.trim(),
          package_name: newPkgName.trim(),
          cycle_type: newPkgCycle,
          default_tasks_json: JSON.stringify(taskList),
          unit_price: parseFloat(newPkgPrice),
          is_active: true,
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Lỗi tạo gói chăm sóc')
      }
      showNotification('Tạo gói chăm sóc thành công!')
      setActiveModal(null)
      setNewPkgCode('')
      setNewPkgName('')
      setNewPkgPrice('')
      await loadAllData()
    } catch (err) {
      modalAlert({ message: err instanceof Error ? err.message : 'Lỗi tạo gói chăm sóc', type: 'error' })
    }
  }

  const openEditPackage = (pkg: CarePackage) => {
    setEditingPkg(pkg)
    setEditPkgName(pkg.package_name)
    setEditPkgCycle(pkg.cycle_type)
    setEditPkgPrice(String(pkg.unit_price))
    try {
      const parsed = JSON.parse(pkg.default_tasks_json)
      setEditPkgTasks(Array.isArray(parsed) ? parsed.join(', ') : pkg.default_tasks_json)
    } catch {
      setEditPkgTasks(pkg.default_tasks_json)
    }
    setEditPkgActive(pkg.is_active)
    setActiveModal('edit_package')
  }

  const handleEditPackage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPkg) return
    try {
      const taskList = editPkgTasks.split(',').map((t) => t.trim()).filter(Boolean)
      const res = await apiFetch(`/api/v1/catalog/care-packages/${editingPkg.package_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          package_name: editPkgName.trim(),
          cycle_type: editPkgCycle,
          default_tasks_json: JSON.stringify(taskList),
          unit_price: parseFloat(editPkgPrice),
          is_active: editPkgActive,
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Lỗi cập nhật gói chăm sóc')
      }
      showNotification('Cập nhật gói chăm sóc thành công!')
      setActiveModal(null)
      await loadAllData()
    } catch (err) {
      modalAlert({ message: err instanceof Error ? err.message : 'Lỗi cập nhật gói', type: 'error' })
    }
  }

  const handleDeletePackage = async (pkg: CarePackage) => {
    const confirmed = await modalConfirm({
      title: 'Xóa Gói Chăm Sóc',
      message: `Bạn có chắc chắn muốn xóa gói "${pkg.package_name}" (${pkg.package_code})? Lưu ý: Nếu gói đã phát sinh hợp đồng hoặc phụ lục khách hàng, hệ thống sẽ từ chối xóa để bảo vệ pháp lý.`,
      confirmText: 'Xác nhận xóa',
      cancelText: 'Hủy',
      isDestructive: true,
    })
    if (!confirmed) return

    try {
      const res = await apiFetch(`/api/v1/catalog/care-packages/${pkg.package_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.detail || 'Không thể xóa gói chăm sóc')
      }
      showNotification('Đã xóa gói chăm sóc thành công')
      await loadAllData()
    } catch (err) {
      modalAlert({ message: err instanceof Error ? err.message : 'Lỗi xóa gói', type: 'error' })
    }
  }

  // ---------------------------------------------------------------------------
  // Contract Template Handlers
  // ---------------------------------------------------------------------------
  const handleBumpTemplateVersion = async (tmpl: ContractTemplate) => {
    const newContent = prompt('Nhập nội dung sửa đổi cho điều khoản (Sẽ tự động nâng lên Version mới không hồi tố):', tmpl.content_html)
    if (!newContent || newContent === tmpl.content_html) return

    try {
      const res = await apiFetch(`/api/v1/catalog/contract-templates/${tmpl.template_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          content_html: newContent,
        }),
      })
      if (!res.ok) throw new Error('Không thể nâng cấp phiên bản')
      const updated: ContractTemplate = await res.json()
      showNotification(`Đã nâng cấp mẫu ${updated.template_code} lên Phiên bản v${updated.version_no} (Không hồi tố)!`)
      await loadAllData()
    } catch (err) {
      modalAlert({ message: err instanceof Error ? err.message : 'Lỗi nâng cấp mẫu điều khoản', type: 'error' })
    }
  }

  // ---------------------------------------------------------------------------
  // Filtered & Sorted Data
  // ---------------------------------------------------------------------------
  const selectedPriceList = useMemo(
    () => priceLists.find((pl) => pl.price_list_id === selectedPriceListId) || priceLists[0],
    [priceLists, selectedPriceListId]
  )

  const filteredPriceItems = useMemo(() => {
    if (!selectedPriceList?.items) return []
    return selectedPriceList.items.filter((item) => {
      const matchSearch =
        !priceItemSearch.trim() ||
        item.item_code.toLowerCase().includes(priceItemSearch.toLowerCase()) ||
        item.item_name.toLowerCase().includes(priceItemSearch.toLowerCase()) ||
        (item.service_code && item.service_code.toLowerCase().includes(priceItemSearch.toLowerCase()))

      const matchService =
        priceItemServiceFilter === 'ALL' || item.service_code === priceItemServiceFilter

      return matchSearch && matchService
    })
  }, [selectedPriceList, priceItemSearch, priceItemServiceFilter])

  const filteredCarePackages = useMemo(() => {
    return carePackages
      .filter((pkg) => {
        const matchSearch =
          !careSearch.trim() ||
          pkg.package_code.toLowerCase().includes(careSearch.toLowerCase()) ||
          pkg.package_name.toLowerCase().includes(careSearch.toLowerCase()) ||
          pkg.default_tasks_json.toLowerCase().includes(careSearch.toLowerCase())

        const matchCycle = careCycleFilter === 'ALL' || pkg.cycle_type === careCycleFilter
        const matchStatus =
          careStatusFilter === 'ALL' ||
          (careStatusFilter === 'ACTIVE' && pkg.is_active) ||
          (careStatusFilter === 'INACTIVE' && !pkg.is_active)

        return matchSearch && matchCycle && matchStatus
      })
      .sort((a, b) => {
        if (careSortBy === 'code_asc') return a.package_code.localeCompare(b.package_code)
        if (careSortBy === 'name_asc') return a.package_name.localeCompare(b.package_name)
        if (careSortBy === 'price_asc') return Number(a.unit_price) - Number(b.unit_price)
        if (careSortBy === 'price_desc') return Number(b.unit_price) - Number(a.unit_price)
        return 0
      })
  }, [carePackages, careSearch, careCycleFilter, careStatusFilter, careSortBy])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Module Title Banner */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          padding: '24px 28px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'rgba(212, 175, 55, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={22} color="#B45309" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                Quản Trị Bảng Giá & Danh Mục Dịch Vụ
              </h2>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '2px 0 0 0' }}>
                Bảng giá niêm yết, Gói chăm sóc định kỳ, Mẫu hợp đồng chuẩn & Tiện ích quản trị nâng cao
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadAllData}
          style={{
            backgroundColor: '#F1F5F9',
            border: '1px solid #CBD5E1',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#334155',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <RefreshCw size={15} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '8px',
            backgroundColor: '#DCFCE7',
            color: '#15803D',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid #BBF7D0',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Sub Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          backgroundColor: '#FFFFFF',
          padding: '8px',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          overflowX: 'auto',
        }}
      >
        <button
          onClick={() => setSubTab('prices')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: subTab === 'prices' ? 'var(--brand-primary)' : 'transparent',
            color: subTab === 'prices' ? '#FFFFFF' : '#64748B',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Tag size={16} />
          <span>1. Bảng Giá & Khoản Mục ({priceLists.length})</span>
        </button>

        <button
          onClick={() => setSubTab('care')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: subTab === 'care' ? 'var(--brand-primary)' : 'transparent',
            color: subTab === 'care' ? '#FFFFFF' : '#64748B',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <HeartHandshake size={16} />
          <span>2. Gói Chăm Sóc Định Kỳ ({carePackages.length})</span>
        </button>

        <button
          onClick={() => setSubTab('templates')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: subTab === 'templates' ? 'var(--brand-primary)' : 'transparent',
            color: subTab === 'templates' ? '#FFFFFF' : '#64748B',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <FileCode size={16} />
          <span>3. Mẫu Hợp Đồng 4 Loại ({templates.length})</span>
        </button>

        <button
          onClick={() => setSubTab('simulator')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: subTab === 'simulator' ? 'var(--brand-primary)' : 'transparent',
            color: subTab === 'simulator' ? '#FFFFFF' : '#64748B',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Calculator size={16} />
          <span>4. Tra Cứu Giá Tức Thời</span>
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <RefreshCw size={28} className="spin" color="var(--brand-primary)" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '12px', color: '#64748B', fontSize: '14px' }}>Đang nạp dữ liệu cấu hình...</p>
        </div>
      )}

      {error && (
        <div style={{ padding: '24px', backgroundColor: '#FEE2E2', borderRadius: '12px', border: '1px solid #FECACA', color: '#DC2626' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <AlertCircle size={20} />
            <span>Đã xảy ra lỗi</span>
          </div>
          <p style={{ marginTop: '6px', fontSize: '13px' }}>{error}</p>
          <button
            onClick={loadAllData}
            style={{
              marginTop: '12px',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* VIEW 1: PRICING & PRICE ITEMS */}
      {!loading && !error && subTab === 'prices' && (
        <div className="responsive-two-col">
          {/* Price Lists Sidebar */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                  Các Bảng Giá ({priceLists.length})
                </h3>
                <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0 0' }}>
                  Quản lý chu kỳ hiệu lực & áp dụng
                </p>
              </div>
              <button
                onClick={() => {
                  setNewPlName('')
                  setNewPlFrom(getTodayStr())
                  setNewPlTo('')
                  setNewPlActive(true)
                  setNewPlAutoClosePrevious(true)
                  setActiveModal('new_price_list')
                }}
                style={{
                  backgroundColor: 'var(--brand-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} />
                <span>Tạo Mới</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {priceLists.map((pl) => {
                const isSelected = selectedPriceListId === pl.price_list_id
                return (
                  <div
                    key={pl.price_list_id}
                    onClick={() => setSelectedPriceListId(pl.price_list_id)}
                    style={{
                      padding: '14px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid var(--brand-primary)' : '1px solid #E2E8F0',
                      backgroundColor: isSelected ? 'rgba(36, 89, 77, 0.04)' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: isSelected ? 'var(--brand-primary)' : '#1E293B' }}>
                        {pl.price_list_name}
                      </div>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: pl.is_active ? '#DCFCE7' : '#F1F5F9',
                          color: pl.is_active ? '#15803D' : '#64748B',
                        }}
                      >
                        {pl.is_active ? 'HIỆU LỰC' : 'ĐÃ ĐÓNG'}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      <span>
                        {pl.effective_from_date} → {pl.effective_to_date || 'Vô thời hạn'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid #F1F5F9' }}>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>{pl.items.length} khoản mục</span>
                      <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openEditPriceList(pl)}
                          title="Sửa bảng giá"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#64748B',
                            cursor: 'pointer',
                            padding: '3px',
                            borderRadius: '4px',
                          }}
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openClosePriceList(pl)}
                          title="Đóng hiệu lực bảng giá (Giới hạn ngày kết thúc)"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#D97706',
                            cursor: 'pointer',
                            padding: '3px',
                            borderRadius: '4px',
                          }}
                        >
                          <CalendarOff size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openClonePriceList(pl)}
                          title="Sao chép sang bảng giá mới"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#0284C7',
                            cursor: 'pointer',
                            padding: '3px',
                            borderRadius: '4px',
                          }}
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePriceList(pl)}
                          title="Xóa bảng giá"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#EF4444',
                            cursor: 'pointer',
                            padding: '3px',
                            borderRadius: '4px',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected Price List Items */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                    {selectedPriceList ? selectedPriceList.price_list_name : 'Chi Tiết Bảng Giá'}
                  </h3>
                  {selectedPriceList && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: selectedPriceList.is_active ? '#DCFCE7' : '#F1F5F9',
                        color: selectedPriceList.is_active ? '#15803D' : '#64748B',
                      }}
                    >
                      {selectedPriceList.is_active ? 'ĐANG ÁP DỤNG' : 'ĐÃ ĐÓNG HIỆU LỰC'}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0' }}>
                  Hiệu lực từ <strong>{selectedPriceList?.effective_from_date}</strong> đến{' '}
                  <strong>{selectedPriceList?.effective_to_date || 'Vô thời hạn'}</strong> • Tổng {selectedPriceList?.items.length || 0} khoản mục
                </p>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {selectedPriceList && (
                  <>
                    <button
                      onClick={() => openEditPriceList(selectedPriceList)}
                      style={{
                        backgroundColor: '#F1F5F9',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <Edit3 size={13} />
                      <span>Sửa Bảng Giá</span>
                    </button>
                    <button
                      onClick={() => openClosePriceList(selectedPriceList)}
                      style={{
                        backgroundColor: '#FEF3C7',
                        border: '1px solid #FCD34D',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#B45309',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <CalendarOff size={13} />
                      <span>Đóng Hiệu Lực</span>
                    </button>
                    <button
                      onClick={() => openClonePriceList(selectedPriceList)}
                      style={{
                        backgroundColor: '#E0F2FE',
                        border: '1px solid #BAE6FD',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#0369A1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <Copy size={13} />
                      <span>Sao Chép</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setNewItemCode('')
                    setNewItemName('')
                    setNewItemPrice('')
                    setNewItemUnit('ô mộ')
                    setNewItemService('BURIAL')
                    setActiveModal('new_item')
                  }}
                  style={{
                    backgroundColor: 'var(--brand-primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={14} />
                  <span>+ Khoản Mục Mới</span>
                </button>
              </div>
            </div>

            {/* Price Items Filter Toolbar */}
            <div
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                flexWrap: 'wrap',
                padding: '10px 14px',
                backgroundColor: '#F8FAFC',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
              }}
            >
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Tìm kiếm khoản mục theo mã, tên..."
                  value={priceItemSearch}
                  onChange={(e) => {
                    setPriceItemSearch(e.target.value)
                    setPriceItemPage(1)
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 30px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={13} color="#64748B" />
                <select
                  value={priceItemServiceFilter}
                  onChange={(e) => {
                    setPriceItemServiceFilter(e.target.value)
                    setPriceItemPage(1)
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '12px',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value="ALL">Tất cả dịch vụ</option>
                  <option value="BURIAL">BURIAL (An táng)</option>
                  <option value="CONSTRUCTION">CONSTRUCTION (Thi công)</option>
                  <option value="EXHUMATION">EXHUMATION (Cải táng)</option>
                  <option value="CREMATION">CREMATION (Hỏa táng)</option>
                  <option value="LAND_PURCHASE">LAND_PURCHASE (Bán đất)</option>
                </select>
              </div>

              <span style={{ fontSize: '11px', color: '#64748B' }}>
                Khớp {filteredPriceItems.length}/{selectedPriceList?.items.length || 0} khoản mục
              </span>
            </div>

            {/* Price Items Table */}
            {filteredPriceItems.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#94A3B8', border: '1px dashed #CBD5E1', borderRadius: '8px' }}>
                {priceItemSearch || priceItemServiceFilter !== 'ALL'
                  ? 'Không tìm thấy khoản mục giá nào khớp với điều kiện lọc.'
                  : 'Bảng giá này chưa có khoản mục giá nào. Nhấn "+ Khoản Mục Mới" để thiết lập.'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                      <th style={{ padding: '10px 12px' }}>Mã Khoản Mục</th>
                      <th style={{ padding: '10px 12px' }}>Tên Dịch Vụ / Hạng Mục</th>
                      <th style={{ padding: '10px 12px' }}>Phạm Vi Áp Dụng</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Đơn Giá (VNĐ)</th>
                      <th style={{ padding: '10px 12px' }}>Đơn Vị</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPriceItems
                      .slice((priceItemPage - 1) * priceItemPageSize, priceItemPage * priceItemPageSize)
                      .map((item) => (
                        <tr key={item.item_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--brand-primary)' }}>
                            {item.item_code}
                          </td>
                          <td style={{ padding: '12px', fontWeight: 500, color: '#1E293B' }}>{item.item_name}</td>
                          <td style={{ padding: '12px', color: '#64748B' }}>
                            {item.service_code ? (
                              <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#E0F2FE', color: '#0369A1' }}>
                                Dịch vụ: {item.service_code}
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Toàn nghĩa trang</span>
                            )}
                          </td>
                          <td style={{ padding: '12px', fontWeight: 700, color: '#0F172A', textAlign: 'right' }}>
                            {Number(item.unit_price).toLocaleString('vi-VN')} đ
                          </td>
                          <td style={{ padding: '12px', color: '#64748B' }}>{item.unit}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={() => openEditPriceItem(item)}
                                title="Chỉnh sửa khoản mục giá"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#0284C7',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  borderRadius: '4px',
                                }}
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePriceItem(item)}
                                title="Xóa khoản mục giá"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#EF4444',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  borderRadius: '4px',
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <Pagination
                  currentPage={priceItemPage}
                  totalItems={filteredPriceItems.length}
                  pageSize={priceItemPageSize}
                  onPageChange={setPriceItemPage}
                  onPageSizeChange={setPriceItemPageSize}
                  pageSizeOptions={[10, 20, 50]}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: CARE PACKAGES (OPTIMIZED FOR LARGE VOLUME: 189+ PACKAGES) */}
      {!loading && !error && subTab === 'care' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top Search & Filter Bar */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: '#FFFFFF',
              padding: '18px 22px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
                  Danh Mục Gói Dịch Vụ Chăm Sóc Mộ Định Kỳ ({carePackages.length} gói)
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                  Tìm kiếm tức thời, lọc chu kỳ, chỉnh sửa và quản lý trạng thái an toàn
                </div>
              </div>
              <button
                onClick={() => {
                  setNewPkgCode('')
                  setNewPkgName('')
                  setNewPkgCycle('MONTHLY')
                  setNewPkgPrice('')
                  setNewPkgTasks('Dọn cỏ, Lau bia đá, Thắp hương tuần rằm')
                  setActiveModal('new_package')
                }}
                style={{
                  backgroundColor: 'var(--brand-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} />
                <span>+ Thêm Gói Mới</span>
              </button>
            </div>

            {/* Search and Filters Toolbar */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
              {/* Search */}
              <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Tìm theo mã gói (PKG_...), tên gói, công việc..."
                  value={careSearch}
                  onChange={(e) => {
                    setCareSearch(e.target.value)
                    setCarePage(1)
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 32px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Cycle Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#64748B' }}>Chu kỳ:</span>
                <select
                  value={careCycleFilter}
                  onChange={(e) => {
                    setCareCycleFilter(e.target.value)
                    setCarePage(1)
                  }}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '12px',
                    backgroundColor: '#FFFFFF',
                    outline: 'none',
                  }}
                >
                  <option value="ALL">Tất cả chu kỳ</option>
                  <option value="MONTHLY">Hàng tháng (MONTHLY)</option>
                  <option value="QUARTERLY">Theo quý (QUARTERLY)</option>
                  <option value="YEARLY">Hàng năm (YEARLY)</option>
                </select>
              </div>

              {/* Status Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#64748B' }}>Trạng thái:</span>
                <select
                  value={careStatusFilter}
                  onChange={(e) => {
                    setCareStatusFilter(e.target.value)
                    setCarePage(1)
                  }}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '12px',
                    backgroundColor: '#FFFFFF',
                    outline: 'none',
                  }}
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang kích hoạt</option>
                  <option value="INACTIVE">Ngừng áp dụng</option>
                </select>
              </div>

              {/* Sort By */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ArrowUpDown size={13} color="#64748B" />
                <select
                  value={careSortBy}
                  onChange={(e) => setCareSortBy(e.target.value as any)}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '12px',
                    backgroundColor: '#FFFFFF',
                    outline: 'none',
                  }}
                >
                  <option value="code_asc">Mã gói (A-Z)</option>
                  <option value="name_asc">Tên gói (A-Z)</option>
                  <option value="price_asc">Giá (Thấp → Cao)</option>
                  <option value="price_desc">Giá (Cao → Thấp)</option>
                </select>
              </div>
            </div>

            <div style={{ fontSize: '12px', color: '#64748B' }}>
              Hiển thị {filteredCarePackages.length} / {carePackages.length} gói chăm sóc
            </div>
          </div>

          {/* Cards Grid */}
          {filteredCarePackages.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px dashed #CBD5E1', color: '#64748B' }}>
              Không tìm thấy gói chăm sóc nào phù hợp với bộ lọc tìm kiếm.
            </div>
          ) : (
            <div className="responsive-auto-cards">
              {filteredCarePackages
                .slice((carePage - 1) * carePageSize, carePage * carePageSize)
                .map((pkg) => {
                  let tasks: string[] = []
                  try {
                    const parsed = JSON.parse(pkg.default_tasks_json)
                    tasks = Array.isArray(parsed) ? parsed : [pkg.default_tasks_json]
                  } catch {
                    tasks = [pkg.default_tasks_json]
                  }

                  return (
                    <div
                      key={pkg.package_id}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        padding: '20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        opacity: pkg.is_active ? 1 : 0.7,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: '#FEF3C7',
                              color: '#B45309',
                            }}
                          >
                            {pkg.cycle_type}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: pkg.is_active ? '#DCFCE7' : '#F1F5F9',
                              color: pkg.is_active ? '#15803D' : '#64748B',
                            }}
                          >
                            {pkg.is_active ? 'ĐANG KÍCH HOẠT' : 'NGỪNG ÁP DỤNG'}
                          </span>
                        </div>

                        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
                          {pkg.package_name}
                        </h3>
                        <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#64748B', marginBottom: '12px' }}>
                          Mã: {pkg.package_code}
                        </div>

                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Công việc chuẩn ({tasks.length}):
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#475569', lineHeight: '1.5' }}>
                          {tasks.slice(0, 4).map((task, idx) => (
                            <li key={idx} style={{ marginBottom: '2px' }}>
                              {task}
                            </li>
                          ))}
                          {tasks.length > 4 && (
                            <li style={{ color: '#94A3B8', listStyleType: 'none', fontStyle: 'italic' }}>
                              +{tasks.length - 4} công việc khác...
                            </li>
                          )}
                        </ul>
                      </div>

                      <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #F1F5F9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>Đơn giá:</span>
                          <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--brand-primary)' }}>
                            {Number(pkg.unit_price).toLocaleString('vi-VN')} đ
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => openEditPackage(pkg)}
                            style={{
                              backgroundColor: '#F1F5F9',
                              border: '1px solid #CBD5E1',
                              borderRadius: '6px',
                              padding: '5px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            <Edit3 size={12} />
                            <span>Sửa</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTogglePackageActive(pkg)}
                            style={{
                              backgroundColor: pkg.is_active ? '#FEF2F2' : '#F0FDF4',
                              color: pkg.is_active ? '#DC2626' : '#15803D',
                              border: pkg.is_active ? '1px solid #FECACA' : '1px solid #BBF7D0',
                              borderRadius: '6px',
                              padding: '5px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {pkg.is_active ? 'Ngừng' : 'Bật lại'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeletePackage(pkg)}
                            title="Xóa gói chăm sóc"
                            style={{
                              backgroundColor: '#FFF1F2',
                              color: '#E11D48',
                              border: '1px solid #FFE4E6',
                              borderRadius: '6px',
                              padding: '5px 8px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}

          <Pagination
            currentPage={carePage}
            totalItems={filteredCarePackages.length}
            pageSize={carePageSize}
            onPageChange={setCarePage}
            onPageSizeChange={setCarePageSize}
            pageSizeOptions={[12, 24, 48, 96]}
          />
        </div>
      )}

      {/* VIEW 3: CONTRACT TEMPLATES */}
      {!loading && !error && subTab === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '16px 20px', backgroundColor: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '13px', color: '#1E40AF' }}>
            <strong>Quy định bảo toàn hợp đồng:</strong> Hệ thống hỗ trợ 4 loại hợp đồng chuẩn (Mua đất, Cải táng, Hỏa táng, Chuyển nhượng) và phụ lục an táng. Khi cập nhật mẫu, hệ thống tự động sinh phiên bản mới mà không ảnh hưởng đến các hợp đồng đã ký kết.
          </div>

          <div className="responsive-auto-cards">
            {templates
              .slice((templatePage - 1) * templatePageSize, templatePage * templatePageSize)
              .map((tmpl) => {
                let reqDocs: string[] = []
                try {
                  if (tmpl.required_documents_json) reqDocs = JSON.parse(tmpl.required_documents_json)
                } catch {
                  reqDocs = []
                }

                return (
                  <div
                    key={tmpl.template_id}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      padding: '24px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#E0F2FE',
                            color: '#0369A1',
                          }}
                        >
                          {tmpl.contract_type}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#F1F5F9',
                            color: '#475569',
                          }}
                        >
                          v{tmpl.version_no}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                        {tmpl.template_name}
                      </h3>
                      <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#64748B', marginBottom: '16px' }}>
                        Mã biểu mẫu: {tmpl.template_code}
                      </div>

                      <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px' }}>
                        Hồ sơ bắt buộc: {reqDocs.length > 0 ? reqDocs.join(', ') : 'Không yêu cầu'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
                      <button
                        onClick={() => {
                          setSelectedTemplate(tmpl)
                          setActiveModal('view_template')
                        }}
                        style={{
                          flex: 1,
                          backgroundColor: '#F1F5F9',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          padding: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#1E293B',
                          cursor: 'pointer',
                        }}
                      >
                        Xem Điều Khoản
                      </button>
                      <button
                        onClick={() => handleBumpTemplateVersion(tmpl)}
                        style={{
                          backgroundColor: 'var(--brand-primary)',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Nâng Phiên Bản (Bump)
                      </button>
                    </div>
                  </div>
                )
              })}
          </div>
          <Pagination
            currentPage={templatePage}
            totalItems={templates.length}
            pageSize={templatePageSize}
            onPageChange={setTemplatePage}
            onPageSizeChange={setTemplatePageSize}
            pageSizeOptions={[6, 12, 24]}
          />
        </div>
      )}

      {/* VIEW 4: PRICE LOOKUP SIMULATOR */}
      {!loading && !error && subTab === 'simulator' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '28px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Calculator size={22} color="var(--brand-primary)" />
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                Công Cụ Mô Phỏng Tra Cứu Đơn Giá Tức Thời (Realtime Pricing Simulator)
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '2px 0 0 0' }}>
                Xem đơn giá áp dụng theo ngày ký hợp đồng.
              </p>
            </div>
          </div>

          <div className="responsive-form-row">
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Ngày áp dụng định giá</label>
              <input
                type="date"
                value={simDate}
                onChange={(e) => setSimDate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Hạng mục / Dịch vụ</label>
              <select
                value={simServiceCode}
                onChange={(e) => setSimServiceCode(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              >
                <option value="BURIAL">An táng (Hạ huyệt tiêu chuẩn)</option>
                <option value="CONSTRUCTION">Thi công kim tĩnh đúc kiên cố</option>
                <option value="EXHUMATION">Cải táng sang tiểu quách</option>
                <option value="CREMATION">Hỏa táng công nghệ cao</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSimulatePrice}
            disabled={simLoading}
            style={{
              backgroundColor: 'var(--brand-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: simLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '16px',
            }}
          >
            <Calculator size={16} />
            <span>{simLoading ? 'Đang tính toán...' : 'Tra Cứu Bảng Giá'}</span>
          </button>

          {simResult && (
            <div style={{ marginTop: '24px', padding: '20px', borderRadius: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '10px' }}>
                Kết Quả Khớp Bảng Giá Áp Dụng:
              </div>

              {simResult.matched ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div>Bảng giá nguồn: <strong>{simResult.price_list_name}</strong></div>
                  <div>Khoản mục: <strong>[{simResult.item_code}] {simResult.item_name}</strong></div>
                  <div>
                    Đơn giá tại ngày ký:{' '}
                    <strong style={{ fontSize: '18px', color: 'var(--brand-primary)' }}>
                      {Number(simResult.unit_price).toLocaleString('vi-VN')} đ
                    </strong>{' '}
                    / {simResult.unit}
                  </div>
                  <div style={{ fontSize: '12px', color: '#15803D' }}>
                    ✓ Kết quả khớp chính xác bảng giá hiệu lực tại ngày {simDate}.
                  </div>
                </div>
              ) : (
                <div style={{ color: '#DC2626', fontSize: '13px' }}>
                  Không tìm thấy bảng giá nào đang hiệu lực tại ngày {simDate} cho dịch vụ này.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODALS */}
      {/* =================================================================== */}

      {/* Modal: View Template HTML */}
      {activeModal === 'view_template' && selectedTemplate && (
        <div className="responsive-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div className="responsive-modal-card" style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', maxWidth: '750px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>
                {selectedTemplate.template_name} (v{selectedTemplate.version_no})
              </div>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, lineHeight: '1.7', fontSize: '14px' }}>
              <div dangerouslySetInnerHTML={{ __html: selectedTemplate.content_html }} />
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', textAlign: 'right' }}>
              <button onClick={() => setActiveModal(null)} style={{ backgroundColor: 'var(--brand-primary)', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '8px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Price List */}
      {activeModal === 'new_price_list' && (
        <div className="responsive-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="responsive-modal-card" style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', maxWidth: '480px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Tạo Bảng Giá Dịch Vụ Mới</h3>
            <form onSubmit={handleCreatePriceList} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Tên bảng giá</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Bảng Giá Điều Chỉnh Dịch Vụ 2027"
                  value={newPlName}
                  onChange={(e) => setNewPlName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Ngày bắt đầu hiệu lực</label>
                <input
                  type="date"
                  required
                  value={newPlFrom}
                  onChange={(e) => setNewPlFrom(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Ngày kết thúc (Để trống nếu vô thời hạn)</label>
                <input
                  type="date"
                  value={newPlTo}
                  onChange={(e) => setNewPlTo(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="pl_active"
                  checked={newPlActive}
                  onChange={(e) => setNewPlActive(e.target.checked)}
                />
                <label htmlFor="pl_active" style={{ fontSize: '13px', cursor: 'pointer' }}>Kích hoạt ngay bảng giá này</label>
              </div>

              <div style={{ padding: '10px 12px', backgroundColor: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="auto_close_prev"
                    checked={newPlAutoClosePrevious}
                    onChange={(e) => setNewPlAutoClosePrevious(e.target.checked)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <label htmlFor="auto_close_prev" style={{ fontSize: '12px', fontWeight: 600, color: '#1E40AF', cursor: 'pointer' }}>
                      Tự động kết thúc bảng giá đang áp dụng trước đó vào ngày liền kề
                    </label>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#3B82F6', lineHeight: '1.4' }}>
                      Giải quyết xung đột trùng lặp thời gian khi bảng giá hiện tại đang ở chế độ vô thời hạn. Hệ thống sẽ tự động đặt ngày kết thúc cho bảng giá cũ trước ngày bảng giá mới áp dụng.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setActiveModal(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#F1F5F9', fontSize: '13px' }}>Hủy</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--brand-primary)', color: '#FFFFFF', fontWeight: 600, fontSize: '13px' }}>Tạo Bảng Giá</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Price List */}
      {activeModal === 'edit_price_list' && editingPl && (
        <div className="responsive-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="responsive-modal-card" style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', maxWidth: '480px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Chỉnh Sửa Bảng Giá</h3>
            <form onSubmit={handleEditPriceList} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Tên bảng giá</label>
                <input
                  type="text"
                  required
                  value={editPlName}
                  onChange={(e) => setEditPlName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Ngày bắt đầu hiệu lực</label>
                <input
                  type="date"
                  required
                  value={editPlFrom}
                  onChange={(e) => setEditPlFrom(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
                  Ngày kết thúc hiệu lực (Để trống nếu vô thời hạn)
                </label>
                <input
                  type="date"
                  value={editPlTo}
                  onChange={(e) => setEditPlTo(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
                <span style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', display: 'block' }}>
                  💡 Điền ngày kết thúc để đóng chế độ vô thời hạn của bảng giá này.
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="edit_pl_active"
                  checked={editPlActive}
                  onChange={(e) => setEditPlActive(e.target.checked)}
                />
                <label htmlFor="edit_pl_active" style={{ fontSize: '13px', cursor: 'pointer' }}>Đang kích hoạt áp dụng (is_active)</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setActiveModal(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#F1F5F9', fontSize: '13px' }}>Hủy</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--brand-primary)', color: '#FFFFFF', fontWeight: 600, fontSize: '13px' }}>Lưu Thay Đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Close Price List (Đóng hiệu lực bảng giá) */}
      {activeModal === 'close_price_list' && closingPl && (
        <div className="responsive-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="responsive-modal-card" style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', maxWidth: '460px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B45309', marginBottom: '12px' }}>
              <CalendarOff size={20} />
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Đóng Hiệu Lực Bảng Giá</h3>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px', lineHeight: '1.5' }}>
              Thiết lập ngày kết thúc hiệu lực cho bảng giá <strong>"{closingPl.price_list_name}"</strong>. Sau ngày này, bảng giá sẽ không còn được áp dụng tự động cho các giao dịch mới.
            </p>
            <form onSubmit={handleClosePriceList} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Ngày kết thúc hiệu lực</label>
                <input
                  type="date"
                  required
                  value={closePlDate}
                  onChange={(e) => setClosePlDate(e.target.value)}
                  min={closingPl.effective_from_date}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="close_deact"
                  checked={closePlDeactivate}
                  onChange={(e) => setClosePlDeactivate(e.target.checked)}
                />
                <label htmlFor="close_deact" style={{ fontSize: '13px', cursor: 'pointer' }}>Ngừng kích hoạt hoàn toàn (is_active = False)</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setActiveModal(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#F1F5F9', fontSize: '13px' }}>Hủy</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: '#D97706', color: '#FFFFFF', fontWeight: 600, fontSize: '13px' }}>Xác Nhận Đóng</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Clone Price List */}
      {activeModal === 'clone_price_list' && cloningPl && (
        <div className="responsive-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="responsive-modal-card" style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', maxWidth: '480px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0369A1', marginBottom: '12px' }}>
              <Copy size={20} />
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Sao Chép Bảng Giá</h3>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px', lineHeight: '1.5' }}>
              Sao chép toàn bộ {cloningPl.items.length} khoản mục định giá từ <strong>"{cloningPl.price_list_name}"</strong> sang một bảng giá mới.
            </p>
            <form onSubmit={handleClonePriceList} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Tên bảng giá mới</label>
                <input
                  type="text"
                  required
                  value={clonePlName}
                  onChange={(e) => setClonePlName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Ngày bắt đầu hiệu lực</label>
                <input
                  type="date"
                  required
                  value={clonePlFrom}
                  onChange={(e) => setClonePlFrom(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Ngày kết thúc (Để trống nếu vô thời hạn)</label>
                <input
                  type="date"
                  value={clonePlTo}
                  onChange={(e) => setClonePlTo(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="clone_active"
                  checked={clonePlActive}
                  onChange={(e) => setClonePlActive(e.target.checked)}
                />
                <label htmlFor="clone_active" style={{ fontSize: '13px', cursor: 'pointer' }}>Kích hoạt ngay bảng giá mới này</label>
              </div>

              {clonePlActive && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="clone_autoclose"
                    checked={clonePlAutoClose}
                    onChange={(e) => setClonePlAutoClose(e.target.checked)}
                  />
                  <label htmlFor="clone_autoclose" style={{ fontSize: '12px', color: '#1E40AF', cursor: 'pointer' }}>
                    Tự động đóng bảng giá trước đó vào ngày liền kề
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setActiveModal(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#F1F5F9', fontSize: '13px' }}>Hủy</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: '#0284C7', color: '#FFFFFF', fontWeight: 600, fontSize: '13px' }}>Sao Chép & Tạo Mới</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Price Item */}
      {activeModal === 'new_item' && (
        <div className="responsive-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="responsive-modal-card" style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', maxWidth: '480px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Thêm Khoản Mục Giá Mới</h3>
            <form onSubmit={handleAddPriceItem} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Mã khoản mục</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: GIA-DAT-A2"
                  value={newItemCode}
                  onChange={(e) => setNewItemCode(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Tên khoản mục</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Đơn giá chuyển nhượng ô mộ khu A2"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div className="responsive-form-row-2-1">
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Đơn giá (VNĐ)</label>
                  <input
                    type="number"
                    required
                    placeholder="120000000"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Đơn vị tính</label>
                  <input
                    type="text"
                    required
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Mã dịch vụ gắn kết (Scope)</label>
                <select
                  value={newItemService}
                  onChange={(e) => setNewItemService(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                >
                  <option value="BURIAL">BURIAL (An táng)</option>
                  <option value="CONSTRUCTION">CONSTRUCTION (Thi công)</option>
                  <option value="EXHUMATION">EXHUMATION (Cải táng)</option>
                  <option value="CREMATION">CREMATION (Hỏa táng)</option>
                  <option value="LAND_PURCHASE">LAND_PURCHASE (Bán đất)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setActiveModal(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#F1F5F9', fontSize: '13px' }}>Hủy</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--brand-primary)', color: '#FFFFFF', fontWeight: 600, fontSize: '13px' }}>Lưu Khoản Mục</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Price Item */}
      {activeModal === 'edit_item' && editingItem && (
        <div className="responsive-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="responsive-modal-card" style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', maxWidth: '480px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
              Chỉnh Sửa Khoản Mục: {editingItem.item_code}
            </h3>
            <form onSubmit={handleEditPriceItem} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Tên khoản mục</label>
                <input
                  type="text"
                  required
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div className="responsive-form-row-2-1">
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Đơn giá (VNĐ)</label>
                  <input
                    type="number"
                    required
                    value={editItemPrice}
                    onChange={(e) => setEditItemPrice(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Đơn vị tính</label>
                  <input
                    type="text"
                    required
                    value={editItemUnit}
                    onChange={(e) => setEditItemUnit(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Mã dịch vụ gắn kết (Scope)</label>
                <select
                  value={editItemService}
                  onChange={(e) => setEditItemService(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                >
                  <option value="BURIAL">BURIAL (An táng)</option>
                  <option value="CONSTRUCTION">CONSTRUCTION (Thi công)</option>
                  <option value="EXHUMATION">EXHUMATION (Cải táng)</option>
                  <option value="CREMATION">CREMATION (Hỏa táng)</option>
                  <option value="LAND_PURCHASE">LAND_PURCHASE (Bán đất)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setActiveModal(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#F1F5F9', fontSize: '13px' }}>Hủy</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--brand-primary)', color: '#FFFFFF', fontWeight: 600, fontSize: '13px' }}>Lưu Thay Đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Care Package */}
      {activeModal === 'new_package' && (
        <div className="responsive-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="responsive-modal-card" style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', maxWidth: '500px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Thêm Gói Chăm Sóc Định Kỳ Mới</h3>
            <form onSubmit={handleCreatePackage} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Mã gói dịch vụ</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: GOI-CS-DIP-LE"
                  value={newPkgCode}
                  onChange={(e) => setNewPkgCode(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Tên gói dịch vụ</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Gói Chăm Sóc Dịp Lễ Tết"
                  value={newPkgName}
                  onChange={(e) => setNewPkgName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div className="responsive-form-row">
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Chu kỳ chăm sóc</label>
                  <select
                    value={newPkgCycle}
                    onChange={(e) => setNewPkgCycle(e.target.value as 'MONTHLY' | 'QUARTERLY' | 'YEARLY')}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  >
                    <option value="MONTHLY">MONTHLY (Hàng tháng)</option>
                    <option value="QUARTERLY">QUARTERLY (Theo quý)</option>
                    <option value="YEARLY">YEARLY (Hàng năm)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Đơn giá (VNĐ)</label>
                  <input
                    type="number"
                    required
                    placeholder="800000"
                    value={newPkgPrice}
                    onChange={(e) => setNewPkgPrice(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
                  Danh sách công việc (ngăn cách bằng dấu phẩy)
                </label>
                <textarea
                  rows={3}
                  value={newPkgTasks}
                  onChange={(e) => setNewPkgTasks(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setActiveModal(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#F1F5F9', fontSize: '13px' }}>Hủy</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--brand-primary)', color: '#FFFFFF', fontWeight: 600, fontSize: '13px' }}>Lưu Gói Dịch Vụ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Care Package */}
      {activeModal === 'edit_package' && editingPkg && (
        <div className="responsive-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="responsive-modal-card" style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', maxWidth: '500px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
              Chỉnh Sửa Gói Chăm Sóc: {editingPkg.package_code}
            </h3>
            <form onSubmit={handleEditPackage} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Tên gói dịch vụ</label>
                <input
                  type="text"
                  required
                  value={editPkgName}
                  onChange={(e) => setEditPkgName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div className="responsive-form-row">
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Chu kỳ chăm sóc</label>
                  <select
                    value={editPkgCycle}
                    onChange={(e) => setEditPkgCycle(e.target.value as 'MONTHLY' | 'QUARTERLY' | 'YEARLY')}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  >
                    <option value="MONTHLY">MONTHLY (Hàng tháng)</option>
                    <option value="QUARTERLY">QUARTERLY (Theo quý)</option>
                    <option value="YEARLY">YEARLY (Hàng năm)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Đơn giá (VNĐ)</label>
                  <input
                    type="number"
                    required
                    value={editPkgPrice}
                    onChange={(e) => setEditPkgPrice(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
                  Danh sách công việc (ngăn cách bằng dấu phẩy)
                </label>
                <textarea
                  rows={4}
                  value={editPkgTasks}
                  onChange={(e) => setEditPkgTasks(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="edit_pkg_active"
                  checked={editPkgActive}
                  onChange={(e) => setEditPkgActive(e.target.checked)}
                />
                <label htmlFor="edit_pkg_active" style={{ fontSize: '13px', cursor: 'pointer' }}>Đang kích hoạt gói (is_active)</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setActiveModal(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#F1F5F9', fontSize: '13px' }}>Hủy</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--brand-primary)', color: '#FFFFFF', fontWeight: 600, fontSize: '13px' }}>Lưu Thay Đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
