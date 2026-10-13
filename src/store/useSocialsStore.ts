import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_SOCIALS, MAX_ITEMS, newItemId, sanitizeItem, sanitizeSocials,
  type SocialItem, type SocialsSettings,
} from '../lib/socials.ts'

type SocialsState = {
  settings: SocialsSettings
  /** When the overlay last confirmed it applied settings (ms since epoch), or null if never seen this session. */
  lastAckAt: number | null
  /** When the dashboard last broadcast settings. */
  lastSentAt: number | null

  /** Replaces all settings (validated). */
  setSettings: (settings: SocialsSettings) => void
  updateStyle: (patch: Partial<SocialsSettings['style']>) => void
  updateRotator: (patch: Partial<SocialsSettings['rotator']>) => void

  /** Adds an item for `platform` (default: custom) and returns its id, or null at the cap. */
  addItem: (platform?: string) => string | null
  updateItem: (id: string, patch: Partial<Omit<SocialItem, 'id'>>) => void
  removeItem: (id: string) => void
  moveItem: (id: string, delta: -1 | 1) => void
  reset: () => void
}

export const useSocialsStore = create<SocialsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SOCIALS,
      lastAckAt: null,
      lastSentAt: null,

      setSettings: (settings) => set({ settings: sanitizeSocials(settings) }),
      updateStyle: (patch) => set((st) => ({ settings: sanitizeSocials({ ...st.settings, style: { ...st.settings.style, ...patch } }) })),
      updateRotator: (patch) => set((st) => ({ settings: sanitizeSocials({ ...st.settings, rotator: { ...st.settings.rotator, ...patch } }) })),

      addItem: (platform = 'custom') => {
        const { settings } = get()
        if (settings.items.length >= MAX_ITEMS) return null
        const item = sanitizeItem({ id: newItemId(), platform, handle: '', label: '', icon: '' }, newItemId())
        set({ settings: { ...settings, items: [...settings.items, item] } })
        return item.id
      },
      updateItem: (id, patch) =>
        set((st) => ({
          settings: sanitizeSocials({
            ...st.settings,
            items: st.settings.items.map((i) => (i.id === id ? { ...i, ...patch, id } : i)),
          }),
        })),
      removeItem: (id) => set((st) => ({ settings: { ...st.settings, items: st.settings.items.filter((i) => i.id !== id) } })),
      moveItem: (id, delta) =>
        set((st) => {
          const from = st.settings.items.findIndex((i) => i.id === id)
          const to = from + delta
          if (from < 0 || to < 0 || to >= st.settings.items.length) return st
          const items = [...st.settings.items]
          ;[items[from], items[to]] = [items[to], items[from]]
          return { settings: { ...st.settings, items } }
        }),
      reset: () => set({ settings: DEFAULT_SOCIALS }),
    }),
    {
      name: 'obs-overlay-socials',
      partialize: (s) => ({ settings: s.settings }),
      // Whatever is in storage goes through the same validation as data from the socket.
      merge: (persisted, current) => ({
        ...current,
        settings: sanitizeSocials((persisted as { settings?: unknown } | undefined)?.settings ?? current.settings),
      }),
    },
  ),
)
