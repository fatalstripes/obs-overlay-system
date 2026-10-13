import type { TextEngineSettings } from '../lib/textEngine'

type UniformBase = {
  name: string
  /** Display label from the shader's `string label = ...` annotation, if it has one. */
  label?: string
}

/** `float` and `int` uniforms, shown as range sliders. */
export type NumberUniform = UniformBase & {
  kind: 'float' | 'int'
  value: number
  min: number
  max: number
  step: number
}

/** `float4` uniforms, shown as color pickers and sent to OBS as ABGR integers. */
export type ColorUniform = UniformBase & {
  kind: 'color'
  /** `#rrggbb` */
  value: string
}

/** `bool` uniforms, shown as toggle switches. */
export type BoolUniform = UniformBase & {
  kind: 'bool'
  value: boolean
}

export type Uniform = NumberUniform | ColorUniform | BoolUniform

export type TextKind = 'text_gdiplus' | 'text_ft2_source'

export type TextStyle = {
  text: string
  fontFace: string
  fontSize: number
  color: string
  outlineColor: string
  outlineSize: number
  opacity: number
}

export type Targets = {
  shaderSource: string
  shaderFilter: string
  textSource: string
  textKind: TextKind
}

export type PresetValues = {
  targets: Targets
  uniforms: Uniform[]
  text: TextStyle
}

export type Preset = {
  id: string
  name: string
  values: PresetValues
  /**
   * The Custom ProText overlay's settings at the time of saving. Optional: a preset without it leaves the
   * overlay alone when it is applied (this is also what presets saved before the text engine existed look like).
   */
  textEngine?: TextEngineSettings
}
