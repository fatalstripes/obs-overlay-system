import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { DEFAULT_SETTINGS, MAX_LINES } from '../src/lib/textEngine.ts'
import { usePresetStore } from '../src/store/usePresetStore.ts'
import { useTextEngineStore } from '../src/store/useTextEngineStore.ts'

const te = useTextEngineStore
const presets = usePresetStore

beforeEach(() => {
  te.setState({ settings: DEFAULT_SETTINGS, editSeq: 0, autoSaveToScene: true })
  presets.setState({ presets: [], activePresetId: null, sceneBindings: {} })
})

test('every kind of panel edit counts as a user edit', () => {
  const s = te.getState()
  s.update({ fontSize: 100 })
  s.updateGradient({ angle: 10 })
  s.updateRotator({ enabled: true })
  s.setLine(0, 'x')
  s.addLine()
  s.moveLine(1, -1)
  s.removeLine(1)
  s.reset()
  assert.equal(te.getState().editSeq, 8)
})

test('settings loaded from a preset are not an edit (so they are never auto-saved back)', () => {
  te.getState().setSettings({ ...DEFAULT_SETTINGS, lines: ['From preset'] })
  assert.equal(te.getState().editSeq, 0)
  assert.deepEqual(te.getState().settings.lines, ['From preset'])
})

test('edits that change nothing are not counted', () => {
  te.getState().moveLine(0, -1) // already first
  te.getState().moveLine(0, 1) // only one line
  te.setState({ settings: { ...DEFAULT_SETTINGS, lines: Array.from({ length: MAX_LINES }, () => 'a') } })
  te.getState().addLine() // at the cap
  assert.equal(te.getState().editSeq, 0)
})

test('auto-save is on by default', () => {
  assert.equal(te.getState().autoSaveToScene, true)
  te.getState().setAutoSaveToScene(false)
  assert.equal(te.getState().autoSaveToScene, false)
})

test('setPresetTextEngine replaces only the snapshot, validated, and skips no-op writes', () => {
  presets.getState().savePreset('A', { ...DEFAULT_SETTINGS, lines: ['one'] })
  presets.getState().savePreset('B')
  const [a, b] = presets.getState().presets
  const before = presets.getState().presets

  presets.getState().setPresetTextEngine(a.id, { ...DEFAULT_SETTINGS, lines: ['two'], fontSize: 1e9, fontFamily: 'x&y' })
  const after = presets.getState().presets
  assert.deepEqual(after[0].textEngine.lines, ['two'])
  assert.equal(after[0].textEngine.fontSize, 600)
  assert.equal(after[0].textEngine.fontFamily, DEFAULT_SETTINGS.fontFamily)
  assert.deepEqual(after[0].values, a.values, 'native values untouched')
  assert.equal(after[1], b, 'other presets untouched (same object)')

  presets.getState().setPresetTextEngine(a.id, after[0].textEngine) // identical: no write
  assert.equal(presets.getState().presets, after, 'no new array for an unchanged snapshot')
  presets.getState().setPresetTextEngine('nope', DEFAULT_SETTINGS)
  assert.equal(presets.getState().presets, after, 'unknown id ignored')

  presets.getState().setPresetTextEngine(b.id, { ...DEFAULT_SETTINGS, lines: ['b'] }) // adds a snapshot to a plain preset
  assert.deepEqual(presets.getState().presets[1].textEngine.lines, ['b'])
  assert.notEqual(before, presets.getState().presets)
})
