import { useEffect } from 'react'
import { hasBounds, POSITION_LIMIT, SCALE_LIMIT } from '../lib/layout'
import { editLayout, layoutScene, loadLayoutTarget, refreshLayoutItems, resetLayout } from '../lib/layoutSync'
import { useLayoutStore } from '../store/useLayoutStore'
import { useObsStore } from '../store/useObsStore'
import { Field } from './Field'
import { Panel, ghostButtonClass, inputClass } from './Panel'
import { Slider } from './Slider'
import { Switch } from './Switch'

export function LayoutPanel() {
  const { status, scenes, currentScene } = useObsStore()
  const { scene, source, lockAspect, items, target, transform, info, error, setScene, setSource, setLockAspect } = useLayoutStore()
  const connected = status === 'connected'
  const activeScene = scene || currentScene || ''

  // Load the scene's items whenever the scene (or connection) changes, then the chosen source's transform.
  useEffect(() => {
    if (!connected) return
    void refreshLayoutItems().then(loadLayoutTarget)
  }, [connected, activeScene])

  const pick = (name: string) => {
    setSource(name)
    void loadLayoutTarget()
  }

  return (
    <Panel
      title="Layout"
      actions={
        <button className={ghostButtonClass} disabled={!connected} onClick={() => void refreshLayoutItems().then(loadLayoutTarget)}>
          Refresh
        </button>
      }
    >
      <p className="text-xs text-zinc-500">
        Move, scale and rotate a source in a scene without unlocking it in OBS. Edits are sent live.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Scene">
          <select className={inputClass} value={scene} disabled={!connected} onChange={(e) => setScene(e.target.value)}>
            <option value="">Follow program scene{currentScene ? ` (${currentScene})` : ''}</option>
            {scenes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Source">
          <select className={`${inputClass} ${connected && !source ? 'border-amber-500' : ''}`} value={source} disabled={!connected} onChange={(e) => pick(e.target.value)}>
            <option value="">Pick a source…</option>
            {source && !items.some((i) => i.sourceName === source) && <option value={source}>{source} (not in this scene)</option>}
            {items.map((i) => (
              <option key={i.sceneItemId} value={i.sourceName}>
                {i.sourceName}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {transform && target ? (
        <div className="space-y-4" data-testid="layout-controls">
          <div className="grid gap-3 sm:grid-cols-2">
            <Slider label="X position" unit="px" value={round(transform.positionX)} min={-3840} max={7680} onChange={(positionX) => editLayout({ positionX })} />
            <Slider label="Y position" unit="px" value={round(transform.positionY)} min={-2160} max={4320} onChange={(positionY) => editLayout({ positionY })} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Scale</span>
            <Switch label="Lock aspect" checked={lockAspect} onChange={setLockAspect} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Slider label="Scale X" value={round(transform.scaleX, 3)} min={-4} max={4} step={0.01} onChange={(scaleX) => editLayout({ scaleX })} />
            <Slider label="Scale Y" value={round(transform.scaleY, 3)} min={-4} max={4} step={0.01} onChange={(scaleY) => editLayout({ scaleY })} />
          </div>
          <Slider label="Rotation" unit="°" value={round(transform.rotation, 1)} min={0} max={360} step={0.5} onChange={(rotation) => editLayout({ rotation })} />
          {info && (
            <p className="text-xs text-zinc-500">
              Source {round(info.sourceWidth)}×{round(info.sourceHeight)} → shown at {round(info.width)}×{round(info.height)}.
              Positions are in canvas pixels, limits ±{POSITION_LIMIT.toLocaleString()} px and ±{SCALE_LIMIT}×.
            </p>
          )}
          {hasBounds(info) && (
            <p className="rounded-md border border-amber-900 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
              This item has a bounding box ({info?.boundsType.replace('OBS_BOUNDS_', '').toLowerCase()}); OBS sizes it from the
              box, so the scale values may not change how big it looks. Set the bounds type to "No bounds" in OBS's Edit
              Transform to scale it here.
            </p>
          )}
          <button className={ghostButtonClass} onClick={resetLayout}>
            Reset to the values when loaded
          </button>
        </div>
      ) : (
        connected && source && !error && <p className="text-xs text-zinc-500">Loading “{source}” from “{layoutScene()}”…</p>
      )}
      {!connected && <p className="text-xs text-zinc-500">Connect to OBS to edit a source's layout.</p>}
    </Panel>
  )
}

/** Display rounding so float noise (0.30000000000000004) doesn't show in the number boxes. */
function round(v: number, digits = 0): number {
  const f = 10 ** digits
  return Math.round(v * f) / f
}
