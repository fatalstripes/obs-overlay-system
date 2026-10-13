import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { DEFAULT_SETTINGS, isDefaultSettings } from '../src/lib/textEngine.ts'
import { usePresetStore } from '../src/store/usePresetStore.ts'

const store = usePresetStore
const fancy = { ...DEFAULT_SETTINGS, fontFamily: 'Bebas Neue', lines: ['One', 'Two'], strokeWidth: 9 }

beforeEach(() => store.setState({ presets: [], activePresetId: null, sceneBindings: {}, sceneAutoApply: true }))

test('a preset saved with Custom ProText settings carries a validated copy', () => {
  store.getState().savePreset('A', { ...fancy, fontSize: 1e9, fontFamily: 'x&y' })
  const [p] = store.getState().presets
  assert.equal(p.name, 'A')
  assert.equal(p.textEngine.fontSize, 600, 'clamped')
  assert.equal(p.textEngine.fontFamily, DEFAULT_SETTINGS.fontFamily, 'bad font name rejected')
  assert.deepEqual(p.textEngine.lines, ['One', 'Two'])
})

test('the saved snapshot is a copy: later edits to the live settings do not change the preset', () => {
  const live = structuredClone(fancy)
  store.getState().savePreset('A', live)
  live.lines.push('Three')
  live.rotator.enabled = true
  assert.deepEqual(store.getState().presets[0].textEngine.lines, ['One', 'Two'])
  assert.equal(store.getState().presets[0].textEngine.rotator.enabled, false)
})

test('a preset saved without them has no textEngine key (applying it leaves the overlay alone)', () => {
  store.getState().savePreset('Plain')
  assert.equal('textEngine' in store.getState().presets[0], false)
})

test('same name overwrites the whole preset, and can drop or add the ProText snapshot', () => {
  store.getState().savePreset('A', fancy)
  const id = store.getState().presets[0].id
  store.getState().savePreset('A') // saved again without ProText
  assert.equal(store.getState().presets.length, 1)
  assert.equal(store.getState().presets[0].id, id, 'same preset, same id')
  assert.equal('textEngine' in store.getState().presets[0], false)
  store.getState().savePreset('A', { ...fancy, lines: ['Back'] })
  assert.deepEqual(store.getState().presets[0].textEngine.lines, ['Back'])
})

test('presets from before the text engine existed (no textEngine) still load', () => {
  store.setState({ presets: [{ id: 'old', name: 'Old', values: store.getState().current }] })
  store.getState().loadPreset('old')
  assert.equal(store.getState().activePresetId, 'old')
})

test('deleting a preset removes its scene bindings; renames keep them', () => {
  store.getState().savePreset('A', fancy)
  store.getState().savePreset('B')
  const [a, b] = store.getState().presets
  store.getState().bindScene('Gameplay', a.id)
  store.getState().bindScene('BRB', b.id)
  store.getState().renameScene('Gameplay', 'Gameplay 2')
  assert.deepEqual(store.getState().sceneBindings, { 'Gameplay 2': a.id, BRB: b.id })
  store.getState().deletePreset(a.id)
  assert.deepEqual(store.getState().sceneBindings, { BRB: b.id })
  store.getState().bindScene('BRB', null)
  assert.deepEqual(store.getState().sceneBindings, {})
})

test('isDefaultSettings: the factory defaults (even unvalidated copies) are default, any change is not', () => {
  assert.equal(isDefaultSettings(DEFAULT_SETTINGS), true)
  assert.equal(isDefaultSettings(structuredClone(DEFAULT_SETTINGS)), true)
  assert.equal(isDefaultSettings({ ...DEFAULT_SETTINGS, lines: ['x'] }), false)
  assert.equal(isDefaultSettings({ ...DEFAULT_SETTINGS, rotator: { ...DEFAULT_SETTINGS.rotator, enabled: true } }), false)
})
