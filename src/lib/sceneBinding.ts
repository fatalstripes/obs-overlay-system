import { obs, useObsStore } from '../store/useObsStore'
import { usePresetStore } from '../store/usePresetStore'
import { pushAll, withoutLiveSync, withSyncErrors } from './sync'

/**
 * Loads a saved preset into the dashboard and pushes all of it (shader uniforms and text) to OBS right away.
 * Live sync is held off for the load so the same values aren't sent twice.
 */
export async function applyPresetNow(presetId: string): Promise<boolean> {
  const { presets, loadPreset } = usePresetStore.getState()
  if (!presets.some((p) => p.id === presetId)) return false
  withoutLiveSync(() => loadPreset(presetId))
  if (useObsStore.getState().status === 'connected') {
    await withSyncErrors(pushAll(usePresetStore.getState().current))
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
