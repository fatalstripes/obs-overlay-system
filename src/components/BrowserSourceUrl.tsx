import { useState, type ReactNode } from 'react'
import { useObsStore } from '../store/useObsStore'
import { Field } from './Field'
import { buttonClass, inputClass } from './Panel'

/** The "OBS Browser Source URL" block: the URL for an overlay route, a copy button and the include-password option. */
export function BrowserSourceUrl({
  build,
  children,
}: {
  /** Builds the URL from this page's address, the OBS WebSocket URL and the password to embed ('' for none). */
  build: (pageUrl: string, obsUrl: string, password: string) => string
  children: ReactNode
}) {
  const { url, password } = useObsStore()
  const [includePassword, setIncludePassword] = useState(true)
  const [copied, setCopied] = useState(false)
  const overlayUrl = build(window.location.href, url, includePassword ? password : '')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(overlayUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard can be blocked in some docks; the field is selectable
    }
  }

  return (
    <div className="space-y-2 border-t border-zinc-800 pt-4">
      <Field label="OBS Browser Source URL">
        <div className="flex gap-2">
          <input className={`${inputClass} font-mono text-xs`} readOnly value={overlayUrl} onFocus={(e) => e.currentTarget.select()} />
          <button className={buttonClass} onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </Field>
      <label className="flex items-center gap-2 text-xs text-zinc-400">
        <input type="checkbox" checked={includePassword} onChange={(e) => setIncludePassword(e.target.checked)} />
        Include the WebSocket password in the URL (OBS stores a Browser Source's URL in plain text)
      </label>
      <p className="text-xs text-zinc-500">{children}</p>
    </div>
  )
}
