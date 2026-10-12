type Props = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

export function Slider({ label, value, min, max, step = 1, unit, onChange }: Props) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))}
          className="w-20 rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-right tabular-nums text-zinc-100"
          aria-label={`${label} value`}
        />
        {unit && <span className="ml-1 text-zinc-500">{unit}</span>}
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </div>
  )
}
