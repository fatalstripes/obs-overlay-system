import { getMediaPath, listMediaInputs, swapMedia } from './obsApi.ts'
import { errorMessage } from './sync.ts'
import { obs } from '../store/useObsStore.ts'
import { useMediaStore } from '../store/useMediaStore.ts'

const store = () => useMediaStore.getState()

/** Loads the Image/Media sources from OBS. */
export async function refreshMediaInputs(): Promise<void> {
  try {
    const inputs = await listMediaInputs(obs)
    store().setInputs(inputs)
    // Keep the selection only while the source still exists.
    if (store().selected && !inputs.some((i) => i.name === store().selected)) store().select('')
  } catch (e) {
    store().setInputs([])
    store().setMessage({ kind: 'error', text: errorMessage(e) })
  }
}

/** Reads the file the selected source currently shows. */
export async function loadCurrentPath(): Promise<void> {
  const input = store().inputs.find((i) => i.name === store().selected)
  if (!input) {
    store().setCurrentPath(null)
    return
  }
  try {
    const path = await getMediaPath(obs, { name: input.name, kind: input.kind })
    if (store().selected === input.name) store().setCurrentPath(path)
  } catch (e) {
    store().setMessage({ kind: 'error', text: errorMessage(e) })
  }
}

/** Points the selected source at `path` (the draft when omitted) and remembers it. */
export async function applyMediaSwap(path = store().draft): Promise<boolean> {
  const input = store().inputs.find((i) => i.name === store().selected)
  if (!input) {
    store().setMessage({ kind: 'error', text: 'Pick an Image or Media source first' })
    return false
  }
  store().setBusy(true)
  try {
    const set = await swapMedia(obs, { name: input.name, kind: input.kind }, path, { restart: store().restart })
    store().remember(input.name, set)
    store().setCurrentPath(set)
    store().setDraft('')
    store().setMessage({ kind: 'ok', text: `"${input.name}" now uses ${set}` })
    return true
  } catch (e) {
    store().setMessage({ kind: 'error', text: errorMessage(e) })
    return false
  } finally {
    store().setBusy(false)
  }
}
