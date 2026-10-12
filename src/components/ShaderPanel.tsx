import { useEffect, useState } from 'react'
import { pushShader, withSyncErrors } from '../lib/sync'
import { useObsStore } from '../store/useObsStore'
import { usePresetStore } from '../store/usePresetStore'
import { ColorPicker } from './ColorPicker'
import { Field } from './Field'
import { Panel, ghostButtonClass, inputClass } from './Panel'
import { Slider } from './Slider'

export function ShaderPanel() {
  const { current, setTargets, setUniformValue, addUniform, removeUniform } = usePresetStore()
  const { inputs, filters, status, refreshFilters } = useObsStore()
  const { shaderSource, shaderFilter } = current.targets
  const connected = status === 'connected'

  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<'float' | 'color'>('float')

  useEffect(() => {
    if (!connected) return
    void refreshFilters(shaderSource).then((names) => {
      // A source with exactly one filter is almost certainly the shader filter: fill it in.
      const { shaderSource: current, shaderFilter: filter } = usePresetStore.getState().current.targets
      if (current === shaderSource && names.length === 1 && !names.includes(filter)) {
        setTargets({ shaderFilter: names[0] })
      }
    })
  }, [connected, shaderSource, refreshFilters, setTargets])

  const add = () => {
    const name = newName.trim()
    if (!name) return
    addUniform(
      newKind === 'float'
        ? { kind: 'float', name, value: 0, min: 0, max: 1, step: 0.01 }
        : { kind: 'color', name, value: '#ffffff' },
    )
    setNewName('')
  }

  return (
    <Panel
      title="Shader Uniforms"
      actions={
        <button className={ghostButtonClass} disabled={!connected} onClick={() => void withSyncErrors(pushShader(current))}>
          Push now
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Source">
          <input
            className={`${inputClass} ${shaderSource ? '' : 'border-amber-500'}`}
            list="obs-inputs"
            value={shaderSource}
            onChange={(e) => setTargets({ shaderSource: e.target.value })}
            placeholder="Source with shader filter"
          />
        </Field>
        <Field label="Filter name">
          <input
            className={`${inputClass} ${shaderFilter ? '' : 'border-amber-500'}`}
            list="obs-filters"
            value={shaderFilter}
            onChange={(e) => setTargets({ shaderFilter: e.target.value })}
          />
        </Field>
      </div>
      {(!shaderSource || !shaderFilter) && (
        <p className="text-xs text-amber-300">
          Choose the Source (click the field to pick from OBS) and Filter name before anything is sent to OBS.
        </p>
      )}
      <datalist id="obs-inputs">{inputs.map((i) => <option key={i} value={i} />)}</datalist>
      <datalist id="obs-filters">{filters.map((f) => <option key={f} value={f} />)}</datalist>

      <div className="space-y-4">
        {current.uniforms.map((u) => (
          <div key={u.name} className="flex items-start gap-2">
            <div className="flex-1">
              {u.kind === 'float' ? (
                <Slider
                  label={u.name}
                  value={u.value}
                  min={u.min}
                  max={u.max}
                  step={u.step}
                  onChange={(v) => setUniformValue(u.name, v)}
                />
              ) : (
                <ColorPicker label={u.name} value={u.value} onChange={(v) => setUniformValue(u.name, v)} />
              )}
            </div>
            <button
              className="text-zinc-600 hover:text-red-400"
              onClick={() => removeUniform(u.name)}
              aria-label={`Remove ${u.name}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-t border-zinc-800 pt-4">
        <input
          className={inputClass}
          placeholder="uniform name (matches shader)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <select
          className={`${inputClass} w-28`}
          value={newKind}
          onChange={(e) => setNewKind(e.target.value as 'float' | 'color')}
        >
          <option value="float">float</option>
          <option value="color">color</option>
        </select>
        <button className={ghostButtonClass} onClick={add}>
          Add
        </button>
      </div>
    </Panel>
  )
}
