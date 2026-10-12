import { useObsStore } from '../store/useObsStore'
import { usePresetStore } from '../store/usePresetStore'
import { Field } from './Field'
import { Panel, buttonClass, ghostButtonClass, inputClass } from './Panel'

const dot = {
  connected: 'bg-emerald-500',
  connecting: 'bg-amber-500 animate-pulse',
  disconnected: 'bg-zinc-600',
} as const

export function ConnectionPanel() {
  const { url, password, status, error, liveSync, setUrl, setPassword, setLiveSync, connect, disconnect, forgetPassword, refreshInputs, refreshFilters, refreshShaderOverride } =
    useObsStore()
  const connected = status === 'connected'

  return (
    <Panel
      title="OBS Connection"
      actions={
        <span className="flex items-center gap-2 text-xs text-zinc-400">
          <span className={`h-2.5 w-2.5 rounded-full ${dot[status]}`} />
          {status}
        </span>
      }
    >
      <Field label="WebSocket URL">
        <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} disabled={connected} />
      </Field>
      <Field label="Password (if enabled)">
        <input
          className={inputClass}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={connected}
          autoComplete="current-password"
        />
      </Field>
      {password && (
        <p className="-mt-2 text-xs text-zinc-500">
          Saved in this browser; it reconnects automatically on load.{' '}
          <button className="underline hover:text-zinc-300" onClick={forgetPassword}>
            Forget password
          </button>
        </p>
      )}
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={liveSync} onChange={(e) => setLiveSync(e.target.checked)} />
        Live sync changes to OBS
      </label>
      {connected ? (
        <div className="flex gap-2">
          <button className={ghostButtonClass} onClick={() => void disconnect()}>
            Disconnect
          </button>
          <button
            className={ghostButtonClass}
            onClick={() => {
              void refreshInputs()
              const { shaderSource, shaderFilter } = usePresetStore.getState().current.targets
              void refreshFilters(shaderSource)
              void refreshShaderOverride(shaderSource, shaderFilter)
            }}
          >
            Refresh sources
          </button>
        </div>
      ) : (
        <button className={buttonClass} onClick={() => void connect()} disabled={status === 'connecting'}>
          Connect
        </button>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </Panel>
  )
}
