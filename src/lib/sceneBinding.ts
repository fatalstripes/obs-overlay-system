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

  const unsub = useObsStore.subscribe((s, prev) => {
    if (!s.currentScene || s.currentScene === prev.currentScene || s.status !== 'connected') return
    const { sceneBindings, sceneAutoApply } = usePresetStore.getState()
    const presetId = sceneBindings[s.currentScene]
    if (sceneAutoApply && presetId) void applyPresetNow(presetId)
  })

  return () => {
    unsub()
    obs.off('CurrentProgramSceneChanged', onProgramScene)
    obs.off('SceneListChanged', onSceneList)
    obs.off('SceneNameChanged', onRenamed)
  }
}
