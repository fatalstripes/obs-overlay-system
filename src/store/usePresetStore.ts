import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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

  setTargets: (patch: Partial<Targets>) => void
  setUniformValue: (name: string, value: number | string) => void
  addUniform: (uniform: Uniform) => void
  removeUniform: (name: string) => void
  setText: (patch: Partial<TextStyle>) => void

  savePreset: (name: string) => void
  loadPreset: (id: string) => void
  deletePreset: (id: string) => void
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export const usePresetStore = create<PresetState>()(
  persist(
    (set, get) => ({
      current: defaultValues(),
      presets: [],
      activePresetId: null,

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

      setText: (patch) =>
        set((s) => ({ current: { ...s.current, text: { ...s.current.text, ...patch } } })),

      savePreset: (name) => {
        const { presets, current } = get()
        const existing = presets.find((p) => p.name === name)
        if (existing) {
          set({
            presets: presets.map((p) => (p.id === existing.id ? { ...p, values: clone(current) } : p)),
            activePresetId: existing.id,
          })
          return
        }
        const id = crypto.randomUUID()
        set({
          presets: [...presets, { id, name, values: clone(current) }],
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
        })),
    }),
    { name: 'obs-overlay-presets' },
  ),
)
