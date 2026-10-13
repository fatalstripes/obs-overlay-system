import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CHANNEL, DEFAULT_SETTINGS, MAX_LINES, MAX_LINE_LENGTH, ackMessage, buildOverlayUrl, googleFontsUrl,
  parseBridgeMessage, parseOverlayRoute, requestMessage, sanitizeSettings, settingsMessage,
} from '../src/lib/textEngine.ts'

test('garbage in gives the defaults back', () => {
  for (const bad of [undefined, null, 5, 'x', [], {}, { lines: 'nope', rotator: 3, gradient: [] }]) {
    assert.deepEqual(sanitizeSettings(bad), DEFAULT_SETTINGS)
  }
})

test('valid settings pass through unchanged', () => {
  const s = {
    ...DEFAULT_SETTINGS, fontFamily: 'Bebas Neue', fontWeight: 400, italic: true, fontSize: 120, align: 'left',
    fillMode: 'gradient', strokeWidth: 8, lines: ['a', 'b'],
    rotator: { enabled: true, intervalMs: 2000, transition: 'blur', transitionMs: 300, order: 'random' },
  }
  assert.deepEqual(sanitizeSettings(s), s)
})

test('numbers are clamped, weights snap to hundreds, non-numbers fall back', () => {
  const s = sanitizeSettings({
    fontSize: 99999, strokeWidth: -5, fontWeight: 650, letterSpacing: Number.NaN,
    gradient: { angle: 9999 }, rotator: { intervalMs: 1, transitionMs: Infinity },
  })
  assert.equal(s.fontSize, 600)
  assert.equal(s.strokeWidth, 0)
  assert.equal(s.fontWeight, 700)
  assert.equal(s.letterSpacing, DEFAULT_SETTINGS.letterSpacing)
  assert.equal(s.gradient.angle, 360)
  assert.equal(s.rotator.intervalMs, 300)
  assert.equal(s.rotator.transitionMs, DEFAULT_SETTINGS.rotator.transitionMs)
})

test('font family names that could break out of a URL or CSS are rejected', () => {
  for (const evil of ['Roboto&family=Evil', 'A"><script>', "x'; background:url(//e)", 'a/b', '', ' ', '-x', 'x'.repeat(80), 5]) {
    assert.equal(sanitizeSettings({ fontFamily: evil }).fontFamily, DEFAULT_SETTINGS.fontFamily, String(evil))
  }
  assert.equal(sanitizeSettings({ fontFamily: ' Press Start 2P ' }).fontFamily, 'Press Start 2P')
})

test('colors must be #rrggbb or #rrggbbaa; anything else falls back', () => {
  const s = sanitizeSettings({ color: 'red', strokeColor: '#ABCDEF', gradient: { from: 'url(x)', to: '#12345678' } })
  assert.equal(s.color, DEFAULT_SETTINGS.color)
  assert.equal(s.strokeColor, '#abcdef')
  assert.equal(s.gradient.from, DEFAULT_SETTINGS.gradient.from)
  assert.equal(s.gradient.to, '#12345678')
})

test('lines: only strings, capped in count and length, carriage returns removed', () => {
  const many = Array.from({ length: MAX_LINES + 20 }, (_, i) => `l${i}`)
  assert.equal(sanitizeSettings({ lines: many }).lines.length, MAX_LINES)
  const s = sanitizeSettings({ lines: ['ok', 7, null, 'x'.repeat(MAX_LINE_LENGTH + 50), 'a\r\nb'] })
  assert.deepEqual(s.lines.slice(0, 1), ['ok'])
  assert.equal(s.lines.length, 3)
  assert.equal(s.lines[1].length, MAX_LINE_LENGTH)
  assert.equal(s.lines[2], 'a\nb')
  assert.deepEqual(sanitizeSettings({ lines: [] }).lines, [])
})

test('Google Fonts URL: spaces become +, axes optional', () => {
  assert.equal(googleFontsUrl('Press Start 2P', 400, false), 'https://fonts.googleapis.com/css2?family=Press+Start+2P:ital,wght@0,400&display=swap')
  assert.equal(googleFontsUrl('Roboto', 700, true), 'https://fonts.googleapis.com/css2?family=Roboto:ital,wght@1,700&display=swap')
  assert.equal(googleFontsUrl('Roboto', 700, true, true), 'https://fonts.googleapis.com/css2?family=Roboto&display=swap')
})

test('bridge messages: ours are accepted, settings are sanitized, everything else is ignored', () => {
  assert.deepEqual(parseBridgeMessage(requestMessage()), requestMessage())
  assert.deepEqual(parseBridgeMessage(ackMessage(123)), ackMessage(123))
  const round = parseBridgeMessage(JSON.parse(JSON.stringify(settingsMessage({ ...DEFAULT_SETTINGS, fontSize: 50 }))))
  assert.equal(round.type, 'settings')
  assert.equal(round.settings.fontSize, 50)

  const hostile = parseBridgeMessage({ channel: CHANNEL, v: 1, from: 'dashboard', type: 'settings', settings: { fontFamily: 'x&y', fontSize: 1e9 } })
  assert.equal(hostile.settings.fontFamily, DEFAULT_SETTINGS.fontFamily)
  assert.equal(hostile.settings.fontSize, 600)

  for (const bad of [
    null, 'x', {}, { type: 'settings' },
    { channel: 'other', v: 1, from: 'dashboard', type: 'settings', settings: {} },
    { channel: CHANNEL, v: 2, from: 'dashboard', type: 'settings', settings: {} },
    { channel: CHANNEL, v: 1, from: 'overlay', type: 'settings', settings: {} },   // overlays can't push settings
    { channel: CHANNEL, v: 1, from: 'dashboard', type: 'request' },
    { channel: CHANNEL, v: 1, from: 'overlay', type: 'ack', at: 'soon' },
  ]) assert.equal(parseBridgeMessage(bad), null, JSON.stringify(bad))
})

test('overlay URL round-trips the websocket address and password', () => {
  const url = buildOverlayUrl('file:///C:/Users/me/dist/index.html#/something', 'ws://localhost:4455', 'p@ss w&rd=1#x')
  assert.ok(url.startsWith('file:///C:/Users/me/dist/index.html#/overlay/text?'))
  const hash = url.slice(url.indexOf('#'))
  assert.deepEqual(parseOverlayRoute(hash), { ws: 'ws://localhost:4455', password: 'p@ss w&rd=1#x', debug: false })
  assert.deepEqual(parseOverlayRoute('#/overlay/text'), { ws: 'ws://localhost:4455', password: '', debug: false })
  assert.equal(parseOverlayRoute('#/overlay/text?debug=1').debug, true)
  assert.equal(parseOverlayRoute(''), null)
  assert.equal(parseOverlayRoute('#/other?ws=x'), null)
  assert.equal(buildOverlayUrl('https://x.io/app/', 'ws://h:1', '').includes('pw='), false)
})
