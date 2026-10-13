import { getSceneItemId, getTransform, listSceneItems, setTransform } from './obsApi.ts'
import { parseTransform, type Transform } from './layout.ts'
import { errorMessage } from './sync.ts'
import { obs, useObsStore } from '../store/useObsStore.ts'
import { useLayoutStore } from '../store/useLayoutStore.ts'

/** The scene being edited: the chosen one, or OBS's program scene. */
export const layoutScene = (): string => useLayoutStore.getState().scene || useObsStore.getState().currentScene || ''

/** Loads the scene's items into the picker. */
export async function refreshLayoutItems(): Promise<void> {
  const scene = layoutScene()
  if (!scene) {
    useLayoutStore.getState().setItems([])
    return
  }
  try {
    const items = await listSceneItems(obs, scene)
    if (scene === layoutScene()) useLayoutStore.getState().setItems(items)
  } catch (e) {
    useLayoutStore.setState({ items: [], error: errorMessage(e) })
  }
}

/** Resolves the chosen source to its scene item (`GetSceneItemId`) and loads its transform. */
export async function loadLayoutTarget(): Promise<void> {
  const store = useLayoutStore.getState()
  const scene = layoutScene()
  const source = store.source
  if (!scene || !source) {
    store.clearTarget()
    return
  }
  try {
    const sceneItemId = await getSceneItemId(obs, scene, source)
    const { transform, info } = await getTransform(obs, scene, sceneItemId)
    // The user may have picked something else while this was in flight.
    if (layoutScene() !== scene || useLayoutStore.getState().source !== source) return
    useLayoutStore.getState().load({ scene, sceneItemId }, transform, info)
  } catch (e) {
    useLayoutStore.getState().clearTarget()
    useLayoutStore.getState().setError(`"${source}" in "${scene}": ${errorMessage(e)}`)
  }
}

let pending: Partial<Transform> = {}
let pendingTarget: { scene: string; sceneItemId: number } | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let lastEditAt = 0
/** OBS echoes our own edits back as events; for this long after one, events are ignored so a slow echo can't undo a newer drag. */
const ECHO_WINDOW_MS = 400

async function flush() {
  timer = undefined
  const target = pendingTarget
  const patch = pending
  pending = {}
  pendingTarget = null
  if (!target || Object.keys(patch).length === 0) return
  try {
    await setTransform(obs, target.scene, target.sceneItemId, patch)
    useLayoutStore.getState().setError(null)
  } catch (e) {
    useLayoutStore.getState().setError(errorMessage(e))
  }
}

/**
 * Applies an edit in the panel and sends it to OBS. Edits are merged and sent at most every `throttleMs` while a
 * slider is dragged; the target is captured now, so a scene or source change can't redirect a pending edit.
 */
export function editLayout(patch: Partial<Transform>, throttleMs = 40): void {
  const store = useLayoutStore.getState()
  const { target } = store
  if (!target) return
  const applied = store.edit(patch)
  if (Object.keys(applied).length === 0) return
  lastEditAt = Date.now()
  if (pendingTarget && (pendingTarget.scene !== target.scene || pendingTarget.sceneItemId !== target.sceneItemId)) {
    void flush() // a different item: send what is waiting for the old one first
    clearTimeout(timer)
  }
  pendingTarget = target
  pending = { ...pending, ...applied }
  if (!useObsStore.getState().liveSync) return // held until live sync is back on, see `flushLayoutNow`
  timer ??= setTimeout(() => void flush(), throttleMs)
}

/** Sends any held or pending edit right away. */
export async function flushLayoutNow(): Promise<void> {
  clearTimeout(timer)
  await flush()
}

export function resetLayout(): void {
  const { target } = useLayoutStore.getState()
  if (!target) return
  const patch = useLayoutStore.getState().resetToOriginal()
  if (Object.keys(patch).length === 0) return
  pendingTarget = target
  pending = { ...patch } // the original replaces anything still waiting
  clearTimeout(timer)
  timer = undefined
  void flush()
}

/** Keeps the panel in step with OBS: edits made in OBS itself, and scene/source list changes. */
export function startLayoutSync(): () => void {
  lastEditAt = 0
  const onTransform = (e: { sceneName: string; sceneItemId: number; sceneItemTransform: unknown }) => {
    if (Date.now() - lastEditAt < ECHO_WINDOW_MS || Object.keys(pending).length > 0) return
    const parsed = parseTransform(e.sceneItemTransform)
    if (parsed) useLayoutStore.getState().receive({ scene: e.sceneName, sceneItemId: e.sceneItemId }, parsed.transform, parsed.info)
  }
  const onItems = () => void refreshLayoutItems()
  obs.on('SceneItemTransformChanged', onTransform)
  obs.on('SceneItemCreated', onItems)
  obs.on('SceneItemRemoved', onItems)
  obs.on('SceneItemListReindexed', onItems)

  const unsub = useObsStore.subscribe((s, prev) => {
    if (s.status !== 'connected' && prev.status === 'connected') useLayoutStore.getState().clearTarget()
    if (s.liveSync && !prev.liveSync) void flushLayoutNow()
  })

  return () => {
    obs.off('SceneItemTransformChanged', onTransform)
    obs.off('SceneItemCreated', onItems)
    obs.off('SceneItemRemoved', onItems)
    obs.off('SceneItemListReindexed', onItems)
    unsub()
    clearTimeout(timer)
    timer = undefined
  }
}
