import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { useLayoutStore } from '../src/store/useLayoutStore.ts'

const store = useLayoutStore
const target = { scene: 'Gameplay', sceneItemId: 2 }
const t0 = { positionX: 100, positionY: 50, scaleX: 2, scaleY: 1, rotation: 0 }
const info = { sourceWidth: 400, sourceHeight: 200, width: 800, height: 200, boundsType: 'OBS_BOUNDS_NONE' }

beforeEach(() => {
  store.setState({ scene: '', source: '', lockAspect: true, items: [], target: null, transform: null, original: null, info: null, error: null })
})

test('edit does nothing until a target is loaded', () => {
  assert.deepEqual(store.getState().edit({ positionX: 5 }), {})
  assert.equal(store.getState().transform, null)
})

test('edit updates the shown transform and returns only the validated fields to send', () => {
  store.getState().load(target, t0, info)
  store.getState().setLockAspect(false)
  const applied = store.getState().edit({ positionX: 300, rotation: -90, positionY: NaN })
  assert.deepEqual(applied, { positionX: 300, rotation: 270 })
  assert.deepEqual(store.getState().transform, { ...t0, positionX: 300, rotation: 270 })
  assert.deepEqual(store.getState().original, t0, 'original is untouched')
})

test('aspect lock: changing scale X scales Y in proportion (and the other way round)', () => {
  store.getState().load(target, t0, info) // ratio Y/X = 0.5
  const a = store.getState().edit({ scaleX: 4 })
  assert.deepEqual(a, { scaleX: 4, scaleY: 2 })
  const b = store.getState().edit({ scaleY: 1 })
  assert.deepEqual(b, { scaleY: 1, scaleX: 2 })
})

test('aspect lock off: axes are independent', () => {
  store.getState().load(target, t0, info)
  store.getState().setLockAspect(false)
  assert.deepEqual(store.getState().edit({ scaleX: 4 }), { scaleX: 4 })
  assert.equal(store.getState().transform.scaleY, 1)
})

test('aspect lock: when both axes are given they are used as they are', () => {
  store.getState().load(target, t0, info)
  assert.deepEqual(store.getState().edit({ scaleX: 3, scaleY: 3 }), { scaleX: 3, scaleY: 3 })
})

test('resetToOriginal restores the loaded values and returns them to send', () => {
  store.getState().load(target, t0, info)
  store.getState().edit({ positionX: 999 })
  assert.deepEqual(store.getState().resetToOriginal(), t0)
  assert.deepEqual(store.getState().transform, t0)
})

test('receive applies OBS-side changes to the loaded item only', () => {
  store.getState().load(target, t0, info)
  store.getState().receive({ scene: 'Gameplay', sceneItemId: 99 }, { ...t0, positionX: 1 })
  assert.equal(store.getState().transform.positionX, 100, 'other item ignored')
  store.getState().receive({ scene: 'Intro', sceneItemId: 2 }, { ...t0, positionX: 1 })
  assert.equal(store.getState().transform.positionX, 100, 'other scene ignored')
  store.getState().receive(target, { ...t0, positionX: 1 })
  assert.equal(store.getState().transform.positionX, 1)
})

test('changing the scene or source drops the loaded target', () => {
  store.getState().load(target, t0, info)
  store.getState().setSource('Logo')
  assert.equal(store.getState().target, null)
  assert.equal(store.getState().transform, null)
  store.getState().load(target, t0, info)
  store.getState().setItems([{ sceneItemId: 1, sourceName: 'x', inputKind: null, isGroup: false }])
  store.getState().setScene('Intro')
  assert.deepEqual(store.getState().items, [])
  assert.equal(store.getState().source, '')
  assert.equal(store.getState().target, null)
})

test('the shown size follows edits and Reset (unless the item has bounds)', () => {
  store.getState().load(target, t0, { ...info, width: 800 })
  store.getState().setLockAspect(false)
  store.getState().edit({ scaleX: 1, scaleY: 3 })
  assert.equal(store.getState().info.width, 400)
  assert.equal(store.getState().info.height, 600)
  store.getState().resetToOriginal()
  assert.equal(store.getState().info.width, 800)
  assert.equal(store.getState().info.height, 200)

  store.getState().load(target, t0, { ...info, boundsType: 'OBS_BOUNDS_STRETCH', width: 1000, height: 500 })
  store.getState().edit({ scaleX: 9 })
  assert.equal(store.getState().info.width, 1000)
})
