import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isMediaKind, MAX_RECENT, normalizePath, pushRecent } from '../lib/media.ts'

export type MediaInputInfo = { name: string; kind: string }

type MediaState = {
  /** The Image/Media sources found in OBS (loaded, not saved). */
  inputs: MediaInputInfo[]
  /** The source being edited. */
  selected: string
  /** The file OBS currently has on the selected source. */
  currentPath: string | null
  /** The path typed into the field. */
  draft: string
  /** Recently used files per source, newest first. */
  recents: Record<string, string[]>
  /** Restart a Media source after swapping, so the new file plays from the start. */
  restart: boolean
  /** Result of the last swap, shown under the form. */
  message: { kind: 'ok' | 'error'; text: string } | null
  busy: boolean

  setInputs: (inputs: MediaInputInfo[]) => void
  select: (name: string) => void
  setCurrentPath: (path: string | null) => void
  setDraft: (draft: string) => void
  setRestart: (on: boolean) => void
  setMessage: (message: MediaState['message']) => void
  setBusy: (busy: boolean) => void
  /** Remembers `path` for `input` (most recent first). */
  remember: (input: string, path: string) => void
  forget: (input: string, path: string) => void
}

export const useMediaStore = create<MediaState>()(
  persist(
    (set) => ({
      inputs: [],
      selected: '',
      currentPath: null,
      draft: '',
      recents: {},
      restart: true,
      message: null,
      busy: false,

      // Only Image/Media sources can be swapped; anything else (a stale list, a bad caller) is dropped.
      setInputs: (inputs) => set({ inputs: inputs.filter((i) => i.name && isMediaKind(i.kind)) }),
      select: (selected) => set({ selected, currentPath: null, draft: '', message: null }),
      setCurrentPath: (currentPath) => set({ currentPath }),
      setDraft: (draft) => set({ draft }),
      setRestart: (restart) => set({ restart }),
      setMessage: (message) => set({ message }),
      setBusy: (busy) => set({ busy }),

      remember: (input, path) => {
        const p = normalizePath(path)
        if (!input || !p) return
        set((st) => ({ recents: { ...st.recents, [input]: pushRecent(st.recents[input] ?? [], p) } }))
      },
      forget: (input, path) =>
        set((st) => ({ recents: { ...st.recents, [input]: (st.recents[input] ?? []).filter((p) => p !== path) } })),
    }),
    {
      name: 'obs-overlay-media',
      partialize: (s) => ({ selected: s.selected, recents: s.recents, restart: s.restart }),
      // Storage can hold anything; keep only well-formed entries.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { selected?: unknown; recents?: unknown; restart?: unknown }
        const recents: Record<string, string[]> = {}
        if (p.recents && typeof p.recents === 'object') {
          for (const [name, list] of Object.entries(p.recents)) {
            if (Array.isArray(list)) recents[name] = list.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT)
          }
        }
        return {
          ...current,
          selected: typeof p.selected === 'string' ? p.selected : '',
          recents,
          restart: p.restart !== false,
        }
      },
    },
  ),
)
