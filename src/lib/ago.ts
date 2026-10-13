/** "never", "just now", "12s ago", "3 min ago": a rough, re-evaluated-on-render age for a timestamp. */
export function agoLabel(at: number | null, now = Date.now()): string {
  if (!at) return 'never'
  const s = Math.max(0, Math.round((now - at) / 1000))
  return s < 2 ? 'just now' : s < 90 ? `${s}s ago` : `${Math.round(s / 60)} min ago`
}
