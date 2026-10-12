/** OBS stores colors as little-endian ABGR integers: 0xAABBGGRR. */
export function hexToObsColor(hex: string, alpha = 255): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return 0
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  // `>>> 0` keeps the result an unsigned 32-bit integer.
  return ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0
}

export function obsColorToHex(color: number): string {
  const r = color & 0xff
  const g = (color >> 8) & 0xff
  const b = (color >> 16) & 0xff
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}
