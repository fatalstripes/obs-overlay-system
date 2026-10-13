import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { MAX_RECENT } from '../src/lib/media.ts'
import { useMediaStore } from '../src/store/useMediaStore.ts'

const store = useMediaStore

beforeEach(() => {
  store.setState({ inputs: [], selected: '', currentPath: null, draft: '', recents: {}, restart: true, message: null, busy: false })
})

test('setInputs keeps only Image and Media sources', () => {
  store.getState().setInputs([
    { name: 'Logo', kind: 'image_source' },
    { name: 'Loop', kind: 'ffmpeg_source' },
    { name: 'Cam', kind: 'dshow_input' },
    { name: '', kind: 'image_source' },
  ])
  assert.deepEqual(store.getState().inputs.map((i) => i.name), ['Logo', 'Loop'])
})

test('selecting a source clears the previous source\'s path, draft and message', () => {
  store.setState({ selected: 'Logo', currentPath: 'a.png', draft: 'b.png', message: { kind: 'ok', text: 'x' } })
  store.getState().select('Loop')
  const s = store.getState()
  assert.equal(s.selected, 'Loop')
  assert.equal(s.currentPath, null)
  assert.equal(s.draft, '')
  assert.equal(s.message, null)
})

test('remember keeps a per-source most-recent list of normalized paths', () => {
  const { remember } = store.getState()
  remember('Logo', ' "C:/a.png" ')
  remember('Logo', 'C:/b.png')
  remember('Logo', 'C:/a.png')
  remember('Loop', 'C:/c.mp4')
  assert.deepEqual(store.getState().recents, { Logo: ['C:/a.png', 'C:/b.png'], Loop: ['C:/c.mp4'] })
})

test('remember ignores empty paths and empty source names, and caps the list', () => {
  const { remember } = store.getState()
  remember('Logo', '   ')
  remember('', 'C:/a.png')
  assert.deepEqual(store.getState().recents, {})
  for (let i = 0; i < MAX_RECENT + 5; i++) remember('Logo', `C:/f${i}.png`)
  assert.equal(store.getState().recents.Logo.length, MAX_RECENT)
  assert.equal(store.getState().recents.Logo[0], `C:/f${MAX_RECENT + 4}.png`)
})

test('forget removes one path from one source', () => {
  store.setState({ recents: { Logo: ['a', 'b'], Loop: ['a'] } })
  store.getState().forget('Logo', 'a')
  assert.deepEqual(store.getState().recents, { Logo: ['b'], Loop: ['a'] })
})
