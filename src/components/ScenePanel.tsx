import { applyPresetNow } from '../lib/sceneBinding'
import { useObsStore } from '../store/useObsStore'
import { usePresetStore } from '../store/usePresetStore'
import { Panel, ghostButtonClass, inputClass } from './Panel'
import { Switch } from './Switch'

export function ScenePanel() {
  const { presets, sceneBindings, sceneAutoApply, bindScene, setSceneAutoApply } = usePresetStore()
  const { scenes, currentScene, status } = useObsStore()
  const connected = status === 'connected'

  // OBS's scenes, plus any bound scene that no longer exists in OBS so it can still be cleared.
  const missing = Object.keys(sceneBindings).filter((s) => !scenes.includes(s))
  const rows = [...scenes, ...missing]

  return (
    <Panel
      title="Scene Presets"
      actions={
        <Switch
          label={sceneAutoApply ? 'Auto-apply' : 'Auto off'}
          checked={sceneAutoApply}
          onChange={setSceneAutoApply}
        />
      }
    >
      <p className="text-xs text-zinc-500">
        Bind a saved preset to a scene. When OBS switches to that scene, its shader and text settings (and its Custom
        ProText overlay settings, if it has them) are pushed automatically.
      </p>
      {presets.length === 0 ? (
        <p className="text-sm text-zinc-500">Save a preset first, then bind it to a scene here.</p>
      ) : !connected ? (
        <p className="text-sm text-zinc-500">Connect to OBS to see its scenes.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((scene) => {
            const bound = sceneBindings[scene] ?? ''
            const live = scene === currentScene
            return (
              <li
                key={scene}
                className={`space-y-2 rounded-md border px-3 py-2 ${
                  live ? 'border-violet-500 bg-violet-500/10' : 'border-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate" title={scene}>
                    {scene}
                  </span>
                  <span className="shrink-0 text-xs">
                    {live && <span className="uppercase tracking-wide text-violet-300">live</span>}
                    {!scenes.includes(scene) && <span className="text-amber-300">not in OBS</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Preset for ${scene}`}
                    className={`${inputClass} min-w-0 flex-1`}
                    value={bound}
                    onChange={(e) => bindScene(scene, e.target.value || null)}
                  >
                    <option value="">No preset</option>
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.textEngine ? ' · ProText' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    className={ghostButtonClass}
                    disabled={!bound}
                    onClick={() => void applyPresetNow(bound)}
                    title="Apply this preset now"
                  >
                    Apply
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
