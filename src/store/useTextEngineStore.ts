import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SETTINGS, MAX_LINES, sanitizeSettings, type TextEngineSettings } from '../lib/textEngine'

type TextEngineState = {
  settings: TextEngineSettings
  /** When the overlay last confirmed it applied settings (ms since epoch), or null if never seen this session. */
  lastAckAt: number | null
  /** When the dashboard last broadcast settings. */
  lastSentAt: number | null

  /** Replaces all settings (validated), e.g. when a preset is applied. */
  setSettings: (settings: TextEngineSettings) => void
  update: (patch: Partial<TextEngineSettings>) => void
  updateGradient: (patch: Partial<TextEngineSettings['gradient']>) => void
  updateRotator: (patch: Partial<TextEngineSettings['rotator']>) => void

  setLine: (index: number, text: string) => void
  addLine: () => void
  removeLine: (index: number) => void
  moveLine: (index: number, delta: -1 | 1) => void
  reset: () => void
}

export const useTextEngineStore = create<TextEngineState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      lastAckAt: null,
      lastSentAt: null,

      setSettings: (settings) => set({ settings: sanitizeSettings(settings) }),
      update: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      updateGradient: (patch) => set((s) => ({ settings: { ...s.settings, gradient: { ...s.settings.gradient, ...patch } } })),
      updateRotator: (patch) => set((s) => ({ settings: { ...s.settings, rotator: { ...s.settings.rotator, ...patch } } })),

      setLine: (index, text) =>
        set((s) => ({ settings: { ...s.settings, lines: s.settings.lines.map((l, i) => (i === index ? text : l)) } })),
      addLine: () =>
        set((s) =>
          s.settings.lines.length >= MAX_LINES ? s : { settings: { ...s.settings, lines: [...s.settings.lines, ''] } },
        ),
      removeLine: (index) =>
        set((s) => ({ settings: { ...s.settings, lines: s.settings.lines.filter((_, i) => i !== index) } })),
      moveLine: (index, delta) =>
        set((s) => {
          const to = index + delta
          if (to < 0 || to >= s.settings.lines.length) return s
          const lines = [...s.settings.lines]
          ;[lines[index], lines[to]] = [lines[to], lines[index]]
          return { settings: { ...s.settings, lines } }
        }),
      reset: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'obs-overlay-textengine',
      partialize: (s) => ({ settings: s.settings }),
      // Whatever is in storage goes through the same validation as data from the socket.
      merge: (persisted, current) => ({
        ...current,
        settings: sanitizeSettings((persisted as { settings?: unknown } | undefined)?.settings ?? current.settings),
      }),
    },
  ),
)
