export type NumberUniform = {
  kind: 'float'
  name: string
  value: number
  min: number
  max: number
  step: number
}

export type ColorUniform = {
  kind: 'color'
  name: string
  /** `#rrggbb` */
  value: string
}

export type Uniform = NumberUniform | ColorUniform

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
}
