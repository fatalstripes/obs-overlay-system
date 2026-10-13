import { useState } from 'react'
import { SHADER_CATEGORIES, SHADER_LIBRARY, type ShaderCategory } from '../lib/shaderLibrary'
import { applyUniformSet, pushShader, withSyncErrors } from '../lib/sync'
import { useObsStore } from '../store/useObsStore'
import { usePresetStore } from '../store/usePresetStore'
import { Panel, ghostButtonClass } from './Panel'

export function ShaderLibraryPanel() {
  const connected = useObsStore((s) => s.status === 'connected')
  const [category, setCategory] = useState<ShaderCategory | 'All'>('All')
  const [appliedId, setAppliedId] = useState<string | null>(null)
  const [note, setNote] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)

  const entries = SHADER_LIBRARY.filter((e) => category === 'All' || e.category === category)

  const apply = (id: string) => {
    const entry = SHADER_LIBRARY.find((e) => e.id === id)
    if (!entry) return
    applyUniformSet(entry.uniforms)
    setAppliedId(id)

    const { shaderSource, shaderFilter } = usePresetStore.getState().current.targets
    if (!connected) {
      setNote({ tone: 'warn', text: 'Not connected to OBS, so only the sliders here changed. Connect first.' })
    } else if (!shaderSource || !shaderFilter) {
      setNote({ tone: 'warn', text: 'Nothing was sent: set a Source and Filter name in Shader Uniforms first.' })
    } else {
      setNote({
        tone: 'ok',
        text: `Sent ${entry.uniforms.length} uniforms to "${shaderFilter}" on "${shaderSource}". OBS ignores names your shader doesn't declare, so if nothing changes, rename them to match your shader.`,
      })
    }
    // Live sync is a no-op when disabled, so push explicitly if connected and it's off.
    if (connected && !useObsStore.getState().liveSync) {
      void withSyncErrors(pushShader(usePresetStore.getState().current))
    }
  }

  return (
    <Panel title="Shader Library">
      <div className="flex flex-wrap gap-1.5">
        {(['All', ...SHADER_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full px-2.5 py-1 text-xs ${
              category === c ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {entries.map((e) => (
          <li
            key={e.id}
            className={`rounded-md border px-3 py-2 ${
              e.id === appliedId ? 'border-violet-500 bg-violet-500/10' : 'border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm text-zinc-100">{e.name}</div>
                <div className="text-xs text-zinc-500">{e.description}</div>
              </div>
              <button className={ghostButtonClass} onClick={() => apply(e.id)}>
                Apply
              </button>
            </div>
            <div className="mt-1 font-mono text-[10px] text-zinc-600">
              {e.uniforms.map((u) => u.name).join(' · ')}
            </div>
            <div className="font-mono text-[10px] text-violet-400/70">needs shaders/{e.shaderFile}</div>
          </li>
        ))}
      </ul>
      {note && (
        <p className={`rounded-md px-3 py-2 text-xs ${note.tone === 'ok' ? 'bg-zinc-800 text-zinc-300' : 'bg-amber-950/60 text-amber-200'}`}>
          {note.text}
        </p>
      )}
      <p className="text-xs text-zinc-500">
        Applying replaces the uniform list; source, filter and text settings are kept. Uniforms from the previous
        shader are reset to 0 / black in OBS. Each preset only does something when the filter on your source loads the
        shader file shown on its card, with "Use Effect File (.effect)" ticked.
      </p>
    </Panel>
  )
}
