import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { sanitizeSettings, type TextEngineSettings } from '../lib/textEngine.ts'
import type { Preset, PresetValues, TextStyle, Targets, Uniform } from './types'

export const defaultValues = (): PresetValues => ({
  targets: {
    shaderSource: '',
    shaderFilter: 'Shader',
    textSource: '',
    textKind: 'text_gdiplus',
  },
  uniforms: [
    { kind: 'float', name: 'speed', value: 1, min: 0, max: 10, step: 0.01 },
    { kind: 'float', name: 'intensity', value: 0.5, min: 0, max: 1, step: 0.01 },
    { kind: 'float', name: 'scale', value: 1, min: 0.1, max: 5, step: 0.01 },
    { kind: 'color', name: 'tint', value: '#8b5cf6' },
  ],
  text: {
    text: 'Hello, stream!',
    fontFace: 'Arial',
    fontSize: 72,
    color: '#ffffff',
    outlineColor: '#000000',
    outlineSize: 4,
    opacity: 100,
  },
})

type PresetState = {
  current: PresetValues
  presets: Preset[]
  activePresetId: string | null
  /** OBS scene name -> preset id. When that scene becomes the program scene, the preset is applied. */
  sceneBindings: Record<string, string>
  /** Apply the bound preset automatically when OBS switches scenes. */
  sceneAutoApply: boolean

  setTargets: (patch: Partial<Targets>) => void
  setUniformValue: (name: string, value: number | string | boolean) => void
  addUniform: (uniform: Uniform) => void
  removeUniform: (name: string) => void
  /** Replace all uniforms (e.g. from the shader library); targets and text are untouched. */
  applyUniforms: (uniforms: Uniform[]) => void
  setText: (patch: Partial<TextStyle>) => void

  /** Saves the current values under `name` (same name overwrites). With `textEngine`, the preset carries those overlay settings too. */
  savePreset: (name: string, textEngine?: TextEngineSettings) => void
  loadPreset: (id: string) => void
  deletePreset: (id: string) => void

  /** Binds a preset to a scene; `null` removes the binding. */
  bindScene: (scene: string, presetId: string | null) => void
  /** Keeps a binding when a scene is renamed in OBS. */
  renameScene: (from: string, to: string) => void
  setSceneAutoApply: (on: boolean) => void
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export const usePresetStore = create<PresetState>()(
  persist(
    (set, get) => ({
      current: defaultValues(),
      presets: [],
      activePresetId: null,
      sceneBindings: {},
      sceneAutoApply: true,

      setTargets: (patch) =>
        set((s) => ({ current: { ...s.current, targets: { ...s.current.targets, ...patch } } })),

      setUniformValue: (name, value) =>
        set((s) => ({
          current: {
            ...s.current,
            uniforms: s.current.uniforms.map((u) =>
              u.name === name ? ({ ...u, value } as Uniform) : u,
            ),
          },
        })),

      addUniform: (uniform) =>
        set((s) =>
          s.current.uniforms.some((u) => u.name === uniform.name)
            ? s
            : { current: { ...s.current, uniforms: [...s.current.uniforms, uniform] } },
        ),

      removeUniform: (name) =>
        set((s) => ({
          current: { ...s.current, uniforms: s.current.uniforms.filter((u) => u.name !== name) },
        })),

      applyUniforms: (uniforms) =>
        set((s) => ({ current: { ...s.current, uniforms: clone(uniforms) } })),

      setText: (patch) =>
        set((s) => ({ current: { ...s.current, text: { ...s.current.text, ...patch } } })),

      savePreset: (name, textEngine) => {
        const { presets, current } = get()
        const saved: Pick<Preset, 'values' | 'textEngine'> = {
          values: clone(current),
          // validated on the way in, so a preset can never hold something the overlay would reject
          ...(textEngine ? { textEngine: sanitizeSettings(clone(textEngine)) } : {}),
        }
        const existing = presets.find((p) => p.name === name)
        if (existing) {
          // overwriting replaces the whole preset, including dropping the ProText snapshot if this save has none
          set({
            presets: presets.map((p) => (p.id === existing.id ? { id: p.id, name: p.name, ...saved } : p)),
            activePresetId: existing.id,
          })
          return
        }
        const id = crypto.randomUUID()
        set({
          presets: [...presets, { id, name, ...saved }],
          activePresetId: id,
        })
      },

      loadPreset: (id) => {
        const preset = get().presets.find((p) => p.id === id)
        if (preset) set({ current: clone(preset.values), activePresetId: id })
      },

      deletePreset: (id) =>
        set((s) => ({
          presets: s.presets.filter((p) => p.id !== id),
          activePresetId: s.activePresetId === id ? null : s.activePresetId,
          // a binding to a deleted preset would point at nothing
          sceneBindings: Object.fromEntries(Object.entries(s.sceneBindings).filter(([, pid]) => pid !== id)),
        })),

      bindScene: (scene, presetId) =>
        set((s) => {
          const { [scene]: _removed, ...rest } = s.sceneBindings
          return { sceneBindings: presetId ? { ...rest, [scene]: presetId } : rest }
        }),

      renameScene: (from, to) =>
        set((s) => {
          const id = s.sceneBindings[from]
          if (!id || from === to) return s
          const { [from]: _removed, ...rest } = s.sceneBindings
          return { sceneBindings: { ...rest, [to]: id } }
        }),

      setSceneAutoApply: (sceneAutoApply) => set({ sceneAutoApply }),
    }),
    { name: 'obs-overlay-presets' },
  ),
)
