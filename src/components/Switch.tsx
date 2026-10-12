export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (on: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-violet-600' : 'bg-zinc-700'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-[1.1rem]' : 'left-0.5'}`}
        />
      </span>
      {label}
    </button>
  )
}
