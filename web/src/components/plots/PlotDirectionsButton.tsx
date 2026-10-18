import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, X, Navigation, Compass, Map as MapIcon, CornerDownRight } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { apiFetch, responseError } from '../../services/apiClient'
import type { Plot, PlotDetail } from '../../types/plots'
import { GeographicPlotMap } from './GeographicPlotMap'
import { coordinates } from './plotCoordinates'

export function PlotDirectionsButton({ plotId, plotCode }: { plotId?: number | null; plotCode?: string | null }) {
  const { accessToken, hasPermission } = useAuth()
  const [open, setOpen] = useState(false)
  const [plot, setPlot] = useState<PlotDetail | null>(null)
  const [nearby, setNearby] = useState<Plot[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null), closeButton = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLElement>(null)
  const close = () => { setOpen(false); trigger.current?.focus() }
  const load = async () => {
    setLoading(true); setError(''); setPlot(null); setNearby([])
    try {
      const res = await apiFetch(`/api/v1/plots/${plotId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (!res.ok) throw new Error(await responseError(res, 'Chưa tải được vị trí ô mộ.'))
      const detail: PlotDetail = await res.json()
      setPlot(detail)
      const zonePlots: Plot[] = []
      for (let skip = 0; ; skip += 500) {
        const response = await apiFetch(`/api/v1/plots?zone_id=${detail.zone_id}&limit=500&skip=${skip}`, { headers: { Authorization: `Bearer ${accessToken}` } })
        if (!response.ok) break
        const batch: Plot[] = await response.json()
        zonePlots.push(...batch)
        if (batch.length < 500) break
      }
      setNearby(zonePlots)
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa tải được vị trí ô mộ.') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    if (!open) return
    closeButton.current?.focus()
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); close() }
      if (e.key === 'Tab') {
        const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]') || []).filter(el => el.getClientRects().length)
        const first = items[0], last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('keydown', onKey, true); document.body.style.overflow = oldOverflow }
  }, [open])
  if (!plotId || !hasPermission('plots:read')) return null
  const point = plot && coordinates(plot)
  const isSynthetic = plot?.is_synthetic || plot?.notes?.includes('[SYNTHETIC_GIS')

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="plot-directions-button"
        onClick={e => { e.stopPropagation(); setOpen(true); void load() }}
        aria-label={`Xem vị trí và dẫn đường tới ô mộ ${plotCode || ''}`}
        title="Xem vị trí & dẫn đường tới ô mộ"
      >
        <Navigation size={13} style={{ transform: 'rotate(45deg)' }} />
        <span>Vị trí</span>
      </button>

      {open && createPortal(
        <div
          className="responsive-modal-overlay plot-location-overlay"
          onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) close() }}
        >
          <section
            ref={dialog}
            className="plot-location-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Vị trí và dẫn đường tới ô mộ ${plotCode || ''}`}
            style={{ maxWidth: '780px', borderRadius: '16px', overflow: 'hidden' }}
          >
            <header className="basis-header" style={{ borderBottom: '1px solid #E2E8F0', padding: '16px 20px', borderRadius: 0 }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={20} color="#24594D" />
                  Vị trí & Dẫn đường tới Ô mộ {plotCode || ''}
                </h2>
                {plot && (
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>
                    Khu vực: <strong>{plot.zone_name}</strong> · Hàng: <strong>{plot.row_code}</strong> · Mã ô: <strong>{plot.plot_code}</strong>
                  </p>
                )}
              </div>
              <button
                ref={closeButton}
                type="button"
                onClick={close}
                aria-label="Đóng vị trí"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '6px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: '#64748B',
                }}
              >
                <X size={20} />
              </button>
            </header>

            <div style={{ padding: '16px 20px', maxHeight: 'calc(85vh - 80px)', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748B' }}>
                  <p role="status">Đang tải dữ liệu vị trí và bản đồ ô mộ…</p>
                </div>
              ) : error ? (
                <div style={{ padding: '24px', backgroundColor: '#FEF2F2', borderRadius: '10px', color: '#B91C1C' }}>
                  <p role="alert" style={{ margin: '0 0 12px' }}>{error}</p>
                  <button
                    type="button"
                    onClick={load}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      backgroundColor: '#DC2626',
                      color: '#FFF',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Thử lại
                  </button>
                </div>
              ) : plot && point ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Action Banner for Directions */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '14px 18px',
                      backgroundColor: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      borderRadius: '12px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Compass size={18} color="#15803D" />
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#166534' }}>
                          Dẫn đường trực tiếp tới ô mộ
                        </span>
                        {isSynthetic && (
                          <span style={{ fontSize: '11px', backgroundColor: '#DCFCE7', color: '#166534', padding: '2px 6px', borderRadius: '4px' }}>
                            Mô phỏng GIS
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#15803D', marginTop: '3px' }}>
                        Tọa độ: {point[0].toFixed(6)}, {point[1].toFixed(6)}
                      </div>
                    </div>

                    <a
                      className="plot-nav-primary-btn"
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${point[0]},${point[1]}&travelmode=walking`}
                      style={{
                        backgroundColor: '#166534',
                        color: '#FFFFFF',
                        border: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 18px',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '13.5px',
                        textDecoration: 'none',
                        boxShadow: '0 2px 4px rgba(22, 101, 52, 0.25)',
                        width: 'auto',
                      }}
                    >
                      <Navigation size={16} />
                      Mở Dẫn Đường Google Maps (Đi bộ)
                    </a>
                  </div>

                  {/* Internal Walking Route Guidance */}
                  <div
                    style={{
                      padding: '12px 16px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      fontSize: '13px',
                      color: '#334155',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CornerDownRight size={15} color="#24594D" />
                      Lộ trình di chuyển nội khu hoa viên:
                    </div>
                    <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
                      <li>Từ <strong>Cổng chính Nghĩa trang</strong>, di chuyển theo trục đường nội bộ tới <strong>Khu {plot.zone_name}</strong>.</li>
                      <li>Tiếp tục rẽ vào <strong>Hàng {plot.row_code}</strong>.</li>
                      <li>Xác định bia mộ mang mã số <strong>{plot.plot_code}</strong> trên sơ đồ bên dưới.</li>
                    </ol>
                  </div>

                  {/* Interactive Map */}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapIcon size={15} /> Sơ đồ vị trí trên bản đồ phân khu:
                    </div>
                    <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #CBD5E1' }}>
                      <GeographicPlotMap plots={nearby.length ? nearby : [plot]} focusId={plot.plot_id} />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: '#64748B' }}>
                  <MapPin size={36} color="#94A3B8" style={{ marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontWeight: 500 }}>Ô mộ này chưa được đồng bộ tọa độ GPS.</p>
                  <p style={{ margin: '6px 0 0', fontSize: '13px' }}>
                    Vui lòng tra cứu theo phân khu <strong>{plot?.zone_name || 'N/A'}</strong> và hàng <strong>{plot?.row_code || 'N/A'}</strong>.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>,
        document.body
      )}
    </>
  )
}

