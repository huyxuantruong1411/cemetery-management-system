import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, X } from 'lucide-react'
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
  const demo = plot?.is_synthetic || plot?.notes?.includes('[SYNTHETIC_GIS')
  return <>
    <button ref={trigger} type="button" className="plot-directions-button" onClick={e => { e.stopPropagation(); setOpen(true); void load() }} aria-label={`Xem vị trí ô mộ ${plotCode || ''}`}><MapPin size={16} />Vị trí ô mộ</button>
    {open && createPortal(<div className="responsive-modal-overlay plot-location-overlay" onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) close() }}>
      <section ref={dialog} className="plot-location-dialog" role="dialog" aria-modal="true" aria-label={`Vị trí ${plotCode || 'ô mộ'}`}>
        <header className="basis-header"><h2>{plotCode || 'Vị trí ô mộ'}</h2><button ref={closeButton} type="button" onClick={close} aria-label="Đóng vị trí"><X size={20} /></button></header>
        {loading ? <p role="status">Đang tải vị trí…</p> : error ? <p role="alert">{error} <button type="button" onClick={load}>Thử lại</button></p> : plot && point ? <>
          <p>{plot.zone_name} · {plot.row_code}</p>
          <GeographicPlotMap plots={nearby.length ? nearby : [plot]} focusId={plot.plot_id} />
          {!demo && <a className="plot-directions-button" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${point[0]},${point[1]}&travelmode=walking`}>Dẫn đường bằng Google Maps</a>}
        </> : <p>Ô mộ này chưa có tọa độ. Vui lòng tra theo khu và hàng.</p>}
      </section>
    </div>, document.body)}
  </>
}
