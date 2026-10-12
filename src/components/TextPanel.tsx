import { pushText } from '../lib/sync'
import type { TextKind } from '../store/types'
import { useObsStore } from '../store/useObsStore'
import { usePresetStore } from '../store/usePresetStore'
import { ColorPicker } from './ColorPicker'
import { Field } from './Field'
import { Panel, ghostButtonClass, inputClass } from './Panel'
import { Slider } from './Slider'

export function TextPanel() {
  const { current, setTargets, setText } = usePresetStore()
  const { inputs, status } = useObsStore()
  const { text } = current
  const connected = status === 'connected'

  return (
    <Panel
      title="Text Style"
      actions={
        <button className={ghostButtonClass} disabled={!connected} onClick={() => void pushText(current)}>
          Push now
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Text source">
          <input
            className={inputClass}
            list="obs-inputs"
            value={current.targets.textSource}
            onChange={(e) => setTargets({ textSource: e.target.value })}
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
      <datalist id="obs-inputs">{inputs.map((i) => <option key={i} value={i} />)}</datalist>

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
      <Slider label="Outline size" unit="px" value={text.outlineSize} min={0} max={20} onChange={(v) => setText({ outlineSize: v })} />
      <ColorPicker label="Text color" value={text.color} onChange={(v) => setText({ color: v })} />
      <ColorPicker label="Outline color" value={text.outlineColor} onChange={(v) => setText({ outlineColor: v })} />
    </Panel>
  )
}
