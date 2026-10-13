import { hexToObsColor } from './color.ts'
import type { Uniform } from '../store/types'

/**
 * The value as OBS expects it in filter settings (ABGR int for colors, true integers for ints), or
 * `undefined` when the uniform has no usable value (missing, NaN, wrong type): those are left out of the
 * payload rather than sent as a made-up zero.
 */
export function obsValue(u: Uniform): number | boolean | undefined {
  switch (u.kind) {
    case 'color':
      return typeof u.value === 'string' && /^#[0-9a-f]{6}$/i.test(u.value) ? hexToObsColor(u.value) : undefined
    case 'bool':
      return typeof u.value === 'boolean' ? u.value : undefined
    case 'int':
      return typeof u.value === 'number' && Number.isFinite(u.value) ? Math.round(u.value) : undefined
    case 'float':
      return typeof u.value === 'number' && Number.isFinite(u.value) ? u.value : undefined
    default:
      return undefined
  }
}

/** The `filterSettings` object for `SetSourceFilterSettings`: only uniforms that have a valid name and value. */
export function buildFilterSettings(uniforms: readonly Uniform[]): Record<string, number | boolean> {
  const settings: Record<string, number | boolean> = {}
  for (const u of uniforms) {
    if (typeof u?.name !== 'string' || u.name === '') continue
    const v = obsValue(u)
    if (v !== undefined) settings[u.name] = v
  }
  return settings
}

/** Drops entries that can't be sent (no name or no usable value) and later duplicates of a name. */
export function sanitizeUniforms(uniforms: readonly Uniform[]): Uniform[] {
  const seen = new Set<string>()
  const out: Uniform[] = []
  for (const u of uniforms) {
    if (typeof u?.name !== 'string' || u.name === '' || seen.has(u.name) || obsValue(u) === undefined) continue
    seen.add(u.name)
    out.push(u)
  }
  return out
}
