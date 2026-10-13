import { useState } from 'react'
import { agoLabel } from '../lib/ago'
import { sendTextSettings } from '../lib/textBridge'
import { withSyncErrors } from '../lib/sync'
import { buildOverlayUrl, POPULAR_FONTS, TRANSITIONS, isFontFamily, type Align } from '../lib/textEngine'
import { useObsStore } from '../store/useObsStore'
import { usePresetStore } from '../store/usePresetStore'
import { useTextEngineStore } from '../store/useTextEngineStore'
import { ColorPicker } from './ColorPicker'
import { Field } from './Field'
import { Panel, ghostButtonClass, inputClass } from './Panel'
import { Slider } from './Slider'
import { Switch } from './Switch'
import { BrowserSourceUrl } from './BrowserSourceUrl'
import { PreviewStage } from './PreviewStage'
import { TextEngineView } from './TextEngineView'

const STAGE_W = 1280
const STAGE_H = 240

/** Says where an edit goes right now: into the live scene's preset, or just the shared overlay. */
function SceneContext() {
  const { status, currentScene } = useObsStore()
  const { presets, sceneBindings, sceneAutoApply } = usePresetStore()
  const autoSave = useTextEngineStore((s) => s.autoSaveToScene)
  const setAutoSave = useTextEngineStore((s) => s.setAutoSaveToScene)
  if (status !== 'connected' || !currentScene) return null

  const preset = presets.find((p) => p.id === sceneBindings[currentScene])
  let body: string
  if (!sceneAutoApply) {
    body = 'Scene auto-apply is off, so edits only change the live overlay (shared by every scene).'
  } else if (!preset) {
    body = `Scene “${currentScene}” has no preset. Edits change the overlay for every scene. Save a preset and bind it to this scene (Scene Presets) to give the scene its own text.`
  } else if (autoSave) {
    body = `Editing scene “${currentScene}”: changes are saved into its preset “${preset.name}”, so other scenes keep their own text.`
  } else {
    body = `Auto-save is off: edits change the live overlay for every scene and are not saved into “${preset.name}”.`
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
      <span>{body}</span>
      {sceneAutoApply && preset && (
        <Switch label="Auto-save" checked={autoSave} onChange={setAutoSave} />
      )}
    </div>
  )
}

const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900]
const OTHER = '__other__'

export function CustomTextPanel() {
  const store = useTextEngineStore()
  const { settings: s, update, updateGradient, updateRotator, lastAckAt, lastSentAt } = store
  const { status } = useObsStore()
  const connected = status === 'connected'

  const [customFont, setCustomFont] = useState(!POPULAR_FONTS.includes(s.fontFamily))
  const [fontDraft, setFontDraft] = useState(s.fontFamily)

  const aligns: Align[] = ['left', 'center', 'right']

  return (
    <Panel
      title="Custom ProText"
      actions={
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span title="When the overlay last confirmed it received the settings">overlay: {agoLabel(lastAckAt)}</span>
          <button
            className={ghostButtonClass}
            disabled={!connected}
            onClick={() => void withSyncErrors(sendTextSettings())}
            title={lastSentAt ? 'Sent' : 'Send the settings to the overlay now'}
          >
            Send to overlay
          </button>
        </div>
      }
    >
      <SceneContext />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Google font">
              <select
                className={inputClass}
                value={customFont ? OTHER : s.fontFamily}
                onChange={(e) => {
                  if (e.target.value === OTHER) setCustomFont(true)
                  else {
                    setCustomFont(false)
                    update({ fontFamily: e.target.value })
                  }
                }}
              >
                {POPULAR_FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
                <option value={OTHER}>Other…</option>
              </select>
            </Field>
            <Field label="Weight">
              <select className={inputClass} value={s.fontWeight} onChange={(e) => update({ fontWeight: Number(e.target.value) })}>
                {WEIGHTS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {customFont && (
            <Field label="Any Google Fonts family name (exact spelling)">
              <input
                className={`${inputClass} ${isFontFamily(fontDraft) ? '' : 'border-amber-500'}`}
                value={fontDraft}
                placeholder="e.g. Rubik Glitch"
                onChange={(e) => {
                  setFontDraft(e.target.value)
                  if (isFontFamily(e.target.value)) update({ fontFamily: e.target.value.trim() })
                }}
              />
            </Field>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-400">Italic</span>
            <Switch label={s.italic ? 'On' : 'Off'} checked={s.italic} onChange={(italic) => update({ italic })} />
          </div>
          <Slider label="Font size" unit="px" value={s.fontSize} min={8} max={400} onChange={(fontSize) => update({ fontSize })} />
          <Slider label="Letter spacing" unit="px" value={s.letterSpacing} min={-10} max={60} onChange={(letterSpacing) => update({ letterSpacing })} />

          <div className="space-y-1">
            <span className="text-xs text-zinc-400">Alignment</span>
            <div className="flex gap-1.5">
              {aligns.map((a) => (
                <button
                  key={a}
                  onClick={() => update({ align: a })}
                  className={`rounded-md px-3 py-1 text-xs capitalize ${s.align === a ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 border-t border-zinc-800 pt-4">
            <div className="flex gap-1.5">
              {(['solid', 'gradient'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => update({ fillMode: m })}
                  className={`rounded-md px-3 py-1 text-xs capitalize ${s.fillMode === m ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                >
                  {m} fill
                </button>
              ))}
            </div>
            {s.fillMode === 'solid' ? (
              <ColorPicker label="Text color" value={s.color.slice(0, 7)} onChange={(color) => update({ color })} />
            ) : (
              <>
                <ColorPicker label="Gradient from" value={s.gradient.from.slice(0, 7)} onChange={(from) => updateGradient({ from })} />
                <ColorPicker label="Gradient to" value={s.gradient.to.slice(0, 7)} onChange={(to) => updateGradient({ to })} />
                <Slider label="Gradient angle" unit="°" value={s.gradient.angle} min={0} max={360} onChange={(angle) => updateGradient({ angle })} />
              </>
            )}
            <Slider label="Stroke width" unit="px" value={s.strokeWidth} min={0} max={30} step={0.5} onChange={(strokeWidth) => update({ strokeWidth })} />
            <ColorPicker label="Stroke color" value={s.strokeColor.slice(0, 7)} onChange={(strokeColor) => update({ strokeColor })} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <span className="text-xs text-zinc-400">Text lines ({s.lines.length})</span>
            {s.lines.map((line, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  className={inputClass}
                  value={line}
                  aria-label={`Line ${i + 1}`}
                  onChange={(e) => store.setLine(i, e.target.value)}
                />
                <button className={ghostButtonClass} onClick={() => store.moveLine(i, -1)} disabled={i === 0} aria-label={`Move line ${i + 1} up`}>
                  ↑
                </button>
                <button className={ghostButtonClass} onClick={() => store.moveLine(i, 1)} disabled={i === s.lines.length - 1} aria-label={`Move line ${i + 1} down`}>
                  ↓
                </button>
                <button className="px-1 text-zinc-600 hover:text-red-400" onClick={() => store.removeLine(i)} aria-label={`Remove line ${i + 1}`}>
                  ✕
                </button>
              </div>
            ))}
            <button className={ghostButtonClass} onClick={store.addLine}>
              Add line
            </button>
          </div>

          <div className="space-y-3 border-t border-zinc-800 pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-400">
                Rotator <span className="text-zinc-600">(off: all lines stacked)</span>
              </span>
              <Switch label={s.rotator.enabled ? 'On' : 'Off'} checked={s.rotator.enabled} onChange={(enabled) => updateRotator({ enabled })} />
            </div>
            {s.rotator.enabled && (
              <>
                <Slider label="Show each line for" unit="ms" value={s.rotator.intervalMs} min={300} max={20000} step={100} onChange={(intervalMs) => updateRotator({ intervalMs })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Transition">
                    <select className={inputClass} value={s.rotator.transition} onChange={(e) => updateRotator({ transition: e.target.value as typeof s.rotator.transition })}>
                      {TRANSITIONS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Order">
                    <select className={inputClass} value={s.rotator.order} onChange={(e) => updateRotator({ order: e.target.value as typeof s.rotator.order })}>
                      <option value="sequential">Sequential</option>
                      <option value="random">Random</option>
                    </select>
                  </Field>
                </div>
                <Slider label="Transition time" unit="ms" value={s.rotator.transitionMs} min={0} max={2000} step={50} onChange={(transitionMs) => updateRotator({ transitionMs })} />
              </>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-xs text-zinc-400">Preview ({STAGE_W}×{STAGE_H} Browser Source)</span>
            <PreviewStage width={STAGE_W} height={STAGE_H}>
              <TextEngineView settings={s} />
            </PreviewStage>
          </div>

          <BrowserSourceUrl build={buildOverlayUrl}>
            In OBS add a <b>Browser Source</b> with this URL (<b>URL</b> option, not "Local file"), a width and height that
            fit your text, and no custom CSS. The overlay connects to OBS's WebSocket by itself and updates as you edit.
          </BrowserSourceUrl>
        </div>
      </div>
    </Panel>
  )
}
