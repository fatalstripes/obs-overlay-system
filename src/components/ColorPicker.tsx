type Props = { label: string; value: string; onChange: (hex: string) => void }

export function ColorPicker({ label, value, onChange }: Props) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-zinc-500">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-8 w-12 cursor-pointer rounded border border-zinc-700 bg-transparent p-0.5"
        />
      </div>
    </div>
  )
}
