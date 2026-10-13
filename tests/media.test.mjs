import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MAX_PATH_LENGTH, MAX_RECENT, baseName, buildMediaSettings, isMediaKind, mediaKindInfo, normalizePath, pushRecent, readMediaPath,
} from '../src/lib/media.ts'

test('Image and Media sources are the swappable kinds', () => {
  assert.equal(isMediaKind('image_source'), true)
  assert.equal(isMediaKind('ffmpeg_source'), true)
  assert.equal(isMediaKind('browser_source'), false)
  assert.equal(mediaKindInfo('image_source').pathKey, 'file')
  assert.equal(mediaKindInfo('ffmpeg_source').pathKey, 'local_file')
})

test('normalizePath strips whitespace and the quotes Windows adds when copying a path', () => {
  assert.equal(normalizePath('  C:\\a\\b.png  '), 'C:\\a\\b.png')
  assert.equal(normalizePath('"C:\\a b\\c.png"'), 'C:\\a b\\c.png')
  assert.equal(normalizePath("'/home/me/x.mp4'"), '/home/me/x.mp4')
})

test('normalizePath turns file:// URLs into paths', () => {
  assert.equal(normalizePath('file:///C:/Users/me/My%20Pics/a.png'), 'C:/Users/me/My Pics/a.png')
  assert.equal(normalizePath('file:///home/me/a.png'), '/home/me/a.png')
  assert.equal(normalizePath('file://server/share/a.png'), '//server/share/a.png')
})

test('normalizePath rejects empty, control characters and over-long paths', () => {
  for (const bad of ['', '   ', '""', null, undefined, 5, 'a\nb', 'a\u0000b', 'x'.repeat(MAX_PATH_LENGTH + 1)]) {
    assert.equal(normalizePath(bad), null, JSON.stringify(bad))
  }
  assert.notEqual(normalizePath('x'.repeat(MAX_PATH_LENGTH)), null)
})

test('buildMediaSettings: image sources set `file`', () => {
  assert.deepEqual(buildMediaSettings('image_source', 'C:/bg.png'), { file: 'C:/bg.png' })
})

test('buildMediaSettings: media sources set `local_file` and mark it local (or OBS would treat it as a URL)', () => {
  assert.deepEqual(buildMediaSettings('ffmpeg_source', '"C:/loop.mp4"'), { is_local_file: true, local_file: 'C:/loop.mp4' })
})

test('buildMediaSettings returns null for an unusable kind or path', () => {
  assert.equal(buildMediaSettings('browser_source', 'C:/x.png'), null)
  assert.equal(buildMediaSettings('image_source', ''), null)
  assert.equal(buildMediaSettings(undefined, 'C:/x.png'), null)
})

test('readMediaPath reads the right key per kind and tolerates junk', () => {
  assert.equal(readMediaPath('image_source', { file: 'a.png', local_file: 'no' }), 'a.png')
  assert.equal(readMediaPath('ffmpeg_source', { local_file: 'a.mp4', file: 'no' }), 'a.mp4')
  assert.equal(readMediaPath('ffmpeg_source', { local_file: 5 }), '')
  assert.equal(readMediaPath('image_source', null), '')
  assert.equal(readMediaPath('browser_source', { file: 'a' }), '')
})

test('baseName', () => {
  assert.equal(baseName('C:\\a\\b\\c.png'), 'c.png')
  assert.equal(baseName('/x/y/z.mp4'), 'z.mp4')
  assert.equal(baseName('plain.png'), 'plain.png')
})

test('pushRecent puts the newest first, drops duplicates and caps the list', () => {
  assert.deepEqual(pushRecent(['a', 'b'], 'b'), ['b', 'a'])
  assert.deepEqual(pushRecent([], 'a'), ['a'])
  const many = Array.from({ length: MAX_RECENT + 3 }, (_, i) => `p${i}`)
  const out = pushRecent(many, 'new')
  assert.equal(out.length, MAX_RECENT)
  assert.equal(out[0], 'new')
})
