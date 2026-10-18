import type { Plot } from '../../types/plots'

export function coordinates(plot: Pick<Plot, 'latitude' | 'longitude'>): [number, number] | null {
  if (plot.latitude == null || plot.longitude == null) return null
  const lat = Number(plot.latitude), lng = Number(plot.longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null
}
