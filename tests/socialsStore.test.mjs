import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { DEFAULT_SOCIALS, MAX_ITEMS } from '../src/lib/socials.ts'
import { useSocialsStore } from '../src/store/useSocialsStore.ts'

const store = useSocialsStore
const handles = () => store.getState().settings.items.map((i) => i.handle)

beforeEach(() => store.setState({ settings: DEFAULT_SOCIALS, lastAckAt: null, lastSentAt: null }))

test('addItem appends a blank item of that platform and returns its id', () => {
  const id = store.getState().addItem('kick')
  const items = store.getState().settings.items
  assert.equal(items.length, DEFAULT_SOCIALS.items.length + 1)
  assert.deepEqual(items.at(-1), { id, platform: 'kick', handle: '', label: '', icon: '' })
})

test('addItem defaults to a custom platform and falls back for unknown ones', () => {
  store.getState().addItem()
  store.getState().addItem('myspace')
  assert.deepEqual(store.getState().settings.items.slice(-2).map((i) => i.platform), ['custom', 'custom'])
})

test('added items get distinct ids', () => {
  store.getState().addItem('x')
  store.getState().addItem('x')
  const ids = store.getState().settings.items.map((i) => i.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('addItem refuses past the cap', () => {
  while (store.getState().settings.items.length < MAX_ITEMS) store.getState().addItem('x')
  assert.equal(store.getState().addItem('x'), null)
  assert.equal(store.getState().settings.items.length, MAX_ITEMS)
})

test('updateItem edits one item, validated, and never changes its id', () => {
  const [a, b] = store.getState().settings.items
  store.getState().updateItem(a.id, { handle: '@new', platform: 'myspace', icon: 'javascript:1', id: 'hijack' })
  const [a2, b2] = store.getState().settings.items
  assert.equal(a2.id, a.id)
  assert.equal(a2.handle, '@new')
  assert.equal(a2.platform, 'custom')
  assert.equal(a2.icon, '')
  assert.deepEqual(b2, b)
})

test('removeItem and moveItem', () => {
  const s = store.getState()
  const ids = s.settings.items.map((i) => i.id)
  s.moveItem(ids[0], 1)
  assert.deepEqual(store.getState().settings.items.map((i) => i.id), [ids[1], ids[0]])
  s.moveItem(ids[0], 1) // already last
  s.moveItem('nope', -1)
  assert.deepEqual(store.getState().settings.items.map((i) => i.id), [ids[1], ids[0]])
  s.removeItem(ids[1])
  assert.deepEqual(store.getState().settings.items.map((i) => i.id), [ids[0]])
})

test('style and rotator updates are clamped', () => {
  store.getState().updateStyle({ fontSize: 1e9, color: '#123456' })
  store.getState().updateRotator({ intervalMs: 1, enabled: false })
  const { style, rotator } = store.getState().settings
  assert.equal(style.fontSize, 400)
  assert.equal(style.color, '#123456')
  assert.equal(rotator.intervalMs, 500)
  assert.equal(rotator.enabled, false)
})

test('setSettings validates what it is given; reset restores the defaults', () => {
  store.getState().setSettings({ items: [{ id: 'a', platform: 'twitch', handle: 'h' }], style: { gap: -1 } })
  assert.deepEqual(handles(), ['h'])
  assert.equal(store.getState().settings.style.gap, 0)
  store.getState().reset()
  assert.deepEqual(store.getState().settings, DEFAULT_SOCIALS)
})

test('edits create a new settings object (so the bridge sees the change)', () => {
  const before = store.getState().settings
  store.getState().updateItem(before.items[0].id, { handle: 'z' })
  assert.notEqual(store.getState().settings, before)
})
