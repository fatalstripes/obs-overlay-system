/**
 * Scene item transforms (position / scale / rotation), the data behind the Layout panel.
 *
 * obs-websocket's `GetSceneItemTransform` returns more than we edit (bounds, crop, alignment, ...). We only ever send
 * back the fields the panel changes, as a partial `SetSceneItemTransform`, so everything else stays as it is in OBS.
 */

export type Transform = {
  positionX: number
  positionY: number
  scaleX: number
  scaleY: number
  /** Degrees, 0..360. */
  rotation: number
}

/** Extra, read-only context from OBS used to warn about transforms the panel can't change the way you'd expect. */
export type TransformInfo = {
  sourceWidth: number
  sourceHeight: number
  /** Rendered size, in canvas pixels. */
  width: number
  height: number
  boundsType: string
}

export const POSITION_LIMIT = 100_000
export const SCALE_LIMIT = 100
export const MIN_SCALE = 0.01

export const IDENTITY: Transform = { positionX: 0, positionY: 0, scaleX: 1, scaleY: 1, rotation: 0 }

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Rotation wrapped into [0, 360). */
export const normalizeRotation = (deg: number): number => ((deg % 360) + 360) % 360

/** A scale of 0 would make the item vanish and can't be undone from the numbers alone; negatives flip, so keep the sign. */
const scale = (v: number): number => {
  const c = clamp(v, -SCALE_LIMIT, SCALE_LIMIT)
  return Math.abs(c) < MIN_SCALE ? (c < 0 ? -MIN_SCALE : MIN_SCALE) : c
}

/**
 * Turns an edit into a `sceneItemTransform` for `SetSceneItemTransform`: only valid numbers survive, clamped to
 * sane ranges. Fields that are missing or not finite numbers are left out, so OBS keeps its current value for them.
 */
export function buildTransformPayload(patch: Partial<Record<keyof Transform, unknown>>): Partial<Transform> {
  const out: Partial<Transform> = {}
  if (finite(patch.positionX)) out.positionX = clamp(patch.positionX, -POSITION_LIMIT, POSITION_LIMIT)
  if (finite(patch.positionY)) out.positionY = clamp(patch.positionY, -POSITION_LIMIT, POSITION_LIMIT)
  if (finite(patch.scaleX)) out.scaleX = scale(patch.scaleX)
  if (finite(patch.scaleY)) out.scaleY = scale(patch.scaleY)
  if (finite(patch.rotation)) out.rotation = normalizeRotation(patch.rotation)
  return out
}

/** Reads the editable fields (and the context) out of OBS's `sceneItemTransform`; `null` if it isn't usable. */
export function parseTransform(raw: unknown): { transform: Transform; info: TransformInfo } | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const num = (k: string, fallback: number) => (finite(o[k]) ? (o[k] as number) : fallback)
  if (!finite(o.positionX) || !finite(o.positionY) || !finite(o.scaleX) || !finite(o.scaleY)) return null
  return {
    transform: {
      positionX: o.positionX,
      positionY: o.positionY,
      scaleX: o.scaleX,
      scaleY: o.scaleY,
      rotation: normalizeRotation(num('rotation', 0)),
    },
    info: {
      sourceWidth: num('sourceWidth', 0),
      sourceHeight: num('sourceHeight', 0),
      width: num('width', 0),
      height: num('height', 0),
      boundsType: typeof o.boundsType === 'string' ? o.boundsType : 'OBS_BOUNDS_NONE',
    },
  }
}

/** True when the item has a bounding box: OBS then sizes it from the bounds and ignores the scale values. */
export const hasBounds = (info: TransformInfo | null): boolean => !!info && info.boundsType !== 'OBS_BOUNDS_NONE'

/** Shallow equality on the editable fields (used to ignore echoes of our own changes). */
export const sameTransform = (a: Transform, b: Transform): boolean =>
  a.positionX === b.positionX && a.positionY === b.positionY && a.scaleX === b.scaleX && a.scaleY === b.scaleY && a.rotation === b.rotation

/** The size OBS shows the item at for `transform`, from the source size; unchanged for items with bounds (OBS sizes those from the box). */
export function withRenderedSize(info: TransformInfo, transform: Transform): TransformInfo {
  if (hasBounds(info)) return info
  return { ...info, width: info.sourceWidth * Math.abs(transform.scaleX), height: info.sourceHeight * Math.abs(transform.scaleY) }
}
