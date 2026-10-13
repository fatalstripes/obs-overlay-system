/**
 * Settings and wire format for the Socials & Media rotator overlay (`#/overlay/socials`).
 *
 * Same idea as the text engine: the dashboard edits `SocialsSettings`, broadcasts them with obs-websocket's
 * `BroadcastCustomEvent`, and the overlay (a Browser Source that is itself an obs-websocket client) receives them as a
 * `CustomEvent`. Anything arriving over the socket is untrusted and goes through `sanitizeSocials` first.
 */
import { TRANSITIONS, type Align, type RotatorOrder, type TransitionKind } from './textEngine.ts'

export type SocialPlatform = { key: string; label: string; /** simple-icons slug, '' for none */ slug: string; brand: string }

/** Known platforms. Icons come from the simple-icons CDN by slug; `custom` has no icon unless one is given. */
export const PLATFORMS: SocialPlatform[] = [
  { key: 'twitch', label: 'Twitch', slug: 'twitch', brand: '#9146ff' },
  { key: 'youtube', label: 'YouTube', slug: 'youtube', brand: '#ff0000' },
  { key: 'kick', label: 'Kick', slug: 'kick', brand: '#53fc18' },
  { key: 'x', label: 'X', slug: 'x', brand: '#ffffff' },
  { key: 'instagram', label: 'Instagram', slug: 'instagram', brand: '#e4405f' },
  { key: 'tiktok', label: 'TikTok', slug: 'tiktok', brand: '#ff0050' },
  { key: 'discord', label: 'Discord', slug: 'discord', brand: '#5865f2' },
  { key: 'facebook', label: 'Facebook', slug: 'facebook', brand: '#1877f2' },
  { key: 'bluesky', label: 'Bluesky', slug: 'bluesky', brand: '#1185fe' },
  { key: 'threads', label: 'Threads', slug: 'threads', brand: '#ffffff' },
  { key: 'reddit', label: 'Reddit', slug: 'reddit', brand: '#ff4500' },
  { key: 'github', label: 'GitHub', slug: 'github', brand: '#ffffff' },
  { key: 'patreon', label: 'Patreon', slug: 'patreon', brand: '#ff424d' },
  { key: 'spotify', label: 'Spotify', slug: 'spotify', brand: '#1db954' },
  { key: 'snapchat', label: 'Snapchat', slug: 'snapchat', brand: '#fffc00' },
  { key: 'linkedin', label: 'LinkedIn', slug: 'linkedin', brand: '#0a66c2' },
  { key: 'custom', label: 'Custom', slug: '', brand: '#ffffff' },
]

export const platformInfo = (key: string): SocialPlatform => PLATFORMS.find((p) => p.key === key) ?? PLATFORMS[PLATFORMS.length - 1]

export type SocialItem = {
  /** Stable identity (React key, add/remove). */
  id: string
  platform: string
  /** The handle or text to show, e.g. "@fatalstripes". */
  handle: string
  /** Optional name shown next to the handle (defaults to the platform's name when the style asks for labels). */
  label: string
  /**
   * Optional icon override: an https image URL, a small `data:image/...;base64` image, or a short glyph/emoji.
   * Empty means the platform's own icon.
   */
  icon: string
}

export type IconColor = 'brand' | 'text'

export type SocialsSettings = {
  items: SocialItem[]
  style: {
    fontFamily: string
    fontWeight: number
    fontSize: number
    color: string
    strokeWidth: number
    strokeColor: string
    iconSize: number
    /** Space between icon and text. */
    gap: number
    align: Align
    iconColor: IconColor
    showLabel: boolean
  }
  rotator: {
    /** Off: every item is shown at once, stacked. */
    enabled: boolean
    intervalMs: number
    transition: TransitionKind
    transitionMs: number
    order: RotatorOrder
  }
}

export const DEFAULT_SOCIALS: SocialsSettings = {
  items: [
    { id: 'default-twitch', platform: 'twitch', handle: 'yourchannel', label: '', icon: '' },
    { id: 'default-x', platform: 'x', handle: '@yourhandle', label: '', icon: '' },
  ],
  style: {
    fontFamily: 'Montserrat',
    fontWeight: 700,
    fontSize: 56,
    color: '#ffffff',
    strokeWidth: 3,
    strokeColor: '#000000',
    iconSize: 64,
    gap: 20,
    align: 'center',
    iconColor: 'brand',
    showLabel: false,
  },
  rotator: { enabled: true, intervalMs: 4000, transition: 'slide-up', transitionMs: 500, order: 'sequential' },
}

export const MAX_ITEMS = 30
export const MAX_HANDLE_LENGTH = 80
export const MAX_LABEL_LENGTH = 40
export const MAX_ICON_LENGTH = 200_000
const MAX_GLYPH_LENGTH = 4

const clamp = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback

const color = (v: unknown, fallback: string): string =>
  typeof v === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v) ? v.toLowerCase() : fallback

const FONT_FAMILY = /^[A-Za-z0-9][A-Za-z0-9 -]{0,59}$/
const ID = /^[\w-]{1,40}$/
const DATA_IMAGE = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/

const text = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/[\r\n\t]/g, ' ').slice(0, max) : ''

/** '' (use the platform icon), an https URL, a small data: image, or a short glyph; anything else becomes ''. */
export function sanitizeIcon(v: unknown): string {
  if (typeof v !== 'string') return ''
  const s = v.trim()
  if (!s || s.length > MAX_ICON_LENGTH) return ''
  if (/^https:\/\//i.test(s)) {
    try {
      return new URL(s).href
    } catch {
      return ''
    }
  }
  if (DATA_IMAGE.test(s)) return s
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return '' // any other scheme (javascript:, http:, file:, ...)
  return [...s].length <= MAX_GLYPH_LENGTH ? s : ''
}

/** What an icon string means: an image to load, or a glyph to print. */
export const iconKind = (icon: string): 'image' | 'glyph' | 'none' =>
  !icon ? 'none' : /^(https:\/\/|data:image\/)/i.test(icon) ? 'image' : 'glyph'

/** The simple-icons CDN URL for a platform, tinted with `hex` (a #rrggbb color); `null` for platforms without one. */
export function platformIconUrl(platform: string, hex: string): string | null {
  const { slug } = platformInfo(platform)
  return slug ? `https://cdn.simpleicons.org/${slug}/${hex.replace('#', '').slice(0, 6)}` : null
}

let counter = 0
/** A fresh id for a new item. */
export const newItemId = (): string => `s${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function sanitizeItem(input: unknown, fallbackId: string): SocialItem {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const platform = typeof o.platform === 'string' && PLATFORMS.some((p) => p.key === o.platform) ? o.platform : 'custom'
  return {
    id: typeof o.id === 'string' && ID.test(o.id) ? o.id : fallbackId,
    platform,
    handle: text(o.handle, MAX_HANDLE_LENGTH),
    label: text(o.label, MAX_LABEL_LENGTH),
    icon: sanitizeIcon(o.icon),
  }
}

export function sanitizeSocials(input: unknown): SocialsSettings {
  const d = DEFAULT_SOCIALS
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const st = (o.style && typeof o.style === 'object' ? o.style : {}) as Record<string, unknown>
  const r = (o.rotator && typeof o.rotator === 'object' ? o.rotator : {}) as Record<string, unknown>

  const seen = new Set<string>()
  const items = Array.isArray(o.items)
    ? o.items.slice(0, MAX_ITEMS).map((raw, i) => {
        const item = sanitizeItem(raw, `item-${i}`)
        // Ids must be unique (they are React keys and identify items in edits); a duplicate gets a derived id.
        let id = item.id
        for (let n = 1; seen.has(id); n++) id = `${item.id}-${n}`.slice(-40)
        seen.add(id)
        return { ...item, id }
      })
    : d.items

  return {
    items,
    style: {
      fontFamily: typeof st.fontFamily === 'string' && FONT_FAMILY.test(st.fontFamily.trim()) ? st.fontFamily.trim() : d.style.fontFamily,
      fontWeight: Math.round(clamp(st.fontWeight, 100, 900, d.style.fontWeight) / 100) * 100,
      fontSize: clamp(st.fontSize, 8, 400, d.style.fontSize),
      color: color(st.color, d.style.color),
      strokeWidth: clamp(st.strokeWidth, 0, 40, d.style.strokeWidth),
      strokeColor: color(st.strokeColor, d.style.strokeColor),
      iconSize: clamp(st.iconSize, 8, 400, d.style.iconSize),
      gap: clamp(st.gap, 0, 200, d.style.gap),
      align: oneOf(st.align, ['left', 'center', 'right'], d.style.align),
      iconColor: oneOf(st.iconColor, ['brand', 'text'], d.style.iconColor),
      showLabel: typeof st.showLabel === 'boolean' ? st.showLabel : d.style.showLabel,
    },
    rotator: {
      enabled: typeof r.enabled === 'boolean' ? r.enabled : d.rotator.enabled,
      intervalMs: clamp(r.intervalMs, 500, 600_000, d.rotator.intervalMs),
      transition: oneOf(r.transition, TRANSITIONS.map((t) => t.value), d.rotator.transition),
      transitionMs: clamp(r.transitionMs, 0, 5000, d.rotator.transitionMs),
      order: oneOf(r.order, ['sequential', 'random'], d.rotator.order),
    },
  }
}

export const isDefaultSocials = (s: SocialsSettings): boolean =>
  JSON.stringify(sanitizeSocials(s)) === JSON.stringify(DEFAULT_SOCIALS)

// ---- bridge messages ---------------------------------------------------------------------------------------------

/** Namespaces our messages among other CustomEvents (including the text engine's) on the same OBS. */
export const SOCIALS_CHANNEL = 'obs-overlay-system/socials'

export type SocialsMessage =
  | { channel: typeof SOCIALS_CHANNEL; v: 1; from: 'dashboard'; type: 'settings'; settings: SocialsSettings }
  | { channel: typeof SOCIALS_CHANNEL; v: 1; from: 'overlay'; type: 'request' }
  | { channel: typeof SOCIALS_CHANNEL; v: 1; from: 'overlay'; type: 'ack'; at: number }

export const socialsSettingsMessage = (settings: SocialsSettings): SocialsMessage => ({
  channel: SOCIALS_CHANNEL, v: 1, from: 'dashboard', type: 'settings', settings,
})
export const socialsRequestMessage = (): SocialsMessage => ({ channel: SOCIALS_CHANNEL, v: 1, from: 'overlay', type: 'request' })
export const socialsAckMessage = (at: number): SocialsMessage => ({ channel: SOCIALS_CHANNEL, v: 1, from: 'overlay', type: 'ack', at })

/** Validates anything received from the socket; `null` if it isn't one of ours. Settings are sanitized. */
export function parseSocialsMessage(data: unknown): SocialsMessage | null {
  if (!data || typeof data !== 'object') return null
  const m = data as Record<string, unknown>
  if (m.channel !== SOCIALS_CHANNEL || m.v !== 1) return null
  if (m.type === 'settings' && m.from === 'dashboard') return socialsSettingsMessage(sanitizeSocials(m.settings))
  if (m.type === 'request' && m.from === 'overlay') return socialsRequestMessage()
  if (m.type === 'ack' && m.from === 'overlay' && typeof m.at === 'number' && Number.isFinite(m.at)) return socialsAckMessage(m.at)
  return null
}

// ---- overlay URL -------------------------------------------------------------------------------------------------

export const SOCIALS_HASH = '#/overlay/socials'

/** The Browser Source URL for the socials overlay. */
export function buildSocialsUrl(pageUrl: string, obsUrl: string, password: string): string {
  const base = pageUrl.split('#')[0]
  const params = new URLSearchParams({ ws: obsUrl })
  if (password) params.set('pw', password)
  return `${base}${SOCIALS_HASH}?${params.toString()}`
}

export type SocialsRoute = { ws: string; password: string; debug: boolean } | null

/** Parses `#/overlay/socials?ws=...&pw=...&debug=1`; `null` when the hash isn't the socials route. */
export function parseSocialsRoute(hash: string): SocialsRoute {
  const [path, query = ''] = hash.split('?')
  if (path !== SOCIALS_HASH) return null
  const p = new URLSearchParams(query)
  return { ws: p.get('ws') || 'ws://localhost:4455', password: p.get('pw') ?? '', debug: p.get('debug') === '1' }
}
