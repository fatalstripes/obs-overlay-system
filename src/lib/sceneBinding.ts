import { obs, useObsStore } from '../store/useObsStore'
import { usePresetStore } from '../store/usePresetStore'
import { useTextEngineStore } from '../store/useTextEngineStore'
import { pushAll, withoutLiveSync, withSyncErrors } from './sync'
import { sendTextSettings, withoutTextBridge } from './textBridge'

/**
 * Loads a saved preset into the dashboard, including its Custom ProText settings when it has them. Nothing is
 * forced to OBS here: live sync and the text bridge push the changes the way they do for any edit.
 */
export function loadPresetWithTextEngine(presetId: string): boolean {
  const preset = usePresetStore.getState().presets.find((p) => p.id === presetId)
  if (!preset) return false
  usePresetStore.getState().loadPreset(presetId)
  if (preset.textEngine) useTextEngineStore.getState().setSettings(preset.textEngine)
  return true
}

/**
 * Loads a saved preset and pushes all of it to OBS right away: the shader uniforms and native text, and (if the
 * preset carries them) the Custom ProText overlay settings. Live sync and the text bridge are held off for the
 * load so nothing is sent twice, and it works even when live sync is switched off.
 */
export async function applyPresetNow(presetId: string): Promise<boolean> {
  const preset = usePresetStore.getState().presets.find((p) => p.id === presetId)
  if (!preset) return false
  withoutLiveSync(() => withoutTextBridge(() => loadPresetWithTextEngine(presetId)))
  if (useObsStore.getState().status === 'connected') {
    const jobs = [pushAll(usePresetStore.getState().current)]
    if (preset.textEngine) jobs.push(sendTextSettings())
    await withSyncErrors(Promise.all(jobs))
  }
  return true
}

/**
 * The preset that is bound to the scene that is live in OBS right now (and would be applied on a scene switch), or
 * `null` when there isn't one: not connected, auto-apply off, an unbound scene, or a binding to a deleted preset.
 */
export function liveScenePresetId(): string | null {
  const { status, currentScene } = useObsStore.getState()
  const { sceneBindings, sceneAutoApply, presets } = usePresetStore.getState()
  if (status !== 'connected' || !sceneAutoApply || !currentScene) return null
  const id = sceneBindings[currentScene]
  return id && presets.some((p) => p.id === id) ? id : null
}

/**
 * Keeps each scene's overlay settings with its preset: edits the user makes in the Custom ProText panel while a scene
 * with a bound preset is live are saved into that preset (debounced), so switching scenes brings each scene's own text
 * back instead of every edit landing on the one shared overlay. Settings loaded *from* a preset are not edits.
 * Returns a stop function.
 */
function startTextEngineAutoSave(debounceMs = 250): () => void {
  let pending: { id: string; settings: ReturnType<typeof useTextEngineStore.getState>['settings'] } | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    const job = pending
    pending = null
    if (job) usePresetStore.getState().setPresetTextEngine(job.id, job.settings)
  }

  const unsub = useTextEngineStore.subscribe((s, prev) => {
    if (s.editSeq === prev.editSeq || !s.autoSaveToScene) return
    const id = liveScenePresetId()
    if (!id) return
    if (pending && pending.id !== id) flush() // the scene changed since the last edit: finish that one first
    pending = { id, settings: s.settings }
    clearTimeout(timer)
    timer = setTimeout(flush, debounceMs)
  })

  return () => {
    unsub()
    flush()
  }
}

/**
 * Follows OBS's program scene: when it changes (or is first learned on connect), the preset bound to that scene
 * is applied. Scenes without a binding leave everything as it is.
 */
export function startSceneBinding(): () => void {
  const onProgramScene = ({ sceneName }: { sceneName: string }) => useObsStore.setState({ currentScene: sceneName })
  const onSceneList = () => void useObsStore.getState().refreshScenes().catch(() => {})
  const onRenamed = ({ oldSceneName, sceneName }: { oldSceneName: string; sceneName: string }) => {
    usePresetStore.getState().renameScene(oldSceneName, sceneName)
    onSceneList()
  }

  obs.on('CurrentProgramSceneChanged', onProgramScene)
  obs.on('SceneListChanged', onSceneList)
  obs.on('SceneNameChanged', onRenamed)

  const stopAutoSave = startTextEngineAutoSave()

  const unsub = useObsStore.subscribe((s, prev) => {
    if (!s.currentScene || s.currentScene === prev.currentScene || s.status !== 'connected') return
    const { sceneBindings, sceneAutoApply } = usePresetStore.getState()
    const presetId = sceneBindings[s.currentScene]
    if (sceneAutoApply && presetId) void applyPresetNow(presetId)
  })

  return () => {
    unsub()
    stopAutoSave()
    obs.off('CurrentProgramSceneChanged', onProgramScene)
    obs.off('SceneListChanged', onSceneList)
    obs.off('SceneNameChanged', onRenamed)
  }
}
