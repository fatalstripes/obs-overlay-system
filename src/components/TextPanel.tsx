import { pushText, withSyncErrors } from '../lib/sync'
import type { TextKind } from '../store/types'
import { useObsStore } from '../store/useObsStore'
import { usePresetStore } from '../store/usePresetStore'
import { ColorPicker } from './ColorPicker'
import { Field } from './Field'
import { NamePicker } from './NamePicker'
import { Panel, ghostButtonClass, inputClass } from './Panel'
import { Slider } from './Slider'

export function TextPanel() {
  const { current, setTargets, setText } = usePresetStore()
  const { inputs, status } = useObsStore()
  const { text } = current
  const connected = status === 'connected'
  const isFreeType = current.targets.textKind === 'text_ft2_source'

  return (
    <Panel
      title="Text Style"
      actions={
        <button className={ghostButtonClass} disabled={!connected} onClick={() => void withSyncErrors(pushText(current))}>
          Push now
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Text source">
          <NamePicker
            value={current.targets.textSource}
            options={inputs}
            onChange={(v) => setTargets({ textSource: v })}
            placeholder="Text source name"
          />
        </Field>
        <Field label="Source type">
          <select
            className={inputClass}
            value={current.targets.textKind}
            onChange={(e) => setTargets({ textKind: e.target.value as TextKind })}
          >
            <option value="text_gdiplus">Text (GDI+)</option>
            <option value="text_ft2_source">Text (FreeType 2)</option>
          </select>
        </Field>
      </div>

      <Field label="Content">
        <textarea
          className={inputClass}
          rows={2}
          value={text.text}
          onChange={(e) => setText({ text: e.target.value })}
        />
      </Field>
      <Field label="Font face">
        <input className={inputClass} value={text.fontFace} onChange={(e) => setText({ fontFace: e.target.value })} />
      </Field>
      <Slider label="Font size" unit="px" value={text.fontSize} min={8} max={400} onChange={(v) => setText({ fontSize: v })} />
      <Slider label="Opacity" unit="%" value={text.opacity} min={0} max={100} onChange={(v) => setText({ opacity: v })} />
      <ColorPicker label="Text color" value={text.color} onChange={(v) => setText({ color: v })} />
      {isFreeType ? (
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={text.outlineSize > 0}
              onChange={(e) => setText({ outlineSize: e.target.checked ? 4 : 0 })}
            />
            Outline
          </label>
          <p className="text-xs text-zinc-500">
            FreeType 2 only supports a black outline that is either on or off, so outline color and size are not
            available. Use a GDI+ text source for a custom outline.
          </p>
        </div>
      ) : (
        <>
          <Slider label="Outline size" unit="px" value={text.outlineSize} min={0} max={20} onChange={(v) => setText({ outlineSize: v })} />
          <ColorPicker label="Outline color" value={text.outlineColor} onChange={(v) => setText({ outlineColor: v })} />
        </>
      )}
    </Panel>
  )
}
