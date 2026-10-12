import { useState } from 'react'
import { pushAll } from '../lib/sync'
import { useObsStore } from '../store/useObsStore'
import { usePresetStore } from '../store/usePresetStore'
import { Panel, buttonClass, ghostButtonClass, inputClass } from './Panel'

export function PresetPanel() {
  const { presets, activePresetId, current, savePreset, loadPreset, deletePreset } = usePresetStore()
  const connected = useObsStore((s) => s.status === 'connected')
  const [name, setName] = useState('')

  const save = () => {
    const n = name.trim()
    if (!n) return
    savePreset(n)
    setName('')
  }

  return (
    <Panel
      title="Presets"
      actions={
        <button className={ghostButtonClass} disabled={!connected} onClick={() => void pushAll(current)}>
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
              <span className="text-sm">{p.name}</span>
              <span className="flex gap-2">
                <button className={ghostButtonClass} onClick={() => loadPreset(p.id)}>
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
