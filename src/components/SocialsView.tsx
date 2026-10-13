import { AnimatePresence, motion } from 'framer-motion'
import { useState, type CSSProperties } from 'react'
import { transitionVariants, useRotatorIndex } from '../lib/rotator'
import { iconKind, platformIconUrl, platformInfo, type SocialItem, type SocialsSettings } from '../lib/socials'
import { useGoogleFont } from '../lib/useGoogleFont'

/** The item's icon: its own image/glyph, else the platform's logo (tinted), else the platform's first letter. */
function Icon({ item, s }: { item: SocialItem; s: SocialsSettings['style'] }) {
  const [failed, setFailed] = useState<string | null>(null)
  const info = platformInfo(item.platform)
  const tint = s.iconColor === 'brand' ? info.brand : s.color
  const size = s.iconSize
  const kind = iconKind(item.icon)
  const url = kind === 'image' ? item.icon : kind === 'none' ? platformIconUrl(item.platform, tint) : null

  const box: CSSProperties = { width: size, height: size, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }

  if (url && failed !== url) {
    return <img src={url} alt="" style={{ ...box, objectFit: 'contain' }} onError={() => setFailed(url)} />
  }
  // A glyph, or the fallback when an image can't load (offline, blocked): a plain badge so the row never looks broken.
  const glyph = kind === 'glyph' ? item.icon : (info.label[0] ?? '•')
  return (
    <span
      aria-hidden
      style={{
        ...box,
        fontSize: size * (kind === 'glyph' ? 0.8 : 0.55),
        fontWeight: 700,
        lineHeight: 1,
        color: kind === 'glyph' ? s.color : '#000',
        background: kind === 'glyph' ? 'transparent' : tint,
        borderRadius: size / 4,
      }}
    >
      {glyph}
    </span>
  )
}

function Row({ item, s }: { item: SocialItem; s: SocialsSettings['style'] }) {
  const text: CSSProperties = {
    fontFamily: `"${s.fontFamily}", system-ui, sans-serif`,
    fontWeight: s.fontWeight,
    fontSize: s.fontSize,
    lineHeight: 1.15,
    color: s.color,
    margin: 0,
    whiteSpace: 'pre',
    // Stroke drawn first at twice the width, so only the outer half shows around the fill.
    WebkitTextStroke: s.strokeWidth > 0 ? `${s.strokeWidth * 2}px ${s.strokeColor}` : undefined,
    paintOrder: 'stroke fill',
  }
  const label = item.label || platformInfo(item.platform).label
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: s.gap }}>
      <Icon key={`${item.platform}|${item.icon}|${s.iconColor}`} item={item} s={s} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {s.showLabel && <p style={{ ...text, fontSize: s.fontSize * 0.5, fontWeight: 500, opacity: 0.85 }}>{label}</p>}
        <p style={text}>{item.handle}</p>
      </div>
    </div>
  )
}

/** Renders `settings`: the rotator (or the stacked list) of social handles. Shared by the overlay and the dashboard preview. */
export function SocialsView({ settings: { items, style: s, rotator: r } }: { settings: SocialsSettings }) {
  useGoogleFont(s.fontFamily, s.fontWeight, false)
  // Items without a handle have nothing to show yet (a row that was just added in the dashboard).
  const shown = items.filter((i) => i.handle.trim())
  const rotating = r.enabled && shown.length > 1
  const index = useRotatorIndex(shown.length, r.enabled, r.intervalMs, r.order === 'random')
  const justify = s.align === 'left' ? 'flex-start' : s.align === 'right' ? 'flex-end' : 'center'
  const v = transitionVariants[r.transition]

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: justify }}>
      {shown.length === 0 ? null : rotating ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={shown[index].id}
            initial={v.initial}
            animate={v.animate}
            exit={v.exit}
            transition={{ duration: r.transitionMs / 1000, ease: 'easeInOut' }}
          >
            <Row item={shown[index]} s={s} />
          </motion.div>
        </AnimatePresence>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: s.gap, alignItems: justify }}>
          {(r.enabled ? shown.slice(0, 1) : shown).map((i) => (
            <Row key={i.id} item={i} s={s} />
          ))}
        </div>
      )}
    </div>
  )
}
