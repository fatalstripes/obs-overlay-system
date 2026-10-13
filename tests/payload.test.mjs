import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildFilterSettings, sanitizeUniforms } from '../src/lib/payload.ts'

const f = (name, value) => ({ kind: 'float', name, value, min: 0, max: 10, step: 0.1 })

test('sends each type in OBS wire format: float number, int integer, bool boolean, color ABGR', () => {
  assert.deepEqual(
    buildFilterSettings([
      f('speed', 2.5),
      { kind: 'int', name: 'steps', value: 8.6, min: 0, max: 20, step: 1 },
      { kind: 'bool', name: 'invert', value: true },
      { kind: 'color', name: 'tint', value: '#ff0000' },
    ]),
    { speed: 2.5, steps: 9, invert: true, tint: 0xff0000ff },
  )
})

test('drops uniforms without a usable value instead of zero-filling them', () => {
  const settings = buildFilterSettings([
    f('ok', 1),
    f('undef', undefined),
    f('nan', Number.NaN),
    f('inf', Number.POSITIVE_INFINITY),
    f('str', '3'),
    { kind: 'bool', name: 'notbool', value: 1 },
    { kind: 'int', name: 'badint', value: null },
    { kind: 'color', name: 'badcolor', value: 'red' },
    { kind: 'color', name: 'shortcolor', value: '#fff' },
    { kind: 'mystery', name: 'weird', value: 5 },
    f('', 1),
    undefined,
  ])
  assert.deepEqual(settings, { ok: 1 })
})

test('a legitimate zero / false / black is kept (only missing values are dropped)', () => {
  assert.deepEqual(
    buildFilterSettings([
      f('zero', 0),
      { kind: 'bool', name: 'off', value: false },
      { kind: 'color', name: 'black', value: '#000000' },
    ]),
    { zero: 0, off: false, black: 0xff000000 },
  )
})

test('an empty or fully invalid list gives an empty payload', () => {
  assert.deepEqual(buildFilterSettings([]), {})
  assert.deepEqual(buildFilterSettings([f('a', undefined)]), {})
})

test('sanitizeUniforms removes unsendable entries and later duplicates, keeping order', () => {
  const out = sanitizeUniforms([f('a', 1), f('b', undefined), f('a', 9), f('c', 3), { kind: 'bool', name: 'd', value: false }])
  assert.deepEqual(out.map((u) => [u.name, u.value]), [['a', 1], ['c', 3], ['d', false]])
})
