/**
 * Swapping the file behind an OBS Image or Media source with `SetInputSettings`, the data behind the Media Swap panel.
 */

export type MediaKindInfo = {
  /** obs `inputKind` */
  kind: string
  label: string
  /** The input setting that holds the path. */
  pathKey: string
}

/** The input kinds whose file can be swapped. Image sources use `file`; Media sources use `local_file`. */
export const MEDIA_KINDS: MediaKindInfo[] = [
  { kind: 'image_source', label: 'Image', pathKey: 'file' },
  { kind: 'ffmpeg_source', label: 'Media', pathKey: 'local_file' },
]

export const mediaKindInfo = (kind: unknown): MediaKindInfo | undefined => MEDIA_KINDS.find((k) => k.kind === kind)

export const isMediaKind = (kind: unknown): boolean => !!mediaKindInfo(kind)

export const MAX_PATH_LENGTH = 1024

/**
 * Cleans up what people paste into a path field: surrounding whitespace and quotes (Windows' "Copy as path" adds
 * them) and `file://` URLs. Returns `null` for an empty or unusable path.
 */
export function normalizePath(input: unknown): string | null {
  if (typeof input !== 'string') return null
  let p = input.trim()
  if (p.length >= 2 && ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'")))) {
    p = p.slice(1, -1).trim()
  }
  if (/^file:\/\//i.test(p)) {
    try {
      const u = new URL(p)
      p = decodeURIComponent(u.pathname)
      if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1) // file:///C:/x -> C:/x
      if (u.host && u.host !== 'localhost') p = `//${u.host}${p}` // UNC share
    } catch {
      return null
    }
  }
  // eslint-disable-next-line no-control-regex
  if (!p || p.length > MAX_PATH_LENGTH || /[\u0000-\u001f]/.test(p)) return null
  return p
}

/**
 * The `inputSettings` that point a source at `path`. Media sources also need `is_local_file` or OBS would treat the
 * path as a URL. Returns `null` when the path or the kind is unusable.
 */
export function buildMediaSettings(kind: unknown, path: unknown): Record<string, string | boolean> | null {
  const info = mediaKindInfo(kind)
  const p = normalizePath(path)
  if (!info || !p) return null
  return info.kind === 'ffmpeg_source' ? { is_local_file: true, [info.pathKey]: p } : { [info.pathKey]: p }
}

/** The current path of a source, from its `GetInputSettings` result ('' if none). */
export function readMediaPath(kind: unknown, settings: unknown): string {
  const info = mediaKindInfo(kind)
  if (!info || !settings || typeof settings !== 'object') return ''
  const v = (settings as Record<string, unknown>)[info.pathKey]
  return typeof v === 'string' ? v : ''
}

/** The last file name in a path, for compact display. */
export const baseName = (path: string): string => path.split(/[\\/]/).filter(Boolean).pop() ?? path

export const MAX_RECENT = 8

/** Puts `path` first in a most-recently-used list, without duplicates, capped at `MAX_RECENT`. */
export const pushRecent = (list: string[], path: string): string[] =>
  [path, ...list.filter((p) => p !== path)].slice(0, MAX_RECENT)
