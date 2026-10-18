import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Plot } from '../../types/plots'
import { coordinates } from './plotCoordinates'

const colors: Record<string, string> = { EMPTY_UNSOLD: '#43836d', RESERVED: '#b58522', OWNED_EMPTY: '#537e9c', UNDER_CONSTRUCTION: '#827292', OCCUPIED: '#24594d', UNDER_EXHUMATION: '#986957' }
const labels: Record<string, string> = { EMPTY_UNSOLD: 'Chưa sử dụng', RESERVED: 'Đang giữ chỗ', OWNED_EMPTY: 'Có chủ, chưa an táng', UNDER_CONSTRUCTION: 'Đang thi công', OCCUPIED: 'Đã an táng', UNDER_EXHUMATION: 'Đang cải táng' }

export function GeographicPlotMap({ plots, onSelect, focusId }: { plots: Plot[]; onSelect?: (id: number) => void; focusId?: number | null }) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef<L.LayerGroup | null>(null)
  const tilesRef = useRef<L.TileLayer | null>(null)
  const [streetBackground, setStreetBackground] = useState(true)
  const callback = useRef(onSelect)
  useEffect(() => { callback.current = onSelect }, [onSelect])
  const fittedPlots = useRef('')
  const [tileError, setTileError] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const located = plots.filter(p => coordinates(p))
  const fit = useCallback((initial = false) => {
    const demo = plots.filter(p => p.is_synthetic && p.plot_code.startsWith('DEMO-'))
    const points = (initial && demo.length > 1 ? demo : plots).map(coordinates).filter((p): p is [number, number] => p !== null)
    if (points.length) mapRef.current?.fitBounds(points, { padding: [32, 32], maxZoom: 20, animate: false })
  }, [plots])
  useEffect(() => {
    if (!container.current) return
    const map = L.map(container.current, { center: [10.9252, 106.8252], zoom: 18, maxZoom: 22, minZoom: 2, scrollWheelZoom: false })
    mapRef.current = map
    class SimpleGrid extends L.GridLayer {
      createTile() {
        const tile = document.createElement('div')
        tile.className = 'gis-grid-tile'
        return tile
      }
    }
    new SimpleGrid({ maxZoom: 22 }).addTo(map)
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxNativeZoom: 19, maxZoom: 22, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map)
    tilesRef.current = tiles
    tiles.on('tileerror', () => { setTileError(true); setStreetBackground(false); if (map.hasLayer(tiles)) map.removeLayer(tiles) })
    layersRef.current = L.layerGroup().addTo(map)
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }))
    observer.observe(container.current)
    requestAnimationFrame(() => map.invalidateSize({ animate: false }))
    setMapReady(true)
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; layersRef.current = null; fittedPlots.current = '' }
  }, [])
  useEffect(() => {
    const map = mapRef.current, tiles = tilesRef.current
    if (!map || !tiles) return
    if (streetBackground && !map.hasLayer(tiles)) tiles.addTo(map)
    else if (!streetBackground && map.hasLayer(tiles)) map.removeLayer(tiles)
  }, [streetBackground, mapReady])
  useEffect(() => {
    const map = mapRef.current, layer = layersRef.current
    if (!map || !layer) return
    const render = () => {
      layer.clearLayers()
      const grouped = new Map<string, Plot[]>()
      for (const plot of plots) {
        const point = coordinates(plot)
        if (!point) continue
        const key = point.join(',')
        grouped.set(key, [...(grouped.get(key) || []), plot])
      }
      for (const group of grouped.values()) {
        const plot = group[0], point = coordinates(plot)!
        const selected = group.some(p => p.plot_id === focusId)
        const color = selected ? '#ad6d12' : colors[plot.status] || '#63756f'
        const marker = map.getZoom() >= 19 && group.length === 1
          ? L.rectangle([[point[0] - (Number(plot.plot_length) || 2.5) / 222640, point[1] - (Number(plot.plot_width) || 1.2) / (222640 * Math.cos(point[0] * Math.PI / 180))], [point[0] + (Number(plot.plot_length) || 2.5) / 222640, point[1] + (Number(plot.plot_width) || 1.2) / (222640 * Math.cos(point[0] * Math.PI / 180))]], { color, weight: 2, fillOpacity: .8 })
          : L.circleMarker(point, { radius: group.length > 1 ? 10 : Math.max(1.5, Math.min(5, 3 * 2 ** (map.getZoom() - 17))), color: '#fff', weight: 1, fillColor: color, fillOpacity: .95 })
        const tooltip = document.createElement('span')
        tooltip.textContent = group.length > 1 ? `${group.length} ô cùng vị trí` : `${plot.plot_code} · ${labels[plot.status] || 'Chưa cập nhật'}`
        marker.bindTooltip(tooltip, { permanent: selected, direction: 'top' })
        if (group.length === 1) marker.on('click', () => callback.current?.(plot.plot_id))
        else {
          const content = document.createElement('div')
          content.className = 'map-overlap-list'
          for (const item of group) {
            const button = document.createElement('button')
            button.type = 'button'; button.textContent = item.plot_code
            button.onclick = () => { callback.current?.(item.plot_id); map.closePopup() }
            content.appendChild(button)
          }
          marker.bindPopup(content)
        }
        marker.addTo(layer)
      }
    }
    render()
    map.on('zoomend', render)
    const signature = plots.map(p => p.plot_id).join(',')
    if (fittedPlots.current !== signature && plots.some(p => coordinates(p))) {
      fittedPlots.current = signature
      requestAnimationFrame(() => {
        if (mapRef.current !== map) return
        map.invalidateSize({ animate: false })
        const selected = plots.find(p => p.plot_id === focusId), point = selected && coordinates(selected)
        if (point) map.setView(point, 20, { animate: false })
        else fit(true)
      })
    }
    return () => { map.off('zoomend', render) }
  }, [plots, mapReady, fit, focusId])
  useEffect(() => {
    const p = plots.find(p => p.plot_id === focusId), point = p && coordinates(p)
    if (point) mapRef.current?.setView(point, 20, { animate: false })
  }, [focusId, plots, mapReady])
  return <section className="gis-map-shell" aria-label="Bản đồ vị trí ô mộ">
    <div className="gis-map-toolbar"><span>{located.length} / {plots.length} ô có vị trí</span><div className="gis-map-actions"><button type="button" aria-pressed={!streetBackground} onClick={() => { setTileError(false); setStreetBackground(!streetBackground) }}>{streetBackground ? 'Nền đơn giản' : 'Nền đường phố'}</button><button type="button" onClick={() => fit()}>Xem tất cả</button></div></div>
    <div ref={container} className="gis-map-canvas" />
    {tileError && <div className="map-notice" role="status">Nền đường phố chưa tải được. Đang dùng nền đơn giản. <button type="button" onClick={() => { setTileError(false); setStreetBackground(true) }}>Thử lại</button></div>}
    {plots.some(p => p.is_synthetic) && <p className="map-notice">Có vị trí mô phỏng dùng cho thực hành.</p>}
    {!located.length && <p className="map-notice">Chưa có vị trí cho các ô đang chọn.</p>}
    <div className="map-legend">{focusId && <span><i style={{ background: '#ad6d12' }} />Ô đang chọn</span>}{Object.entries(labels).filter(([status]) => plots.some(p => p.status === status)).map(([status, text]) => <span key={status}><i style={{ background: colors[status] }} />{text}</span>)}</div>
  </section>
}
