import { inputClass } from './Panel'

type Props = {
  value: string
  options: string[]
  onChange: (value: string) => void
  placeholder: string
  /** Outline the field while it's still empty. */
  required?: boolean
}

/**
 * Picks a name that exists in OBS. Uses a real <select> when OBS has told us the options (a <datalist>
 * doesn't reliably open inside OBS's browser dock), and a plain text field when it hasn't (not connected).
 */
export function NamePicker({ value, options, onChange, placeholder, required }: Props) {
  const className = `${inputClass} ${required && !value ? 'border-amber-500' : ''}`
  if (options.length === 0) {
    return <input className={className} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  }
  // Keep a previously saved name selectable even if OBS no longer lists it.
  const shown = value && !options.includes(value) ? [value, ...options] : options
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {shown.map((o) => (
        <option key={o} value={o}>
          {o}
          {o === value && !options.includes(o) ? ' (not found in OBS)' : ''}
        </option>
      ))}
    </select>
  )
}
