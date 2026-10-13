import { useEffect, useState } from 'react'
import type { TargetAndTransition } from 'framer-motion'
import type { TransitionKind } from './textEngine'

/** Which line is showing. With one line (or the rotator off) it stays at 0. */
export function useRotatorIndex(count: number, enabled: boolean, intervalMs: number, random: boolean): number {
  const [index, setIndex] = useState(0)
  const rotating = enabled && count > 1
  // Derived, so a shrinking list or a switched-off rotator can't leave the index out of range.
  const current = rotating ? Math.min(index, count - 1) : 0

  useEffect(() => {
    if (!rotating) return
    const timer = setTimeout(() => {
      setIndex(() => {
        if (!random) return (current + 1) % count
        let next = Math.floor(Math.random() * (count - 1))
        if (next >= current) next += 1 // never repeat the current line
        return next
      })
    }, intervalMs)
    return () => clearTimeout(timer)
  }, [current, rotating, count, intervalMs, random])

  return current
}

export const transitionVariants: Record<TransitionKind, { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition }> = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  'slide-up': {
    initial: { opacity: 0, y: 40 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -40 },
  },
  'slide-left': {
    initial: { opacity: 0, x: 80 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -80 },
  },
  scale: { initial: { opacity: 0, scale: 0.7 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.25 } },
  blur: {
    initial: { opacity: 0, filter: 'blur(14px)' },
    animate: { opacity: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, filter: 'blur(14px)' },
  },
}

