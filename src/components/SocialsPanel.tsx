import { useState } from 'react'
import { agoLabel } from '../lib/ago'
import { withSyncErrors } from '../lib/sync'
import { MAX_ITEMS, PLATFORMS, buildSocialsUrl, platformInfo } from '../lib/socials'
import { sendSocialsSettings } from '../lib/socialsBridge'
import { POPULAR_FONTS, TRANSITIONS, type Align } from '../lib/textEngine'
import { useObsStore } from '../store/useObsStore'
import { useSocialsStore } from '../store/useSocialsStore'
import { BrowserSourceUrl } from './BrowserSourceUrl'
import { ColorPicker } from './ColorPicker'
import { Field } from './Field'
import { Panel, ghostButtonClass, inputClass } from './Panel'
import { PreviewStage } from './PreviewStage'
import { Slider } from './Slider'
import { SocialsView } from './SocialsView'
import { Switch } from './Switch'

const STAGE_W = 1280
const STAGE_H = 160

export function SocialsPanel() {
  const { settings: s, lastAckAt, lastSentAt, updateStyle, updateRotator, addItem, updateItem, removeItem, moveItem, reset } =
    useSocialsStore()
  const connected = useObsStore((o) => o.status) === 'connected'
  const [platform, setPlatform] = useState('twitch')
  const aligns: Align[] = ['left', 'center', 'right']

  return (
    <Panel
      title="Socials"
      actions={
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span title="When the overlay last confirmed it received the settings">overlay: {agoLabel(lastAckAt)}</span>
          <button
            className={ghostButtonClass}
            disabled={!connected}
            onClick={() => void withSyncErrors(sendSocialsSettings())}
            title={lastSentAt ? 'Sent' : 'Send the settings to the overlay now'}
          >
            Send to overlay
          </button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              Platforms ({s.items.length}/{MAX_ITEMS})
            </span>
            <button className={ghostButtonClass} onClick={reset}>
              Reset
            </button>
          </div>

          <ul className="space-y-2" aria-label="Social platforms">
            {s.items.map((item, i) => (
              <li key={item.id} className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/60 p-2" data-testid="social-item">
                <div className="flex items-center gap-2">
                  <div className="w-32 shrink-0">
                    <select
                      className={inputClass}
                      aria-label="Platform"
                      value={item.platform}
                      onChange={(e) => updateItem(item.id, { platform: e.target.value })}
                    >
                      {PLATFORMS.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      className={inputClass}
                      aria-label="Handle"
                      placeholder="@handle"
                      value={item.handle}
                      onChange={(e) => updateItem(item.id, { handle: e.target.value })}
                    />
                  </div>
                  <button className={`${ghostButtonClass} shrink-0 px-2`} disabled={i === 0} onClick={() => moveItem(item.id, -1)} aria-label="Move up">
                    ↑
                  </button>
                  <button className={`${ghostButtonClass} shrink-0 px-2`} disabled={i === s.items.length - 1} onClick={() => moveItem(item.id, 1)} aria-label="Move down">
                    ↓
                  </button>
                  <button className={`${ghostButtonClass} shrink-0 px-2`} onClick={() => removeItem(item.id)} aria-label="Remove platform">
                    ✕
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className={inputClass}
                    aria-label="Label"
                    placeholder={`Label (default ${platformInfo(item.platform).label})`}
                    value={item.label}
                    onChange={(e) => updateItem(item.id, { label: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    aria-label="Custom icon"
                    placeholder="Custom icon: https image URL or emoji"
                    value={item.icon}
                    onChange={(e) => updateItem(item.id, { icon: e.target.value })}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <select className={inputClass} aria-label="Platform to add" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
            <button className={`${ghostButtonClass} shrink-0 whitespace-nowrap`} disabled={s.items.length >= MAX_ITEMS} onClick={() => addItem(platform)}>
              Add platform
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-400">
              Rotator <span className="text-zinc-600">(off: all platforms stacked)</span>
            </span>
            <Switch label={s.rotator.enabled ? 'On' : 'Off'} checked={s.rotator.enabled} onChange={(enabled) => updateRotator({ enabled })} />
          </div>
          {s.rotator.enabled && (
            <>
              <Slider label="Show each for" unit="ms" value={s.rotator.intervalMs} min={500} max={30000} step={100} onChange={(intervalMs) => updateRotator({ intervalMs })} />
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

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Google font">
              <select className={inputClass} value={s.style.fontFamily} onChange={(e) => updateStyle({ fontFamily: e.target.value })}>
                {(POPULAR_FONTS.includes(s.style.fontFamily) ? POPULAR_FONTS : [s.style.fontFamily, ...POPULAR_FONTS]).map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Align">
              <select className={inputClass} value={s.style.align} onChange={(e) => updateStyle({ align: e.target.value as Align })}>
                {aligns.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Slider label="Text size" unit="px" value={s.style.fontSize} min={12} max={200} onChange={(fontSize) => updateStyle({ fontSize })} />
          <Slider label="Icon size" unit="px" value={s.style.iconSize} min={12} max={200} onChange={(iconSize) => updateStyle({ iconSize })} />
          <Slider label="Icon–text gap" unit="px" value={s.style.gap} min={0} max={80} onChange={(gap) => updateStyle({ gap })} />
          <Slider label="Outline" unit="px" value={s.style.strokeWidth} min={0} max={20} onChange={(strokeWidth) => updateStyle({ strokeWidth })} />
          <ColorPicker label="Text color" value={s.style.color} onChange={(color) => updateStyle({ color })} />
          <ColorPicker label="Outline color" value={s.style.strokeColor} onChange={(strokeColor) => updateStyle({ strokeColor })} />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Switch label="Brand-colored icons" checked={s.style.iconColor === 'brand'} onChange={(on) => updateStyle({ iconColor: on ? 'brand' : 'text' })} />
            <Switch label="Show platform name" checked={s.style.showLabel} onChange={(showLabel) => updateStyle({ showLabel })} />
          </div>

          <div className="space-y-1">
            <span className="text-xs text-zinc-400">
              Preview ({STAGE_W}×{STAGE_H} Browser Source)
            </span>
            <PreviewStage width={STAGE_W} height={STAGE_H}>
              <SocialsView settings={s} />
            </PreviewStage>
          </div>

          <BrowserSourceUrl build={buildSocialsUrl}>
            In OBS add a <b>Browser Source</b> with this URL (<b>URL</b> option, not "Local file") and a size that fits the row,
            e.g. {STAGE_W}×{STAGE_H}. Platform logos are loaded from the simple-icons CDN, so the source needs internet access
            (or give a platform a custom icon URL or emoji).
          </BrowserSourceUrl>
        </div>
      </div>
    </Panel>
  )
}
