import { hexToObsColor } from './color'
import { obs, useObsStore } from '../store/useObsStore'
import { usePresetStore } from '../store/usePresetStore'
import type { PresetValues, Uniform } from '../store/types'

const neutralValue = (u: Uniform): number => (u.kind === 'color' ? hexToObsColor('#000000') : 0)

/**
 * Uniforms left over from a previously applied shader. OBS merges filter settings, so the old
 * values would otherwise linger; they ride along with the next shader push set to neutral values.
 * Names that are also in the live uniform list are never overridden.
 */
let pendingReset: Uniform[] = []

export function queueUniformReset(stale: Uniform[]) {
  // Accumulate: a failed push keeps its resets, and a quick A -> B -> C apply must reset both A and B.
  const byName = new Map(pendingReset.map((u) => [u.name, u]))
  for (const u of stale) byName.set(u.name, u)
  pendingReset = [...byName.values()]
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Run a push and surface any failure in the dashboard banner instead of an unhandled rejection. */
export async function withSyncErrors(job: Promise<unknown>) {
  try {
    await job
    useObsStore.setState({ syncError: null })
  } catch (e) {
    useObsStore.setState({ syncError: errorMessage(e) })
  }
}

export async function pushShader(v: PresetValues) {
  const { shaderSource, shaderFilter } = v.targets
  if (!shaderSource || !shaderFilter) return
  const filterSettings: Record<string, number> = {}
  const reset = pendingReset
  for (const u of reset) filterSettings[u.name] = neutralValue(u)
  for (const u of v.uniforms) {
    filterSettings[u.name] = u.kind === 'color' ? hexToObsColor(u.value) : u.value
  }
  await obs.call('SetSourceFilterSettings', {
    sourceName: shaderSource,
    filterName: shaderFilter,
    filterSettings,
    overlay: true,
  })
  // Only forget the reset once OBS accepted it; a failed push retries it next time.
  if (pendingReset === reset) pendingReset = []
}

export async function pushText(v: PresetValues) {
  const { textSource, textKind } = v.targets
  if (!textSource) return
  const t = v.text
  const alpha = Math.round((t.opacity / 100) * 255)
  const font = { face: t.fontFace, size: t.fontSize, style: 'Regular', flags: 0 }
  const inputSettings: Record<string, string | number | boolean | Record<string, string | number>> =
    textKind === 'text_gdiplus'
      ? {
          text: t.text,
          font,
          color: hexToObsColor(t.color),
          opacity: t.opacity,
          outline: t.outlineSize > 0,
          outline_color: hexToObsColor(t.outlineColor),
          outline_size: t.outlineSize,
        }
      : {
          text: t.text,
          font,
          color1: hexToObsColor(t.color, alpha),
          color2: hexToObsColor(t.color, alpha),
          outline: t.outlineSize > 0,
        }
  await obs.call('SetInputSettings', { inputName: textSource, inputSettings, overlay: true })
}

export async function pushAll(v: PresetValues) {
  await Promise.all([pushShader(v), pushText(v)])
}

/**
 * Subscribes to preset changes and forwards only the part that changed.
 * Trailing-throttled so dragging a slider doesn't flood the socket.
 */
export function startLiveSync(intervalMs = 50): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  let dirtyShader = false
  let dirtyText = false

  const flush = async () => {
    timer = null
    const { status } = useObsStore.getState()
    const v = usePresetStore.getState().current
    const jobs: Promise<void>[] = []
    if (dirtyShader) jobs.push(pushShader(v))
    if (dirtyText) jobs.push(pushText(v))
    dirtyShader = dirtyText = false
    if (status !== 'connected') return
    await withSyncErrors(Promise.all(jobs))
  }

  const unsub = usePresetStore.subscribe((s, prev) => {
    if (!useObsStore.getState().liveSync) return
    if (s.current === prev.current) return
    if (s.current.uniforms !== prev.current.uniforms || s.current.targets !== prev.current.targets) {
      dirtyShader = true
    }
    if (s.current.text !== prev.current.text || s.current.targets !== prev.current.targets) {
      dirtyText = true
    }
    timer ??= setTimeout(flush, intervalMs)
  })

  return () => {
    unsub()
    if (timer) clearTimeout(timer)
  }
}
