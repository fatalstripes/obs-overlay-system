import { useEffect } from 'react'
import { googleFontsUrl } from './textEngine'

/**
 * Injects the Google Fonts stylesheet for a family and resolves once the face is usable. If the exact weight/italic
 * axes are not offered for the family (the API answers 400), it falls back to the family's default styles.
 */
export function useGoogleFont(family: string, weight: number, italic: boolean) {
  useEffect(() => {
    let cancelled = false
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.dataset.textEngineFont = family
    let triedPlain = false
    link.onerror = () => {
      if (cancelled || triedPlain) return
      triedPlain = true
      link.href = googleFontsUrl(family, weight, italic, true)
    }
    link.onload = () => {
      // Fetch the face now so the text doesn't swap fonts mid-animation.
      void document.fonts.load(`${italic ? 'italic ' : ''}${weight} 1em "${family}"`).catch(() => {})
    }
    link.href = googleFontsUrl(family, weight, italic)
    document.head.appendChild(link)
    return () => {
      cancelled = true
      link.remove()
    }
  }, [family, weight, italic])
}
