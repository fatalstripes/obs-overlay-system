/**
 * Settings and wire format for the custom text engine (the "ProText"-style overlay).
 *
 * The dashboard edits a `TextEngineSettings`, broadcasts it with obs-websocket's `BroadcastCustomEvent`, and the
 * overlay (an OBS Browser Source that is itself an obs-websocket client) receives it as a `CustomEvent`. Anything
 * arriving over the socket is untrusted, so it goes through `sanitizeSettings` before it is rendered.
 */

export type Align = 'left' | 'center' | 'right'
export type FillMode = 'solid' | 'gradient'
export type TransitionKind = 'fade' | 'slide-up' | 'slide-left' | 'scale' | 'blur'
export type RotatorOrder = 'sequential' | 'random'

export type TextEngineSettings = {
  /** A Google Fonts family name, e.g. "Bebas Neue". */
  fontFamily: string
  fontWeight: number
  italic: boolean
  fontSize: number
  letterSpacing: number
  align: Align
  fillMode: FillMode
  color: string
  gradient: { from: string; to: string; angle: number }
  strokeWidth: number
  strokeColor: string
  /** The text. With the rotator on they are shown one at a time; off, they are stacked. */
  lines: string[]
  rotator: {
    enabled: boolean
    /** How long each line stays up, in milliseconds (not counting the transition). */
    intervalMs: number
    transition: TransitionKind
    transitionMs: number
    order: RotatorOrder
  }
}

export const DEFAULT_SETTINGS: TextEngineSettings = {
  fontFamily: 'Montserrat',
  fontWeight: 700,
  italic: false,
  fontSize: 96,
  letterSpacing: 0,
  align: 'center',
  fillMode: 'solid',
  color: '#ffffff',
  gradient: { from: '#22d3ee', to: '#8b5cf6', angle: 90 },
  strokeWidth: 4,
  strokeColor: '#000000',
  lines: ['Hello, stream!'],
  rotator: { enabled: false, intervalMs: 3000, transition: 'slide-up', transitionMs: 500, order: 'sequential' },
}

/** A starter list for the font picker; any other Google Fonts family can be typed in. */
export const POPULAR_FONTS = [
  'Anton', 'Audiowide', 'Bangers', 'Bebas Neue', 'Inter', 'Lato', 'Lobster', 'Montserrat', 'Open Sans', 'Orbitron',
  'Oswald', 'Pacifico', 'Permanent Marker', 'Playfair Display', 'Poppins', 'Press Start 2P', 'Rajdhani', 'Raleway',
  'Righteous', 'Roboto', 'Russo One', 'Teko',
]

export const TRANSITIONS: { value: TransitionKind; label: string }[] = [
  { value: 'fade', label: 'Fade' },
  { value: 'slide-up', label: 'Slide up' },
  { value: 'slide-left', label: 'Slide left' },
  { value: 'scale', label: 'Scale' },
  { value: 'blur', label: 'Blur' },
]

/** True when `s` is exactly the factory defaults (used to decide whether a preset should bother carrying them). */
export const isDefaultSettings = (s: TextEngineSettings): boolean =>
  JSON.stringify(sanitizeSettings(s)) === JSON.stringify(DEFAULT_SETTINGS)

export const MAX_LINES = 50
export const MAX_LINE_LENGTH = 200

const clamp = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback

const color = (v: unknown, fallback: string): string =>
  typeof v === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v) ? v.toLowerCase() : fallback

const FONT_FAMILY = /^[A-Za-z0-9][A-Za-z0-9 -]{0,59}$/

/** True for names that are safe to put in a Google Fonts URL and a CSS font stack. */
export const isFontFamily = (v: unknown): v is string => typeof v === 'string' && FONT_FAMILY.test(v.trim())

export function sanitizeSettings(input: unknown): TextEngineSettings {
  const d = DEFAULT_SETTINGS
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const g = (o.gradient && typeof o.gradient === 'object' ? o.gradient : {}) as Record<string, unknown>
  const r = (o.rotator && typeof o.rotator === 'object' ? o.rotator : {}) as Record<string, unknown>

  const lines = Array.isArray(o.lines)
    ? o.lines
        .filter((l): l is string => typeof l === 'string')
        .slice(0, MAX_LINES)
        .map((l) => l.replace(/\r/g, '').slice(0, MAX_LINE_LENGTH))
    : d.lines

  return {
    fontFamily: isFontFamily(o.fontFamily) ? o.fontFamily.trim() : d.fontFamily,
    fontWeight: Math.round(clamp(o.fontWeight, 100, 900, d.fontWeight) / 100) * 100,
    italic: typeof o.italic === 'boolean' ? o.italic : d.italic,
    fontSize: clamp(o.fontSize, 8, 600, d.fontSize),
    letterSpacing: clamp(o.letterSpacing, -20, 100, d.letterSpacing),
    align: oneOf(o.align, ['left', 'center', 'right'], d.align),
    fillMode: oneOf(o.fillMode, ['solid', 'gradient'], d.fillMode),
    color: color(o.color, d.color),
    gradient: {
      from: color(g.from, d.gradient.from),
      to: color(g.to, d.gradient.to),
      angle: clamp(g.angle, 0, 360, d.gradient.angle),
    },
    strokeWidth: clamp(o.strokeWidth, 0, 60, d.strokeWidth),
    strokeColor: color(o.strokeColor, d.strokeColor),
    lines,
    rotator: {
      enabled: typeof r.enabled === 'boolean' ? r.enabled : d.rotator.enabled,
      intervalMs: clamp(r.intervalMs, 300, 600_000, d.rotator.intervalMs),
      transition: oneOf(r.transition, TRANSITIONS.map((t) => t.value), d.rotator.transition),
      transitionMs: clamp(r.transitionMs, 0, 5000, d.rotator.transitionMs),
      order: oneOf(r.order, ['sequential', 'random'], d.rotator.order),
    },
  }
}

/** `https://fonts.googleapis.com/css2?...` for a family. With `plain`, no weight/italic axes are requested. */
export function googleFontsUrl(family: string, weight: number, italic: boolean, plain = false): string {
  const name = family.trim().replace(/ +/g, '+')
  const axes = plain ? '' : `:ital,wght@${italic ? 1 : 0},${weight}`
  return `https://fonts.googleapis.com/css2?family=${name}${axes}&display=swap`
}

// ---- bridge messages ---------------------------------------------------------------------------------------------

/** Namespaces our messages among any other CustomEvents on the same OBS. */
export const CHANNEL = 'obs-overlay-system/text-engine'

export type BridgeMessage =
  | { channel: typeof CHANNEL; v: 1; from: 'dashboard'; type: 'settings'; settings: TextEngineSettings }
  | { channel: typeof CHANNEL; v: 1; from: 'overlay'; type: 'request' }
  | { channel: typeof CHANNEL; v: 1; from: 'overlay'; type: 'ack'; at: number }

export const settingsMessage = (settings: TextEngineSettings): BridgeMessage => ({
  channel: CHANNEL, v: 1, from: 'dashboard', type: 'settings', settings,
})
export const requestMessage = (): BridgeMessage => ({ channel: CHANNEL, v: 1, from: 'overlay', type: 'request' })
export const ackMessage = (at: number): BridgeMessage => ({ channel: CHANNEL, v: 1, from: 'overlay', type: 'ack', at })

/** Validates anything received from the socket; `null` if it isn't one of ours. Settings are sanitized. */
export function parseBridgeMessage(data: unknown): BridgeMessage | null {
  if (!data || typeof data !== 'object') return null
  const m = data as Record<string, unknown>
  if (m.channel !== CHANNEL || m.v !== 1) return null
  if (m.type === 'settings' && m.from === 'dashboard') return settingsMessage(sanitizeSettings(m.settings))
  if (m.type === 'request' && m.from === 'overlay') return requestMessage()
  if (m.type === 'ack' && m.from === 'overlay' && typeof m.at === 'number' && Number.isFinite(m.at)) return ackMessage(m.at)
  return null
}

// ---- overlay URL -------------------------------------------------------------------------------------------------

export const OVERLAY_HASH = '#/overlay/text'

/** The Browser Source URL: this same page, with a hash route and the obs-websocket address to listen on. */
export function buildOverlayUrl(pageUrl: string, obsUrl: string, password: string): string {
  const base = pageUrl.split('#')[0]
  const params = new URLSearchParams({ ws: obsUrl })
  if (password) params.set('pw', password)
  return `${base}${OVERLAY_HASH}?${params.toString()}`
}

export type OverlayRoute = { ws: string; password: string; debug: boolean } | null

/** Parses `#/overlay/text?ws=...&pw=...&debug=1`; `null` when the hash isn't the overlay route. */
export function parseOverlayRoute(hash: string): OverlayRoute {
  const [path, query = ''] = hash.split('?')
  if (path !== OVERLAY_HASH) return null
  const p = new URLSearchParams(query)
  return { ws: p.get('ws') || 'ws://localhost:4455', password: p.get('pw') ?? '', debug: p.get('debug') === '1' }
}
