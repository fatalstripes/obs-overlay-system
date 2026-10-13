import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  buildTransformPayload, sameTransform, withRenderedSize, type Transform, type TransformInfo,
} from '../lib/layout.ts'

export type LayoutItem = { sceneItemId: number; sourceName: string; inputKind: string | null; isGroup: boolean }

type LayoutState = {
  /** Scene to edit; '' follows OBS's program scene. */
  scene: string
  /** Source (scene item) to edit. */
  source: string
  /** Scaling X keeps Y in proportion (and the other way round). */
  lockAspect: boolean

  /** The scene's items, for the picker (loaded from OBS). */
  items: LayoutItem[]
  /** The loaded target: which scene item the numbers below belong to. */
  target: { scene: string; sceneItemId: number } | null
  transform: Transform | null
  /** The transform as it was when loaded, for Reset. */
  original: Transform | null
  info: TransformInfo | null
  error: string | null

  setScene: (scene: string) => void
  setSource: (source: string) => void
  setLockAspect: (on: boolean) => void
  setItems: (items: LayoutItem[]) => void
  /** Sets the loaded target and its transform (also the baseline for Reset). */
  load: (target: { scene: string; sceneItemId: number }, transform: Transform, info: TransformInfo) => void
  /** Drops the loaded target (source changed, disconnected, ...). */
  clearTarget: () => void
  setError: (error: string | null) => void
  /** Takes a transform reported by OBS (e.g. the user dragged the item there); ignored for another item. */
  receive: (target: { scene: string; sceneItemId: number }, transform: Transform, info?: TransformInfo) => void
  /**
   * Applies an edit to the shown transform and returns the validated fields to send to OBS (empty: nothing to do).
   * With the aspect lock on, changing one scale axis scales the other in proportion.
   */
  edit: (patch: Partial<Transform>) => Partial<Transform>
  /** Puts the original transform back and returns it as the fields to send. */
  resetToOriginal: () => Partial<Transform>
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      scene: '',
      source: '',
      lockAspect: true,
      items: [],
      target: null,
      transform: null,
      original: null,
      info: null,
      error: null,

      setScene: (scene) => set({ scene, source: '', items: [], target: null, transform: null, original: null, info: null, error: null }),
      setSource: (source) => set({ source, target: null, transform: null, original: null, info: null, error: null }),
      setLockAspect: (lockAspect) => set({ lockAspect }),
      setItems: (items) => set({ items }),
      load: (target, transform, info) => set({ target, transform, original: transform, info, error: null }),
      clearTarget: () => set({ target: null, transform: null, original: null, info: null }),
      setError: (error) => set({ error }),

      receive: (target, transform, info) => {
        const st = get()
        if (!st.target || st.target.scene !== target.scene || st.target.sceneItemId !== target.sceneItemId) return
        if (st.transform && sameTransform(st.transform, transform)) return
        set({ transform, info: info ?? st.info })
      },

      edit: (patch) => {
        const { transform, lockAspect, info } = get()
        if (!transform) return {}
        const wanted: Partial<Transform> = { ...patch }
        if (lockAspect) {
          const ratio = transform.scaleX !== 0 ? transform.scaleY / transform.scaleX : 1
          if (patch.scaleX !== undefined && patch.scaleY === undefined) wanted.scaleY = patch.scaleX * ratio
          else if (patch.scaleY !== undefined && patch.scaleX === undefined) wanted.scaleX = ratio !== 0 ? patch.scaleY / ratio : patch.scaleY
        }
        const applied = buildTransformPayload(wanted)
        if (Object.keys(applied).length === 0) return {}
        const next = { ...transform, ...applied }
        set({ transform: next, info: info && withRenderedSize(info, next) })
        return applied
      },

      resetToOriginal: () => {
        const { original, info } = get()
        if (!original) return {}
        set({ transform: original, info: info && withRenderedSize(info, original) })
        return buildTransformPayload(original)
      },
    }),
    {
      name: 'obs-overlay-layout',
      partialize: (s) => ({ scene: s.scene, source: s.source, lockAspect: s.lockAspect }),
    },
  ),
)
