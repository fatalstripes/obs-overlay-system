import type { Uniform } from '../store/types'

export type ParsedShader = {
  /** Controls to show: one per supported user uniform, in declaration order. */
  uniforms: Uniform[]
  /** User uniforms of a type with no control (e.g. `float2`, `texture2d`), as `type name`. */
  skipped: string[]
  /** Things that were guessed or may not behave as expected. */
  warnings: string[]
}

/** Uniforms that obs-shaderfilter itself provides every frame; never shown as controls. */
const BUILTIN = new Set([
  'ViewProj',
  'image',
  'elapsed_time',
  'elapsed_time_start',
  'elapsed_time_active',
  'elapsed_time_show',
  'elapsed_time_enable',
  'uv_offset',
  'uv_scale',
  'uv_pixel_interval',
  'uv_size',
  'rand_f',
  'rand_instance_f',
  'rand_activation_f',
  'loops',
  'local_time',
])

/** Removes `//` and block comments but leaves string literals (annotation labels) alone. */
function stripComments(src: string): string {
  return src.replace(/("(?:[^"\\\n]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (_m, str: string | undefined) => str ?? ' ')
}

function parseAnnotations(body: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!body) return out
  for (const m of body.matchAll(/(?:string|float|int|bool|float2|float3|float4)\s+(\w+)\s*=\s*("(?:[^"\\]|\\.)*"|[^;]+);/g)) {
    out[m[1]] = m[2].trim().replace(/^"|"$/g, '')
  }
  return out
}

function toNumber(s: string | undefined): number | undefined {
  if (s === undefined) return undefined
  const n = Number.parseFloat(s.trim().replace(/f$/i, ''))
  return Number.isFinite(n) ? n : undefined
}

const hex2 = (v: number) =>
  Math.round(Math.min(1, Math.max(0, v)) * 255)
    .toString(16)
    .padStart(2, '0')

/** `{r, g, b, a}` or `float4(r, g, b, a)` -> `#rrggbb` (alpha is dropped). */
function parseColorDefault(s: string | undefined): string | undefined {
  if (!s) return undefined
  const m = /\{([^}]*)\}|float4\s*\(([^)]*)\)/.exec(s)
  if (!m) return undefined
  const parts = (m[1] ?? m[2]).split(',').map((p) => toNumber(p))
  if (parts.length < 3 || parts.slice(0, 3).some((p) => p === undefined)) return undefined
  return '#' + parts.slice(0, 3).map((p) => hex2(p as number)).join('')
}

/** Rounds up to 1, 2 or 5 times a power of ten. */
function niceCeil(v: number): number {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 5, 10]) if (v <= m * p) return m * p
  return 10 * p
}

function guessRange(def: number, integer: boolean): { min: number; max: number } {
  if (def === 0) return { min: 0, max: integer ? 10 : 1 }
  if (def > 0) return { min: 0, max: Math.max(integer ? 10 : 1, niceCeil(def * 4)) }
  const m = niceCeil(Math.abs(def) * 4)
  return { min: -m, max: m }
}

function guessStep(min: number, max: number, integer: boolean): number {
  if (integer) return 1
  const range = max - min
  return range > 0 ? 10 ** Math.floor(Math.log10(range / 100)) : 0.01
}

/**
 * Scans a libobs/obs-shaderfilter effect for `uniform float|int|bool|float4` declarations and turns each
 * into a control definition. Reads `label`, `widget_type`, `minimum`, `maximum` and `step` annotations and
 * the default value; anything missing is guessed from the default.
 */
export function parseShaderUniforms(source: string): ParsedShader {
  const code = stripComments(source)
  const result: ParsedShader = { uniforms: [], skipped: [], warnings: [] }
  const seen = new Set<string>()

  for (const m of code.matchAll(/\buniform\s+(\w+)\s+(\w+)\s*(?:<([^>]*)>)?\s*(?:=\s*([^;]+))?;/g)) {
    const [, type, name, annBody, rawDefault] = m
    if (BUILTIN.has(name) || seen.has(name)) continue
    const ann = parseAnnotations(annBody)
    const label = ann.label && ann.label !== name ? ann.label : undefined
    const base = label ? { name, label } : { name }

    if (type === 'bool') {
      seen.add(name)
      result.uniforms.push({ ...base, kind: 'bool', value: /\btrue\b/i.test(rawDefault ?? '') })
    } else if (type === 'float4') {
      seen.add(name)
      const value = parseColorDefault(rawDefault)
      if (value === undefined) result.warnings.push(`${name}: no readable default, starting white.`)
      if (ann.widget_type !== 'color') {
        result.warnings.push(
          `${name}: float4 without widget_type = "color"; shown as a color picker, but OBS may store it differently.`,
        )
      }
      result.uniforms.push({ ...base, kind: 'color', value: value ?? '#ffffff' })
    } else if (type === 'float' || type === 'int') {
      seen.add(name)
      const integer = type === 'int'
      const def = toNumber(rawDefault) ?? 0
      const guessed = guessRange(def, integer)
      let min = toNumber(ann.minimum ?? ann.min) ?? guessed.min
      let max = toNumber(ann.maximum ?? ann.max) ?? guessed.max
      if (min >= max) [min, max] = [guessed.min, guessed.max]
      min = Math.min(min, def)
      max = Math.max(max, def)
      const step = toNumber(ann.step) ?? guessStep(min, max, integer)
      result.uniforms.push({ ...base, kind: integer ? 'int' : 'float', value: def, min, max, step })
    } else {
      result.skipped.push(`${type} ${name}`)
    }
  }
  return result
}
