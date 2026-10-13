import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_SOCIALS, MAX_HANDLE_LENGTH, MAX_ITEMS, PLATFORMS, SOCIALS_CHANNEL, buildSocialsUrl, iconKind, isDefaultSocials,
  parseSocialsMessage, parseSocialsRoute, platformIconUrl, sanitizeIcon, sanitizeSocials, socialsAckMessage,
  socialsRequestMessage, socialsSettingsMessage,
} from '../src/lib/socials.ts'
import { CHANNEL, parseBridgeMessage, settingsMessage, DEFAULT_SETTINGS } from '../src/lib/textEngine.ts'

test('defaults survive sanitizing unchanged', () => {
  assert.deepEqual(sanitizeSocials(DEFAULT_SOCIALS), DEFAULT_SOCIALS)
  assert.equal(isDefaultSocials(DEFAULT_SOCIALS), true)
  assert.equal(isDefaultSocials({ ...DEFAULT_SOCIALS, items: [] }), false)
})

test('garbage becomes defaults, never a crash', () => {
  for (const bad of [null, undefined, 5, 'x', [], { items: 'no', style: 3, rotator: [] }]) {
    const s = sanitizeSocials(bad)
    assert.equal(s.style.fontFamily, DEFAULT_SOCIALS.style.fontFamily)
    assert.equal(s.rotator.transition, DEFAULT_SOCIALS.rotator.transition)
    assert.ok(Array.isArray(s.items))
  }
})

test('numbers are clamped and enums fall back', () => {
  const s = sanitizeSocials({
    style: { fontSize: 1e9, iconSize: -5, gap: NaN, strokeWidth: 999, align: 'diagonal', iconColor: 'rainbow', color: 'red', fontFamily: '<script>' },
    rotator: { intervalMs: 1, transitionMs: 1e9, transition: 'explode', order: 'x', enabled: 'yes' },
  })
  assert.equal(s.style.fontSize, 400)
  assert.equal(s.style.iconSize, 8)
  assert.equal(s.style.gap, DEFAULT_SOCIALS.style.gap)
  assert.equal(s.style.strokeWidth, 40)
  assert.equal(s.style.align, 'center')
  assert.equal(s.style.iconColor, 'brand')
  assert.equal(s.style.color, '#ffffff')
  assert.equal(s.style.fontFamily, 'Montserrat')
  assert.equal(s.rotator.intervalMs, 500)
  assert.equal(s.rotator.transitionMs, 5000)
  assert.equal(s.rotator.transition, 'slide-up')
  assert.equal(s.rotator.order, 'sequential')
  assert.equal(s.rotator.enabled, true)
})

test('items: unknown platforms become custom, text is cut and flattened, the list is capped', () => {
  const s = sanitizeSocials({
    items: [
      { id: 'a', platform: 'myspace', handle: 'x'.repeat(500), label: 'L\nM', icon: '' },
      'junk',
      ...Array.from({ length: 100 }, (_, i) => ({ id: `n${i}`, platform: 'twitch', handle: `h${i}` })),
    ],
  })
  assert.equal(s.items.length, MAX_ITEMS)
  assert.equal(s.items[0].platform, 'custom')
  assert.equal(s.items[0].handle.length, MAX_HANDLE_LENGTH)
  assert.equal(s.items[0].label, 'L M')
  assert.equal(s.items[1].handle, '')
})

test('item ids are made unique (they are React keys)', () => {
  const s = sanitizeSocials({ items: [{ id: 'x', handle: 'a' }, { id: 'x', handle: 'b' }, { id: 'x', handle: 'c' }, { handle: 'd' }, { id: 'bad id!', handle: 'e' }] })
  const ids = s.items.map((i) => i.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ids.every((id) => /^[\w-]{1,40}$/.test(id)))
})

test('icons: https URLs, small data images and short glyphs are allowed; everything else is dropped', () => {
  assert.equal(sanitizeIcon('https://example.com/a.png'), 'https://example.com/a.png')
  assert.equal(sanitizeIcon('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA')
  assert.equal(sanitizeIcon('🔥'), '🔥')
  assert.equal(sanitizeIcon('★'), '★')
  for (const bad of ['http://example.com/a.png', 'javascript:alert(1)', 'file:///etc/passwd', 'data:text/html;base64,AAAA', 'data:image/svg+xml;base64,AAAA', 'toolong!', '', '   ', null, 5, 'https://']) {
    assert.equal(sanitizeIcon(bad), '', JSON.stringify(bad))
  }
})

test('iconKind', () => {
  assert.equal(iconKind(''), 'none')
  assert.equal(iconKind('https://a/b.png'), 'image')
  assert.equal(iconKind('data:image/png;base64,AA'), 'image')
  assert.equal(iconKind('🔥'), 'glyph')
})

test('platformIconUrl tints the CDN icon; custom has none', () => {
  assert.equal(platformIconUrl('twitch', '#9146ff'), 'https://cdn.simpleicons.org/twitch/9146ff')
  assert.equal(platformIconUrl('custom', '#ffffff'), null)
  assert.equal(platformIconUrl('nope', '#ffffff'), null)
  assert.ok(PLATFORMS.every((p) => /^#[0-9a-f]{6}$/.test(p.brand)))
})

test('messages round-trip through the validator', () => {
  const settings = sanitizeSocials({ items: [{ id: 'a', platform: 'kick', handle: '@me' }] })
  assert.deepEqual(parseSocialsMessage(JSON.parse(JSON.stringify(socialsSettingsMessage(settings)))), socialsSettingsMessage(settings))
  assert.deepEqual(parseSocialsMessage(socialsRequestMessage()), socialsRequestMessage())
  assert.deepEqual(parseSocialsMessage(socialsAckMessage(5)), socialsAckMessage(5))
})

test('settings inside a message are sanitized on receipt', () => {
  const msg = parseSocialsMessage({ ...socialsSettingsMessage(DEFAULT_SOCIALS), settings: { items: [{ id: 'a', handle: 'x', icon: 'javascript:1' }], style: { fontSize: 1e9 } } })
  assert.equal(msg.settings.items[0].icon, '')
  assert.equal(msg.settings.style.fontSize, 400)
})

test('foreign, malformed and wrongly-directed messages are rejected', () => {
  const ok = socialsSettingsMessage(DEFAULT_SOCIALS)
  assert.equal(parseSocialsMessage(null), null)
  assert.equal(parseSocialsMessage('x'), null)
  assert.equal(parseSocialsMessage({ ...ok, channel: 'other' }), null)
  assert.equal(parseSocialsMessage({ ...ok, v: 2 }), null)
  assert.equal(parseSocialsMessage({ ...ok, from: 'overlay' }), null, 'settings only come from the dashboard')
  assert.equal(parseSocialsMessage({ ...socialsAckMessage(1), at: 'now' }), null)
  assert.equal(parseSocialsMessage({ ...socialsRequestMessage(), from: 'dashboard' }), null)
})

test('the socials and text-engine channels never read each other\'s messages', () => {
  assert.notEqual(SOCIALS_CHANNEL, CHANNEL)
  assert.equal(parseSocialsMessage(settingsMessage(DEFAULT_SETTINGS)), null)
  assert.equal(parseBridgeMessage(socialsSettingsMessage(DEFAULT_SOCIALS)), null)
})

test('Browser Source URL and route parsing', () => {
  const url = buildSocialsUrl('https://x.github.io/app/index.html?a=1#/old', 'ws://localhost:4455', 'p w')
  assert.equal(url, 'https://x.github.io/app/index.html?a=1#/overlay/socials?ws=ws%3A%2F%2Flocalhost%3A4455&pw=p+w')
  assert.deepEqual(parseSocialsRoute(url.slice(url.indexOf('#'))), { ws: 'ws://localhost:4455', password: 'p w', debug: false })
  assert.equal(parseSocialsRoute('#/overlay/socials?debug=1').debug, true)
  assert.equal(parseSocialsRoute('#/overlay/socials').ws, 'ws://localhost:4455')
  assert.equal(parseSocialsRoute('#/overlay/text'), null)
  assert.equal(parseSocialsRoute(''), null)
  assert.equal(buildSocialsUrl('file:///C:/app/index.html', 'ws://a', ''), 'file:///C:/app/index.html#/overlay/socials?ws=ws%3A%2F%2Fa')
})
