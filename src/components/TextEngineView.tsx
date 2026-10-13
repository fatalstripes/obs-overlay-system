import { AnimatePresence, motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { transitionVariants as variants, useRotatorIndex } from '../lib/rotator'
import { useGoogleFont } from '../lib/useGoogleFont'
import type { TextEngineSettings } from '../lib/textEngine'

/**
 * The text itself: a stroke layer underneath and a fill layer on top in the same grid cell. Stroking a separate
 * layer at twice the width and covering its inner half with the fill gives a true *outside* stroke that also works
 * with a gradient fill (which uses background-clip: text).
 */
function TextLayers({ text, s }: { text: string; s: TextEngineSettings }) {
  const base: CSSProperties = {
    gridArea: '1 / 1',
    fontFamily: `"${s.fontFamily}", system-ui, sans-serif`,
    fontWeight: s.fontWeight,
    fontStyle: s.italic ? 'italic' : 'normal',
    fontSize: s.fontSize,
    letterSpacing: s.letterSpacing,
    lineHeight: 1.15,
    textAlign: s.align,
    whiteSpace: 'pre-wrap',
    margin: 0,
  }
  const fill: CSSProperties =
    s.fillMode === 'gradient'
      ? {
          backgroundImage: `linear-gradient(${s.gradient.angle}deg, ${s.gradient.from}, ${s.gradient.to})`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          color: 'transparent',
        }
      : { color: s.color }

  return (
    // inline-grid keeps the box as wide as the text, so a gradient spans the text rather than the whole overlay.
    <div style={{ display: 'inline-grid' }}>
      {s.strokeWidth > 0 && (
        <p
          aria-hidden
          style={{
            ...base,
            color: s.strokeColor,
            WebkitTextStroke: `${s.strokeWidth * 2}px ${s.strokeColor}`,
            paintOrder: 'stroke fill',
          }}
        >
          {text}
        </p>
      )}
      <p style={{ ...base, ...fill }}>{text}</p>
    </div>
  )
}

/** Renders `settings`: Google font, stroke, gradient and the rotator. Shared by the overlay and the dashboard preview. */
export function TextEngineView({ settings: s }: { settings: TextEngineSettings }) {
  useGoogleFont(s.fontFamily, s.fontWeight, s.italic)
  const rotating = s.rotator.enabled && s.lines.length > 1
  const index = useRotatorIndex(s.lines.length, s.rotator.enabled, s.rotator.intervalMs, s.rotator.order === 'random')

  const justify = s.align === 'left' ? 'flex-start' : s.align === 'right' ? 'flex-end' : 'center'
  const v = variants[s.rotator.transition]
  const seconds = s.rotator.transitionMs / 1000

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: justify }}>
      {s.lines.length === 0 ? null : rotating ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            initial={v.initial}
            animate={v.animate}
            exit={v.exit}
            transition={{ duration: seconds, ease: 'easeInOut' }}
          >
            <TextLayers text={s.lines[index]} s={s} />
          </motion.div>
        </AnimatePresence>
      ) : (
        <TextLayers text={s.rotator.enabled ? s.lines[0] : s.lines.join('\n')} s={s} />
      )}
    </div>
  )
}
