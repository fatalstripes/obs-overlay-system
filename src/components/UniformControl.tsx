import type { Uniform } from '../store/types'
import { ColorPicker } from './ColorPicker'
import { Slider } from './Slider'
import { Switch } from './Switch'

/** Renders the control for one uniform, chosen by its type: slider, color picker or toggle. */
export function UniformControl({ u, onChange }: { u: Uniform; onChange: (value: number | string | boolean) => void }) {
  const label = u.label ?? u.name
  switch (u.kind) {
    case 'float':
    case 'int':
      return (
        <Slider
          label={label}
          value={u.value}
          min={u.min}
          max={u.max}
          step={u.step}
          onChange={(v) => onChange(u.kind === 'int' ? Math.round(v) : v)}
        />
      )
    case 'color':
      return <ColorPicker label={label} value={u.value} onChange={onChange} />
    case 'bool':
      return (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-400">{label}</span>
          <Switch label={u.value ? 'On' : 'Off'} checked={u.value} onChange={onChange} />
        </div>
      )
  }
}
