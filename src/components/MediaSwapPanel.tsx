import { useEffect } from 'react'
import { applyMediaSwap, loadCurrentPath, refreshMediaInputs } from '../lib/mediaSync'
import { baseName, mediaKindInfo } from '../lib/media'
import { useMediaStore } from '../store/useMediaStore'
import { useObsStore } from '../store/useObsStore'
import { Field } from './Field'
import { Panel, buttonClass, ghostButtonClass, inputClass } from './Panel'
import { Switch } from './Switch'

export function MediaSwapPanel() {
  const connected = useObsStore((o) => o.status) === 'connected'
  const { inputs, selected, currentPath, draft, recents, restart, message, busy, select, setDraft, setRestart, forget } = useMediaStore()
  const input = inputs.find((i) => i.name === selected)
  const kind = mediaKindInfo(input?.kind)

  useEffect(() => {
    if (connected) void refreshMediaInputs().then(loadCurrentPath)
  }, [connected])

  const pick = (name: string) => {
    select(name)
    void loadCurrentPath()
  }

  return (
    <Panel
      title="Media Swap"
      actions={
        <button className={ghostButtonClass} disabled={!connected} onClick={() => void refreshMediaInputs().then(loadCurrentPath)}>
          Refresh
        </button>
      }
    >
      <p className="text-xs text-zinc-500">
        Change the file of an Image or Media source without opening its properties in OBS. The path is read by OBS, so it
        must exist on the computer OBS runs on.
      </p>
      <Field label="Source">
        <select className={`${inputClass} ${connected && !selected ? 'border-amber-500' : ''}`} value={selected} disabled={!connected} onChange={(e) => pick(e.target.value)}>
          <option value="">{inputs.length || !connected ? 'Pick an Image or Media source…' : 'No Image or Media sources in OBS'}</option>
          {selected && !input && <option value={selected}>{selected} (not found)</option>}
          {inputs.map((i) => (
            <option key={i.name} value={i.name}>
              {i.name} ({mediaKindInfo(i.kind)?.label})
            </option>
          ))}
        </select>
      </Field>

      {input && (
        <>
          <p className="break-all text-xs text-zinc-400">
            Current file: <span className="font-mono text-zinc-300">{currentPath === null ? '…' : currentPath || '(none)'}</span>
          </p>
          <Field label={`New ${kind?.label.toLowerCase()} file path`}>
            <input
              className={`${inputClass} font-mono text-xs`}
              value={draft}
              placeholder={'C:\\Streaming\\backgrounds\\night.png'}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && draft.trim()) void applyMediaSwap()
              }}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-4">
            <button className={buttonClass} disabled={!connected || busy || !draft.trim()} onClick={() => void applyMediaSwap()}>
              Swap file
            </button>
            {input.kind === 'ffmpeg_source' && <Switch label="Restart after swap" checked={restart} onChange={setRestart} />}
          </div>

          {(recents[input.name] ?? []).length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-zinc-400">Recent files</span>
              <ul className="space-y-1" aria-label="Recent files">
                {(recents[input.name] ?? []).map((p) => (
                  <li key={p} className="flex items-center gap-2">
                    <button
                      className={`${ghostButtonClass} min-w-0 flex-1 truncate text-left font-mono text-xs`}
                      disabled={!connected || busy || p === currentPath}
                      title={p}
                      onClick={() => void applyMediaSwap(p)}
                    >
                      {baseName(p)}
                    </button>
                    <button className={ghostButtonClass} aria-label={`Forget ${baseName(p)}`} onClick={() => forget(input.name, p)}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`break-all rounded-md border px-3 py-2 text-xs ${
            message.kind === 'error' ? 'border-red-900 bg-red-950/40 text-red-300' : 'border-emerald-900 bg-emerald-950/40 text-emerald-300'
          }`}
        >
          {message.text}
        </p>
      )}
      {!connected && <p className="text-xs text-zinc-500">Connect to OBS to swap media files.</p>}
    </Panel>
  )
}
