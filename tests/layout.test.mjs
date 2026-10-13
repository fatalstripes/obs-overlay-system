import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MIN_SCALE, POSITION_LIMIT, SCALE_LIMIT, buildTransformPayload, hasBounds, normalizeRotation, parseTransform, sameTransform, withRenderedSize,
} from '../src/lib/layout.ts'

test('buildTransformPayload keeps only valid numbers and leaves the rest out', () => {
  assert.deepEqual(buildTransformPayload({ positionX: 10, positionY: '5', scaleX: NaN, scaleY: undefined, rotation: null }), { positionX: 10 })
  assert.deepEqual(buildTransformPayload({}), {})
  assert.deepEqual(buildTransformPayload({ positionX: 0, rotation: 0 }), { positionX: 0, rotation: 0 }, 'real zeros are kept')
})

test('values are clamped to sane ranges', () => {
  const p = buildTransformPayload({ positionX: 1e12, positionY: -1e12, scaleX: 1e6, scaleY: -1e6 })
  assert.equal(p.positionX, POSITION_LIMIT)
  assert.equal(p.positionY, -POSITION_LIMIT)
  assert.equal(p.scaleX, SCALE_LIMIT)
  assert.equal(p.scaleY, -SCALE_LIMIT)
})

test('a scale of zero can never be sent (the item would vanish), and a negative flip keeps its sign', () => {
  assert.equal(buildTransformPayload({ scaleX: 0 }).scaleX, MIN_SCALE)
  assert.equal(buildTransformPayload({ scaleX: -0.0001 }).scaleX, -MIN_SCALE)
  assert.equal(buildTransformPayload({ scaleY: -2 }).scaleY, -2)
})

test('rotation wraps into [0, 360)', () => {
  assert.equal(normalizeRotation(360), 0)
  assert.equal(normalizeRotation(-90), 270)
  assert.equal(normalizeRotation(725), 5)
  assert.equal(buildTransformPayload({ rotation: -10 }).rotation, 350)
})

test('parseTransform reads OBS\'s sceneItemTransform', () => {
  const raw = { positionX: 12, positionY: 34, rotation: -90, scaleX: 2, scaleY: 3, sourceWidth: 100, sourceHeight: 50, width: 200, height: 150, boundsType: 'OBS_BOUNDS_STRETCH', cropLeft: 1 }
  const { transform, info } = parseTransform(raw)
  assert.deepEqual(transform, { positionX: 12, positionY: 34, rotation: 270, scaleX: 2, scaleY: 3 })
  assert.deepEqual(info, { sourceWidth: 100, sourceHeight: 50, width: 200, height: 150, boundsType: 'OBS_BOUNDS_STRETCH' })
})

test('parseTransform rejects data it cannot use', () => {
  assert.equal(parseTransform(null), null)
  assert.equal(parseTransform('x'), null)
  assert.equal(parseTransform({ positionX: 1, positionY: 2, scaleX: 'a', scaleY: 1 }), null)
  assert.equal(parseTransform({ positionX: 1, positionY: 2, scaleX: 1 }), null)
  assert.equal(parseTransform({ positionX: Infinity, positionY: 2, scaleX: 1, scaleY: 1 }), null)
})

test('missing optional fields get neutral defaults', () => {
  const { transform, info } = parseTransform({ positionX: 1, positionY: 2, scaleX: 1, scaleY: 1 })
  assert.equal(transform.rotation, 0)
  assert.equal(info.boundsType, 'OBS_BOUNDS_NONE')
  assert.equal(hasBounds(info), false)
})

test('hasBounds / sameTransform', () => {
  assert.equal(hasBounds({ boundsType: 'OBS_BOUNDS_SCALE_INNER' }), true)
  assert.equal(hasBounds(null), false)
  const t = { positionX: 1, positionY: 2, scaleX: 1, scaleY: 1, rotation: 0 }
  assert.equal(sameTransform(t, { ...t }), true)
  assert.equal(sameTransform(t, { ...t, rotation: 1 }), false)
})

test('withRenderedSize follows the scale, except for items with bounds', () => {
  const info = { sourceWidth: 400, sourceHeight: 200, width: 400, height: 200, boundsType: 'OBS_BOUNDS_NONE' }
  const t = { positionX: 0, positionY: 0, scaleX: -2, scaleY: 0.5, rotation: 0 }
  assert.deepEqual(withRenderedSize(info, t), { ...info, width: 800, height: 100 }, 'flipped scale still has a positive size')
  const bounded = { ...info, boundsType: 'OBS_BOUNDS_STRETCH', width: 1000, height: 500 }
  assert.deepEqual(withRenderedSize(bounded, t), bounded)
})
