import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SETTINGS, MAX_LINES, sanitizeSettings, type TextEngineSettings } from '../lib/textEngine.ts'

type TextEngineState = {
  settings: TextEngineSettings
  /** When the overlay last confirmed it applied settings (ms since epoch), or null if never seen this session. */
  lastAckAt: number | null
  /** When the dashboard last broadcast settings. */
  lastSentAt: number | null
  /**
   * Counts edits made by the user in the panel (not settings loaded from a preset). Edits made while a scene with a
   * bound preset is live are saved into that preset, and this is what tells those apart from programmatic changes.
   */
  editSeq: number
  /** Save edits into the live scene's bound preset, so each scene keeps its own overlay settings. */
  autoSaveToScene: boolean

  /** Replaces all settings (validated), e.g. when a preset is applied. Not counted as a user edit. */
  setSettings: (settings: TextEngineSettings) => void
  setAutoSaveToScene: (on: boolean) => void
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
    (set) => {
      /** A change made by the user: applies `fn` to the settings and counts it as an edit. */
      const edit = (fn: (s: TextEngineSettings) => TextEngineSettings) =>
        set((st) => {
          const next = fn(st.settings)
          return next === st.settings ? st : { settings: next, editSeq: st.editSeq + 1 }
        })

      return {
        settings: DEFAULT_SETTINGS,
        lastAckAt: null,
        lastSentAt: null,
        editSeq: 0,
        autoSaveToScene: true,

        setSettings: (settings) => set({ settings: sanitizeSettings(settings) }),
        setAutoSaveToScene: (autoSaveToScene) => set({ autoSaveToScene }),
        update: (patch) => edit((s) => ({ ...s, ...patch })),
        updateGradient: (patch) => edit((s) => ({ ...s, gradient: { ...s.gradient, ...patch } })),
        updateRotator: (patch) => edit((s) => ({ ...s, rotator: { ...s.rotator, ...patch } })),

        setLine: (index, text) => edit((s) => ({ ...s, lines: s.lines.map((l, i) => (i === index ? text : l)) })),
        addLine: () => edit((s) => (s.lines.length >= MAX_LINES ? s : { ...s, lines: [...s.lines, ''] })),
        removeLine: (index) => edit((s) => ({ ...s, lines: s.lines.filter((_, i) => i !== index) })),
        moveLine: (index, delta) =>
          edit((s) => {
            const to = index + delta
            if (to < 0 || to >= s.lines.length) return s
            const lines = [...s.lines]
            ;[lines[index], lines[to]] = [lines[to], lines[index]]
            return { ...s, lines }
          }),
        reset: () => edit(() => DEFAULT_SETTINGS),
      }
    },
    {
      name: 'obs-overlay-textengine',
      partialize: (s) => ({ settings: s.settings, autoSaveToScene: s.autoSaveToScene }),
      // Whatever is in storage goes through the same validation as data from the socket.
      merge: (persisted, current) => ({
        ...current,
        settings: sanitizeSettings((persisted as { settings?: unknown } | undefined)?.settings ?? current.settings),
        autoSaveToScene: (persisted as { autoSaveToScene?: unknown } | undefined)?.autoSaveToScene !== false,
      }),
    },
  ),
)
