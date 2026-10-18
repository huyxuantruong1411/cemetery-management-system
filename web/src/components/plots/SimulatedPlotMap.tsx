import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import {
  Search,
  Footprints,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Info,
} from 'lucide-react'

export interface SimulatedPlot {
  code: string
  zone: string
  row: number
  col: number
  x: number
  y: number
  status: 'empty' | 'owned' | 'occupied' | 'reserved' | 'construction'
}

const STATUS_COLORS: Record<SimulatedPlot['status'], string> = {
  empty: '#f5f8f1',
  owned: '#7f9db0',
  occupied: '#386858',
  reserved: '#d2ad57',
  construction: '#9589ae',
}

const STATUS_NAMES: Record<SimulatedPlot['status'], string> = {
  empty: 'Chưa sử dụng',
  owned: 'Có chủ, chưa an táng',
  occupied: 'Đã an táng',
  reserved: 'Đang giữ chỗ',
  construction: 'Đang thi công',
}

const pad = (n: number) => String(n).padStart(2, '0')

// Generate 384 deterministic simulated plots
function generateSimulatedPlots(): SimulatedPlot[] {
  const result: SimulatedPlot[] = []
  for (let b = 0; b < 6; b++) {
    const z = String.fromCharCode(65 + b)
    const bx = 8 + (b % 3) * 73
    const by = 12 + Math.floor(b / 3) * 74

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const x = bx + 4 + c * 6.1 + (c >= 4 ? 3.2 : 0)
        const y = by + 9 + r * 5.6 + (r >= 4 ? 1.2 : 0)
        const n = b * 64 + r * 8 + c
        const t = (n * 13 + 7) % 20
        const status: SimulatedPlot['status'] =
          t < 9 ? 'occupied' : t < 13 ? 'empty' : t < 16 ? 'owned' : t < 18 ? 'reserved' : 'construction'

        result.push({
          code: `DEMO-${z}-H${pad(r + 1)}-${pad(c + 1)}`,
          zone: z,
          row: r + 1,
          col: c + 1,
          x,
          y,
          status,
        })
      }
    }
  }
  return result
}

export const SimulatedPlotMap: React.FC = () => {
  const allPlots = useMemo(() => generateSimulatedPlots(), [])

  // Filter states
  const [query, setQuery] = useState<string>('')
  const [zoneFilter, setZoneFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // Map viewport states [x, y, w, h]
  const [viewBox, setViewBox] = useState<[number, number, number, number]>([0, 0, 222, 184])
  const [selectedPlot, setSelectedPlot] = useState<SimulatedPlot | null>(null)

  // Drag interaction
  const svgRef = useRef<SVGSVGElement | null>(null)
  const isDragging = useRef<boolean>(false)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ x: number; y: number; view: [number, number, number, number] }>({
    x: 0,
    y: 0,
    view: [0, 0, 222, 184],
  })

  // Filtered plots
  const filteredPlots = useMemo(() => {
    const q = query.trim().toUpperCase()
    return allPlots.filter((p) => {
      if (q && !p.code.includes(q)) return false
      if (zoneFilter && p.zone !== zoneFilter) return false
      if (statusFilter && p.status !== statusFilter) return false
      return true
    })
  }, [allPlots, query, zoneFilter, statusFilter])

  const filteredSet = useMemo(() => new Set(filteredPlots.map((p) => p.code)), [filteredPlots])

  // Zoom handlers
  const handleZoom = useCallback((factor: number) => {
    setViewBox(([vx, vy, vw, vh]) => {
      const nextW = Math.max(26, Math.min(222, vw * factor))
      const nextH = (nextW * 184) / 222
      return [vx + (vw - nextW) / 2, vy + (vh - nextH) / 2, nextW, nextH]
    })
  }, [])

  const handleReset = useCallback(() => {
    setViewBox([0, 0, 222, 184])
  }, [])

  const handleSelectPlot = useCallback((p: SimulatedPlot) => {
    setSelectedPlot(p)
  }, [])

  const handleFocusPlot = useCallback((p: SimulatedPlot) => {
    const targetW = 38
    const targetH = (targetW * 184) / 222
    setViewBox([p.x - 17, p.y - 14, targetW, targetH])
  }, [])

  // Mouse wheel zoom
  useEffect(() => {
    const svg = svgRef.current
    const onWheel = (e: WheelEvent) => { e.preventDefault(); handleZoom(e.deltaY > 0 ? 1.15 : 0.87) }
    svg?.addEventListener('wheel', onWheel, { passive: false })
    return () => svg?.removeEventListener('wheel', onWheel)
  }, [handleZoom])

  // Pointer drag
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    isDragging.current = true
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      view: [...viewBox],
    }
    // Capture only after a drag threshold; a tap must reach the plot.
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging.current || !svgRef.current) return
    const distance = Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y)
    if (distance < 5) return
    setDragging(true)
    svgRef.current.setPointerCapture(e.pointerId)
    const rect = svgRef.current.getBoundingClientRect()
    const scale = Math.max(dragStart.current.view[2] / rect.width, dragStart.current.view[3] / rect.height)
    const dx = (e.clientX - dragStart.current.x) * scale
    const dy = (e.clientY - dragStart.current.y) * scale
    setViewBox([
      dragStart.current.view[0] - dx,
      dragStart.current.view[1] - dy,
      dragStart.current.view[2],
      dragStart.current.view[3],
    ])
  }

  const handlePointerUp = () => {
    isDragging.current = false
    setDragging(false)
  }

  // Walking route path
  const routePath = useMemo(() => {
    if (!selectedPlot) return ''
    const p = selectedPlot
    const routeX = p.x < 74 ? 74.5 : p.x < 147 ? 147.5 : 147.5
    const routeY = p.y + 4.8
    return `M111 179V155H${routeX}V${routeY}H${p.x + 2.1}V${p.y + 3.8}`
  }, [selectedPlot])

  const isZoomedIn = viewBox[2] < 90

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Simulation Banner Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 18px',
          backgroundColor: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              padding: '4px 10px',
              backgroundColor: '#FEF3C7',
              border: '1px solid #F59E0B',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#92400E',
              letterSpacing: '0.5px',
            }}
          >
            DỮ LIỆU MÔ PHỎNG
          </span>
          <span style={{ fontSize: '13px', color: '#78350F' }}>
            6 khu, 48 hàng và 384 ô minh họa.
          </span>
        </div>
        <div style={{ fontSize: '12px', color: '#92400E', fontWeight: 600 }}>
          Sơ đồ minh họa, không phải vị trí thực.
        </div>
      </div>

      {/* Toolbar Filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          backgroundColor: '#FFFFFF',
          padding: '14px 18px',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
          <Search
            size={15}
            color="#94A3B8"
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Tìm theo mã ô mô phỏng (ví dụ: DEMO-B-H03-05)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #CBD5E1',
            fontSize: '13px',
            backgroundColor: '#FFFFFF',
            color: '#334155',
          }}
        >
          <option value="">Tất cả phân khu (6 Khu)</option>
          <option value="A">Phân khu A</option>
          <option value="B">Phân khu B</option>
          <option value="C">Phân khu C</option>
          <option value="D">Phân khu D</option>
          <option value="E">Phân khu E</option>
          <option value="F">Phân khu F</option>
        </select>

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
          <option value="">Tất cả trạng thái</option>
          <option value="empty">Chưa sử dụng</option>
          <option value="owned">Có chủ, chưa an táng</option>
          <option value="occupied">Đã an táng</option>
          <option value="reserved">Đang giữ chỗ</option>
          <option value="construction">Đang thi công</option>
        </select>

        <div style={{ marginLeft: 'auto', fontSize: '13px', fontWeight: 600, color: 'var(--brand-primary, #24594D)' }}>
          {filteredPlots.length} / 384 ô mô phỏng
        </div>
      </div>

      {/* Main Layout: SVG Map Card + Side Detail Panel */}
      <div className="simulated-map-layout">
        {/* SVG Map Card */}
        <div
          style={{
            position: 'relative',
            backgroundColor: '#edf1e7',
            border: '1px solid #CCD9D1',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          {/* Zoom controls */}
          <div
            style={{
              position: 'absolute',
              top: '14px',
              left: '14px',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <button
              type="button"
              onClick={() => handleZoom(0.75)}
              title="Phóng to"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#1E293B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <ZoomIn size={18} />
            </button>
            <button
              type="button"
              onClick={() => handleZoom(1.33)}
              title="Thu nhỏ"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#1E293B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <ZoomOut size={18} />
            </button>
            <button
              type="button"
              onClick={handleReset}
              title="Xem toàn cảnh"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#1E293B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <Maximize2 size={16} />
            </button>
          </div>

          {/* Top Label */}
          <div className="simulated-map-hint"
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              zIndex: 10,
              backgroundColor: 'rgba(255, 255, 255, 0.92)',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '11px',
              color: '#475569',
              backdropFilter: 'blur(4px)',
            }}
          >
            Kéo để di chuyển · Cuộn để phóng to
          </div>

          {/* Interactive SVG */}
          <svg
            ref={svgRef}
            viewBox={viewBox.join(' ')}
            style={{
              width: '100%',
              height: 'clamp(400px, 65vh, 620px)',
              display: 'block',
              cursor: dragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              touchAction: 'none',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <defs>
              <pattern id="sim-grass" width="5" height="5" patternUnits="userSpaceOnUse">
                <path d="M1 2l.5-.8M3.5 4l.4-.6" stroke="#cddac6" strokeWidth="0.18" />
              </pattern>
            </defs>

            {/* Base Park Landscape */}
            <rect width="222" height="184" fill="#edf1e7" />
            <rect x="3" y="3" width="216" height="178" rx="4" fill="url(#sim-grass)" stroke="#8ca58b" strokeWidth="0.6" />

            {/* Main Asphalt & Walking Roads */}
            <path
              d="M4 78H218M74.5 5V155M147.5 5V155M4 155H218M111 155V181"
              stroke="#d6d5ca"
              strokeWidth="8"
              fill="none"
            />
            <path
              d="M4 78H218M74.5 5V155M147.5 5V155M4 155H218M111 155V181"
              stroke="#f9f7ee"
              strokeWidth="6"
              fill="none"
            />

            {/* Facility Buildings */}
            <g fill="#e2e9dd" stroke="#849781" strokeWidth="0.25">
              <rect x="12" y="164" width="53" height="12" rx="2" />
              <rect x="89" y="165" width="14" height="10" rx="1" />
              <rect x="119" y="165" width="14" height="10" rx="1" />
              <rect x="157" y="163" width="47" height="14" rx="4" />
            </g>
            <g fill="#52694f" fontSize="2.4" textAnchor="middle" fontWeight="600">
              <text x="38.5" y="171">BÃI ĐỖ XE</text>
              <text x="96" y="171">TIẾP ĐÓN</text>
              <text x="126" y="171">NHÀ CHỜ</text>
              <text x="180.5" y="171">VƯỜN TƯỞNG NIỆM</text>
              <text x="111" y="180" fontWeight="700">CỔNG CHÍNH</text>
            </g>

            {/* North Compass Indicator */}
            <path d="M207 11v8m-2-5 2-4 2 4" stroke="#536e5b" fill="none" strokeWidth="0.5" />
            <text x="207" y="9" textAnchor="middle" fill="#536e5b" fontSize="2.5" fontWeight="700">
              BẮC SƠ ĐỒ
            </text>

            {/* Zone Blocks & Plots */}
            {allPlots.map((p) => {
              const isSelected = selectedPlot?.code === p.code
              const isMuted = !filteredSet.has(p.code)
              const fillColor = STATUS_COLORS[p.status]

              return (
                <g key={p.code}>
                  <rect
                    x={p.x}
                    y={p.y}
                    width={4.2}
                    height={3.8}
                    rx={0.35}
                    fill={fillColor}
                    stroke={isSelected ? '#b89338' : '#6d8b77'}
                    strokeWidth={isSelected ? 0.9 : 0.22}
                    opacity={isMuted ? 0.12 : 1}
                    style={{
                      cursor: 'pointer',
                      transition: 'opacity 0.15s, stroke-width 0.15s',
                    }}
                    onClick={() => handleSelectPlot(p)}
                    role="button" tabIndex={0} aria-label={`Chọn ô ${p.code}`}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectPlot(p) } }}
                  >
                    <title>{`${p.code} · ${STATUS_NAMES[p.status]}`}</title>
                  </rect>
                  <path
                    d={`M${p.x + 0.7} ${p.y + 0.8}h2.8`}
                    stroke={p.status === 'empty' ? '#95b39c' : 'rgba(255,255,255,0.4)'}
                    strokeWidth="0.4"
                    pointerEvents="none"
                    opacity={isMuted ? 0.12 : 1}
                  />
                  {isZoomedIn && (
                    <text
                      x={p.x + 2.1}
                      y={p.y + 2.7}
                      fontSize="1.8"
                      fill={p.status === 'empty' ? '#42664c' : '#FFFFFF'}
                      textAnchor="middle"
                      pointerEvents="none"
                    >
                      {pad(p.col)}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Zone Labels */}
            {['A', 'B', 'C', 'D', 'E', 'F'].map((z, b) => {
              const bx = 8 + (b % 3) * 73
              const by = 12 + Math.floor(b / 3) * 74
              return (
                <g key={z} pointerEvents="none">
                  <text
                    x={bx + 4}
                    y={by + 6.5}
                    fill="var(--brand-primary, #24594D)"
                    fontSize="3.2"
                    fontWeight="700"
                  >
                    KHU {z}
                  </text>
                  <path
                    d={`M${bx + 30} ${by + 8}V${by + 56}`}
                    stroke="#dfddd1"
                    strokeWidth="2.4"
                  />
                </g>
              )
            })}

            {/* Walking Path Line from Main Gate */}
            {routePath && (
              <path
                d={routePath}
                fill="none"
                stroke="#b68b2c"
                strokeWidth="1.1"
                strokeDasharray="2 1.3"
                pointerEvents="none"
              />
            )}
          </svg>

          {/* Footer Coordinates Note */}
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '14px',
              right: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#4e6359',
              pointerEvents: 'none',
            }}
          >
            <span style={{ backgroundColor: 'rgba(255, 255, 255, 0.88)', padding: '4px 8px', borderRadius: '4px' }}>
              Tọa độ cục bộ nội khu · Kích thước giả lập theo mét
            </span>
            <span style={{ backgroundColor: 'rgba(255, 255, 255, 0.88)', padding: '4px 8px', borderRadius: '4px' }}>
              Không dùng để dẫn đường ngoài thực tế
            </span>
          </div>
        </div>

        {/* Right Detail Panel */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748B', fontWeight: 600 }}>
              Thông Tin Ô Mộ Mô Phỏng
            </div>
            {selectedPlot ? (
              <div style={{ marginTop: '8px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--brand-primary, #24594D)', margin: 0 }}>
                  {selectedPlot.code}
                </h3>
                <div style={{ marginTop: '6px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: `${STATUS_COLORS[selectedPlot.status]}33`,
                      color: selectedPlot.status === 'empty' ? '#166534' : '#1E293B',
                      border: `1px solid ${STATUS_COLORS[selectedPlot.status]}`,
                    }}
                  >
                    {STATUS_NAMES[selectedPlot.status]}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '8px', color: '#64748B', fontSize: '13px' }}>
                Chọn một ô trên sơ đồ hoặc danh sách bên dưới để xem chi tiết và đường đi nội bộ.
              </div>
            )}
          </div>

          {selectedPlot && (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  backgroundColor: '#F8FAFC',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  fontSize: '12px',
                }}
              >
                <div>
                  <div style={{ color: '#64748B' }}>Phân khu</div>
                  <div style={{ fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>Khu {selectedPlot.zone}</div>
                </div>
                <div>
                  <div style={{ color: '#64748B' }}>Hàng mộ</div>
                  <div style={{ fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>Hàng {pad(selectedPlot.row)}</div>
                </div>
                <div>
                  <div style={{ color: '#64748B' }}>Số thứ tự ô</div>
                  <div style={{ fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>Ô {pad(selectedPlot.col)}</div>
                </div>
                <div>
                  <div style={{ color: '#64748B' }}>Tọa độ cục bộ</div>
                  <div style={{ fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                    x={selectedPlot.x.toFixed(1)}m, y={selectedPlot.y.toFixed(1)}m
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleFocusPlot(selectedPlot)}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: 'var(--brand-primary, #24594D)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Footprints size={15} />
                  <span>Phóng Tới Ô & Tuyến Đi Bộ</span>
                </button>

                {/* Disallow Google Maps external link for demo simulated plots */}
                <div
                  style={{
                    padding: '8px 10px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#991B1B',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Info size={14} style={{ flexShrink: 0 }} />
                  <span>Dẫn đường Google Maps bị tắt cho ô mô phỏng để tránh tọa độ thực tế sai lệch.</span>
                </div>
              </div>
            </>
          )}

          {/* Color Legend */}
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748B', fontWeight: 600, marginBottom: '8px' }}>
              Chú Giải Trạng Thái
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
              {(Object.keys(STATUS_COLORS) as SimulatedPlot['status'][]).map((st) => (
                <div key={st} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '3px',
                      backgroundColor: STATUS_COLORS[st],
                      border: '1px solid #668D7B',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ color: '#334155' }}>{STATUS_NAMES[st]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Filtered Plots Quick List */}
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748B', fontWeight: 600, marginBottom: '8px' }}>
              Danh Sách Khớp Bộ Lọc ({filteredPlots.length})
            </div>
            <div
              style={{
                maxHeight: '200px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {filteredPlots.slice(0, 30).map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => handleSelectPlot(p)}
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    backgroundColor: selectedPlot?.code === p.code ? '#F0FDF4' : '#FFFFFF',
                    color: selectedPlot?.code === p.code ? '#166534' : '#334155',
                    fontSize: '12px',
                    fontWeight: selectedPlot?.code === p.code ? 700 : 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>{p.code}</span>
                  <span style={{ fontSize: '10px', color: '#64748B' }}>{STATUS_NAMES[p.status]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
