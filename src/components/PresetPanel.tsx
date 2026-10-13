import { useState } from 'react'
import { loadPresetWithTextEngine } from '../lib/sceneBinding'
import { pushAll, withSyncErrors } from '../lib/sync'
import { isDefaultSettings } from '../lib/textEngine'
import { useObsStore } from '../store/useObsStore'
import { usePresetStore } from '../store/usePresetStore'
import { useTextEngineStore } from '../store/useTextEngineStore'
import { Panel, buttonClass, ghostButtonClass, inputClass } from './Panel'

export function PresetPanel() {
  const { presets, activePresetId, current, savePreset, deletePreset } = usePresetStore()
  const textEngine = useTextEngineStore((s) => s.settings)
  const connected = useObsStore((s) => s.status === 'connected')
  const [name, setName] = useState('')
  // null = automatic: carry the Custom ProText settings only once they have been changed from the defaults,
  // so users who never touch the text engine don't have a scene switch overwrite their overlay with "Hello, stream!".
  const [includeChoice, setIncludeChoice] = useState<boolean | null>(null)
  const includeTextEngine = includeChoice ?? !isDefaultSettings(textEngine)

  const save = () => {
    const n = name.trim()
    if (!n) return
    savePreset(n, includeTextEngine ? textEngine : undefined)
    setName('')
  }

  return (
    <Panel
      title="Presets"
      actions={
        <button className={ghostButtonClass} disabled={!connected} onClick={() => void withSyncErrors(pushAll(current))}>
          Push all to OBS
        </button>
      }
    >
      <div className="flex gap-2">
        <input
          className={inputClass}
          placeholder="Preset name (same name overwrites)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <button className={buttonClass} onClick={save}>
          Save
        </button>
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-400">
        <input type="checkbox" checked={includeTextEngine} onChange={(e) => setIncludeChoice(e.target.checked)} />
        Include the Custom ProText overlay settings
      </label>
      {presets.length === 0 ? (
        <p className="text-sm text-zinc-500">No presets yet.</p>
      ) : (
        <ul className="space-y-2">
          {presets.map((p) => (
            <li
              key={p.id}
              className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                p.id === activePresetId ? 'border-violet-500 bg-violet-500/10' : 'border-zinc-800'
              }`}
            >
              <span className="min-w-0 truncate text-sm">
                {p.name}
                {p.textEngine && (
                  <span className="ml-2 rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-violet-300">
                    ProText
                  </span>
                )}
              </span>
              <span className="flex gap-2">
                <button className={ghostButtonClass} onClick={() => loadPresetWithTextEngine(p.id)}>
                  Load
                </button>
                <button className={ghostButtonClass} onClick={() => deletePreset(p.id)}>
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
