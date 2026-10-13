import { useRef, useState, type DragEvent } from 'react'
import { parseShaderUniforms, type ParsedShader } from '../lib/parseShader'
import { applyUniformSet } from '../lib/sync'

type Outcome = { file: string; parsed: ParsedShader } | { file: string; error: string }

/**
 * Drop (or pick) a .shader/.effect file: its `uniform` declarations replace the uniform list, each as the
 * right control. Changes then flow to OBS through the normal live sync.
 */
export function ShaderImport() {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const load = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed = parseShaderUniforms(await file.text())
      if (parsed.uniforms.length === 0) {
        setOutcome({
          file: file.name,
          error: 'No uniform float / int / bool / float4 declarations found in this file.',
        })
        return
      }
      applyUniformSet(parsed.uniforms)
      setOutcome({ file: file.name, parsed })
    } catch (e) {
      setOutcome({ file: file.name, error: e instanceof Error ? e.message : String(e) })
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    void load(e.dataTransfer.files[0])
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2 text-xs ${
          over ? 'border-violet-400 bg-violet-500/10 text-violet-200' : 'border-zinc-700 text-zinc-400'
        }`}
      >
        <span>Drop a .shader / .effect file here to build the controls from its uniforms</span>
        <button
          type="button"
          className="rounded-md border border-zinc-700 px-2.5 py-1 text-zinc-300 hover:bg-zinc-800"
          onClick={() => input.current?.click()}
        >
          Import shader…
        </button>
        <input
          ref={input}
          type="file"
          accept=".shader,.effect,.hlsl,.txt"
          aria-label="Import shader file"
          className="hidden"
          onChange={(e) => {
            void load(e.target.files?.[0])
            e.target.value = '' // allow re-importing the same file
          }}
        />
      </div>

      {outcome && 'error' in outcome && (
        <p role="alert" className="text-xs text-red-300">
          {outcome.file}: {outcome.error}
        </p>
      )}
      {outcome && 'parsed' in outcome && (
        <div className="space-y-1 text-xs text-zinc-400">
          <p>
            Imported {outcome.parsed.uniforms.length} uniform{outcome.parsed.uniforms.length === 1 ? '' : 's'} from{' '}
            <span className="font-mono text-zinc-300">{outcome.file}</span>.
          </p>
          {outcome.parsed.skipped.length > 0 && (
            <p className="text-zinc-500">No control for: {outcome.parsed.skipped.join(', ')}.</p>
          )}
          {outcome.parsed.warnings.map((w) => (
            <p key={w} className="text-amber-300">
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
