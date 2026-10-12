import { hexToObsColor } from './color'
import { obs, useObsStore } from '../store/useObsStore'
import { usePresetStore } from '../store/usePresetStore'
import type { PresetValues } from '../store/types'

export async function pushShader(v: PresetValues) {
  const { shaderSource, shaderFilter } = v.targets
  if (!shaderSource || !shaderFilter) return
  const filterSettings: Record<string, number> = {}
  for (const u of v.uniforms) {
    filterSettings[u.name] = u.kind === 'color' ? hexToObsColor(u.value) : u.value
  }
  await obs.call('SetSourceFilterSettings', {
    sourceName: shaderSource,
    filterName: shaderFilter,
    filterSettings,
    overlay: true,
  })
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
    try {
      await Promise.all(jobs)
      useObsStore.setState({ error: null })
    } catch (e) {
      useObsStore.setState({ error: e instanceof Error ? e.message : String(e) })
    }
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
