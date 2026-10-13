// The app's real sync code (layout, media swap, socials bridge, overlay client) against the mock OBS server, through the
// app's own obs-websocket-js singleton, exactly as the dashboard uses it.
import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, test } from 'node:test'
import OBSWebSocket from 'obs-websocket-js/json'
import { editLayout, flushLayoutNow, loadLayoutTarget, refreshLayoutItems, resetLayout, startLayoutSync } from '../src/lib/layoutSync.ts'
import { applyMediaSwap, loadCurrentPath, refreshMediaInputs } from '../src/lib/mediaSync.ts'
import { startBridgeClient } from '../src/lib/overlayClient.ts'
import {
  DEFAULT_SOCIALS, parseSocialsMessage, sanitizeSocials, socialsAckMessage, socialsRequestMessage, socialsSettingsMessage,
} from '../src/lib/socials.ts'
import { sendSocialsSettings, startSocialsBridge } from '../src/lib/socialsBridge.ts'
import { obs, useObsStore } from '../src/store/useObsStore.ts'
import { useLayoutStore } from '../src/store/useLayoutStore.ts'
import { useMediaStore } from '../src/store/useMediaStore.ts'
import { useSocialsStore } from '../src/store/useSocialsStore.ts'
import { sampleState, startMockObs } from './helpers/mockObs.mjs'
import { sleep, waitFor } from './helpers/waitFor.mjs'

let mock
const layout = useLayoutStore
const media = useMediaStore
const socials = useSocialsStore

before(async () => {
  mock = await startMockObs()
  useObsStore.setState({ url: mock.url, password: '', liveSync: true })
  await useObsStore.getState().connect()
  assert.equal(useObsStore.getState().status, 'connected')
})
after(async () => {
  await obs.disconnect()
  await mock.close()
})
beforeEach(() => {
  Object.assign(mock.state, sampleState())
  mock.clearRequests()
  useObsStore.setState({ liveSync: true, currentScene: 'Gameplay' })
  layout.setState({ scene: '', source: '', lockAspect: false, items: [], target: null, transform: null, original: null, info: null, error: null })
  media.setState({ inputs: [], selected: '', currentPath: null, draft: '', recents: {}, restart: true, message: null, busy: false })
  socials.setState({ settings: DEFAULT_SOCIALS, lastAckAt: null, lastSentAt: null })
})
afterEach(async () => {
  await flushLayoutNow()
})

const loadLogo = async () => {
  layout.getState().setSource('Logo')
  await refreshLayoutItems()
  await loadLayoutTarget()
}

// ---- layout --------------------------------------------------------------------------------------------------------

test('connecting asks OBS for scenes and inputs, and subscribes to transform events', () => {
  assert.deepEqual(useObsStore.getState().scenes, ['Gameplay', 'Intro'].reverse().reverse())
  assert.equal(useObsStore.getState().currentScene, 'Gameplay')
  assert.ok(useObsStore.getState().inputs.includes('Logo'))
})

test('the layout panel loads a scene\'s items and the chosen source\'s transform (GetSceneItemId + GetSceneItemTransform)', async () => {
  await loadLogo()
  assert.deepEqual(layout.getState().items.map((i) => i.sourceName), ['Logo', 'Webcam'])
  assert.deepEqual(layout.getState().target, { scene: 'Gameplay', sceneItemId: 2 })
  assert.deepEqual(layout.getState().transform, { positionX: 100, positionY: 50, scaleX: 1, scaleY: 1, rotation: 0 })
  assert.equal(mock.requestsOf('GetSceneItemId')[0].data.sourceName, 'Logo')
})

test('a source that is not in the scene gives an error and no target', async () => {
  layout.getState().setSource('Nope')
  await loadLayoutTarget()
  assert.equal(layout.getState().target, null)
  assert.match(layout.getState().error, /Nope.*Gameplay/)
})

test('an explicit scene is used instead of the program scene', async () => {
  layout.getState().setScene('Intro')
  layout.getState().setSource('Logo')
  await refreshLayoutItems()
  await loadLayoutTarget()
  assert.deepEqual(layout.getState().target, { scene: 'Intro', sceneItemId: 1 })
  assert.equal(layout.getState().transform.positionX, 7)
})

test('editing sends the change to OBS and the shown value updates immediately', async () => {
  await loadLogo()
  editLayout({ positionX: 640, rotation: 45 }, 0)
  assert.equal(layout.getState().transform.positionX, 640)
  await waitFor(() => mock.requestsOf('SetSceneItemTransform').length === 1, 'SetSceneItemTransform')
  assert.deepEqual(mock.requestsOf('SetSceneItemTransform')[0].data, {
    sceneName: 'Gameplay', sceneItemId: 2, sceneItemTransform: { positionX: 640, rotation: 45 },
  })
  assert.equal(mock.state.scenes.Gameplay[1].transform.positionX, 640)
})

test('a burst of slider edits is merged into few requests and OBS ends up with the last value', async () => {
  await loadLogo()
  for (let x = 1; x <= 30; x++) editLayout({ positionX: x }, 30)
  editLayout({ positionY: 9 }, 30)
  await flushLayoutNow()
  await waitFor(() => mock.state.scenes.Gameplay[1].transform.positionX === 30, 'the last value')
  assert.ok(mock.requestsOf('SetSceneItemTransform').length < 5, `sent ${mock.requestsOf('SetSceneItemTransform').length} requests for 31 edits`)
  assert.equal(mock.state.scenes.Gameplay[1].transform.positionY, 9)
})

test('with the aspect lock on both scale axes are sent', async () => {
  await loadLogo()
  layout.getState().setLockAspect(true)
  editLayout({ scaleX: 2 }, 0)
  await waitFor(() => mock.requestsOf('SetSceneItemTransform').length === 1, 'SetSceneItemTransform')
  assert.deepEqual(mock.requestsOf('SetSceneItemTransform')[0].data.sceneItemTransform, { scaleX: 2, scaleY: 2 })
})

test('invalid input is never sent', async () => {
  await loadLogo()
  editLayout({ positionX: NaN }, 0)
  await sleep(40)
  assert.equal(mock.requestsOf('SetSceneItemTransform').length, 0)
})

test('an edit is sent to the item it was made on even if the panel switches before it goes out', async () => {
  await loadLogo()
  editLayout({ positionX: 555 }, 50)
  layout.getState().setScene('Intro') // the panel moves on before the throttle fires
  await flushLayoutNow()
  await waitFor(() => mock.requestsOf('SetSceneItemTransform').length === 1, 'SetSceneItemTransform')
  assert.equal(mock.requestsOf('SetSceneItemTransform')[0].data.sceneName, 'Gameplay')
  assert.equal(mock.state.scenes.Intro[0].transform.positionX, 7, 'the other scene is untouched')
})

test('edits are held while live sync is off and sent when it comes back on', async () => {
  const stop = startLayoutSync()
  try {
    await loadLogo()
    useObsStore.setState({ liveSync: false })
    editLayout({ positionX: 77 }, 0)
    await sleep(60)
    assert.equal(mock.requestsOf('SetSceneItemTransform').length, 0)
    useObsStore.setState({ liveSync: true })
    await waitFor(() => mock.state.scenes.Gameplay[1].transform.positionX === 77, 'the held edit')
  } finally {
    stop()
  }
})

test('Reset puts the transform back as it was when loaded', async () => {
  await loadLogo()
  editLayout({ positionX: 1000, scaleX: 3 }, 0)
  await flushLayoutNow()
  await waitFor(() => mock.state.scenes.Gameplay[1].transform.positionX === 1000, 'the edit')
  resetLayout()
  await waitFor(() => mock.state.scenes.Gameplay[1].transform.positionX === 100, 'the reset')
  assert.equal(mock.state.scenes.Gameplay[1].transform.scaleX, 1)
  assert.equal(layout.getState().transform.positionX, 100)
})

test('moving the item in OBS itself updates the panel (SceneItemTransformChanged)', async () => {
  const stop = startLayoutSync()
  try {
    await loadLogo()
    mock.moveInObs('Gameplay', 2, { positionX: 321 })
    await waitFor(() => layout.getState().transform.positionX === 321, 'the panel to follow OBS')
    mock.moveInObs('Gameplay', 1, { positionX: 5 }) // a different item
    await sleep(60)
    assert.equal(layout.getState().transform.positionX, 321)
  } finally {
    stop()
  }
})

test('losing the connection clears the loaded target', async () => {
  const stop = startLayoutSync()
  try {
    await loadLogo()
    useObsStore.setState({ status: 'disconnected' })
    assert.equal(layout.getState().target, null)
  } finally {
    useObsStore.setState({ status: 'connected' })
    stop()
  }
})

// ---- media swap ----------------------------------------------------------------------------------------------------

test('the media panel lists Image and Media sources and reads the selected one\'s file', async () => {
  await refreshMediaInputs()
  assert.deepEqual(media.getState().inputs.map((i) => i.name), ['Logo', 'Loop', 'Stream'])
  media.getState().select('Loop')
  await loadCurrentPath()
  assert.equal(media.getState().currentPath, 'C:/old/loop.mp4')
})

test('a selection that no longer exists in OBS is cleared on refresh', async () => {
  media.getState().select('Gone')
  await refreshMediaInputs()
  assert.equal(media.getState().selected, '')
})

test('swapping sets the file in OBS, remembers it, clears the field and reports success', async () => {
  await refreshMediaInputs()
  media.getState().select('Logo')
  media.getState().setDraft('"E:/art/night.png"')
  assert.equal(await applyMediaSwap(), true)
  assert.equal(mock.state.inputs.Logo.settings.file, 'E:/art/night.png')
  const s = media.getState()
  assert.equal(s.currentPath, 'E:/art/night.png')
  assert.equal(s.draft, '')
  assert.deepEqual(s.recents.Logo, ['E:/art/night.png'])
  assert.deepEqual(s.message, { kind: 'ok', text: '"Logo" now uses E:/art/night.png' })
  assert.equal(s.busy, false)
})

test('swapping from the recent list reuses a remembered path', async () => {
  await refreshMediaInputs()
  media.getState().select('Loop')
  await applyMediaSwap('E:/a.mp4')
  await applyMediaSwap('E:/b.mp4')
  await applyMediaSwap('E:/a.mp4')
  assert.deepEqual(media.getState().recents.Loop, ['E:/a.mp4', 'E:/b.mp4'])
  assert.equal(mock.requestsOf('TriggerMediaInputAction').length, 3, 'restart is on by default')
  media.getState().setRestart(false)
  await applyMediaSwap('E:/c.mp4')
  assert.equal(mock.requestsOf('TriggerMediaInputAction').length, 3)
})

test('swap errors are reported, nothing is remembered and the panel is not left busy', async () => {
  await refreshMediaInputs()
  assert.equal(await applyMediaSwap('E:/x.png'), false, 'no source selected')
  assert.match(media.getState().message.text, /Pick an Image or Media source/)

  media.getState().select('Logo')
  assert.equal(await applyMediaSwap('   '), false)
  assert.match(media.getState().message.text, /Enter a file path/)

  delete mock.state.inputs.Logo // removed in OBS behind our back
  assert.equal(await applyMediaSwap('E:/x.png'), false)
  assert.equal(media.getState().message.kind, 'error')
  assert.match(media.getState().message.text, /No input was found/)
  assert.deepEqual(media.getState().recents, {})
  assert.equal(media.getState().busy, false)
})

// ---- socials bridge ------------------------------------------------------------------------------------------------

/** A second obs-websocket client standing in for the overlay Browser Source. */
async function fakeOverlay() {
  const client = new OBSWebSocket()
  await client.connect(mock.url)
  const events = []
  client.on('CustomEvent', (e) => events.push(e))
  return { client, events, close: () => client.disconnect() }
}

test('sendSocialsSettings broadcasts the settings as a CustomEvent every client receives', async () => {
  const overlay = await fakeOverlay()
  try {
    socials.getState().updateItem(socials.getState().settings.items[0].id, { handle: '@broadcast' })
    await sendSocialsSettings()
    const msg = await waitFor(() => overlay.events.map(parseSocialsMessage).find((m) => m?.type === 'settings'), 'the settings event')
    assert.equal(msg.settings.items[0].handle, '@broadcast')
    assert.ok(socials.getState().lastSentAt)
    assert.deepEqual(mock.requestsOf('BroadcastCustomEvent')[0].data.eventData, socialsSettingsMessage(socials.getState().settings))
  } finally {
    await overlay.close()
  }
})

test('the socials bridge pushes edits (throttled) while live sync is on, and not when it is off', async () => {
  const stop = startSocialsBridge(10)
  const overlay = await fakeOverlay()
  try {
    const id = socials.getState().settings.items[0].id
    for (const h of ['a', 'ab', 'abc']) socials.getState().updateItem(id, { handle: h })
    await waitFor(() => overlay.events.length >= 1, 'a pushed update')
    await sleep(50)
    const last = overlay.events.map(parseSocialsMessage).filter((m) => m?.type === 'settings').at(-1)
    assert.equal(last.settings.items[0].handle, 'abc')
    assert.ok(mock.requestsOf('BroadcastCustomEvent').length < 3, 'the three edits were merged')

    useObsStore.setState({ liveSync: false })
    mock.clearRequests()
    socials.getState().updateItem(id, { handle: 'quiet' })
    await sleep(60)
    assert.equal(mock.requestsOf('BroadcastCustomEvent').length, 0)
  } finally {
    stop()
    await overlay.close()
  }
})

test('an overlay that just loaded asks for the settings and gets them; its ack is recorded', async () => {
  const stop = startSocialsBridge(10)
  const overlay = await fakeOverlay()
  try {
    await overlay.client.call('BroadcastCustomEvent', { eventData: socialsRequestMessage() })
    await waitFor(() => overlay.events.map(parseSocialsMessage).some((m) => m?.type === 'settings'), 'the reply to the request')
    await overlay.client.call('BroadcastCustomEvent', { eventData: socialsAckMessage(12345) })
    await waitFor(() => socials.getState().lastAckAt === 12345, 'the ack')
  } finally {
    stop()
    await overlay.close()
  }
})

test('the dashboard ignores other channels\' events and malformed ones', async () => {
  const stop = startSocialsBridge(10)
  const overlay = await fakeOverlay()
  try {
    await overlay.client.call('BroadcastCustomEvent', { eventData: { channel: 'obs-overlay-system/text-engine', v: 1, from: 'overlay', type: 'request' } })
    await overlay.client.call('BroadcastCustomEvent', { eventData: { hello: 'world' } })
    await sleep(80)
    assert.equal(overlay.events.map(parseSocialsMessage).filter((m) => m?.type === 'settings').length, 0)
  } finally {
    stop()
    await overlay.close()
  }
})

test('stopping the bridge stops pushes', async () => {
  const stop = startSocialsBridge(5)
  stop()
  socials.getState().updateStyle({ fontSize: 100 })
  await sleep(50)
  assert.equal(mock.requestsOf('BroadcastCustomEvent').length, 0)
})

test('end to end: the overlay client connects, asks, receives sanitized settings and acknowledges', async () => {
  const stop = startSocialsBridge(10)
  const received = []
  const statuses = []
  socials.getState().setSettings({ items: [{ id: 'a', platform: 'kick', handle: '@live' }, { id: 'b', platform: 'discord', handle: 'discord.gg/x' }] })
  const stopOverlay = startBridgeClient({
    url: mock.url,
    password: '',
    hello: socialsRequestMessage(),
    onStatus: (s) => statuses.push(s),
    onEvent: (data) => {
      const msg = parseSocialsMessage(data)
      if (msg?.type !== 'settings') return
      received.push(msg.settings)
      return socialsAckMessage(999)
    },
  })
  try {
    await waitFor(() => received.length >= 1, 'the overlay to receive settings')
    assert.deepEqual(statuses.slice(0, 2), ['connecting', 'connected'])
    assert.deepEqual(received.at(-1).items.map((i) => i.handle), ['@live', 'discord.gg/x'])
    assert.deepEqual(received.at(-1), sanitizeSocials(received.at(-1)), 'what arrives is already valid')
    await waitFor(() => socials.getState().lastAckAt === 999, 'the dashboard to see the overlay\'s ack')
  } finally {
    stopOverlay()
    stop()
  }
})
