// The Layout and Media Swap request wrappers against the mock OBS server, using a plain JSON obs-websocket-js client.
import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import OBSWebSocket, { EventSubscription } from 'obs-websocket-js/json'
import OBSWebSocketMsgpack from 'obs-websocket-js/msgpack'
import {
  getMediaPath, getSceneItemId, getTransform, listMediaInputs, listSceneItems, setTransform, swapMedia,
} from '../src/lib/obsApi.ts'
import { sampleState, startMockObs } from './helpers/mockObs.mjs'
import { waitFor } from './helpers/waitFor.mjs'

let mock
let obs

before(async () => {
  mock = await startMockObs()
  obs = new OBSWebSocket()
  await obs.connect(mock.url, undefined, { eventSubscriptions: EventSubscription.All | EventSubscription.SceneItemTransformChanged })
})
after(async () => {
  await obs.disconnect()
  await mock.close()
})
beforeEach(() => {
  Object.assign(mock.state, sampleState())
  mock.clearRequests()
})

// ---- layout --------------------------------------------------------------------------------------------------------

test('listSceneItems returns the scene\'s items topmost first', async () => {
  const items = await listSceneItems(obs, 'Gameplay')
  assert.deepEqual(items.map((i) => i.sourceName), ['Logo', 'Webcam'])
  assert.deepEqual(items[0], { sceneItemId: 2, sourceName: 'Logo', inputKind: 'image_source', isGroup: false })
})

test('listSceneItems rejects for an unknown scene with OBS\'s message', async () => {
  await assert.rejects(listSceneItems(obs, 'Nope'), /No scene was found/)
})

test('getSceneItemId resolves a source name to its id in that scene', async () => {
  assert.equal(await getSceneItemId(obs, 'Gameplay', 'Logo'), 2)
  assert.equal(await getSceneItemId(obs, 'Intro', 'Logo'), 1, 'same source, different id in another scene')
  await assert.rejects(getSceneItemId(obs, 'Gameplay', 'Missing'), /No scene items were found/)
})

test('getTransform reads position, scale and rotation', async () => {
  const { transform, info } = await getTransform(obs, 'Gameplay', 2)
  assert.deepEqual(transform, { positionX: 100, positionY: 50, scaleX: 1, scaleY: 1, rotation: 0 })
  assert.equal(info.sourceWidth, 400)
  assert.equal(info.boundsType, 'OBS_BOUNDS_NONE')
})

test('setTransform sends only the edited, valid fields and OBS keeps everything else', async () => {
  const sent = await setTransform(obs, 'Gameplay', 2, { positionX: 640, rotation: -90, positionY: NaN, scaleX: 'x' })
  assert.deepEqual(sent, { positionX: 640, rotation: 270 })
  const [req] = mock.requestsOf('SetSceneItemTransform')
  assert.deepEqual(req.data, { sceneName: 'Gameplay', sceneItemId: 2, sceneItemTransform: { positionX: 640, rotation: 270 } })
  const t = mock.state.scenes.Gameplay[1].transform
  assert.equal(t.positionX, 640)
  assert.equal(t.positionY, 50, 'untouched field kept')
  assert.equal(t.cropLeft, 0)
})

test('scale changes are reflected in the rendered size', async () => {
  await setTransform(obs, 'Gameplay', 2, { scaleX: 2, scaleY: 0.5 })
  const { info } = await getTransform(obs, 'Gameplay', 2)
  assert.equal(info.width, 800)
  assert.equal(info.height, 100)
})

test('setTransform with nothing valid sends no request at all', async () => {
  assert.deepEqual(await setTransform(obs, 'Gameplay', 2, { positionX: NaN }), {})
  assert.equal(mock.requestsOf('SetSceneItemTransform').length, 0)
})

test('setTransform surfaces OBS errors', async () => {
  await assert.rejects(setTransform(obs, 'Gameplay', 99, { positionX: 1 }), /No scene item was found/)
  await assert.rejects(setTransform(obs, 'Nope', 1, { positionX: 1 }), /No scene was found/)
})

test('SceneItemTransformChanged reaches only clients that subscribed to the high-volume event', async () => {
  const quiet = new OBSWebSocket()
  await quiet.connect(mock.url) // default subscriptions: no high-volume events
  const seen = []
  const seenQuiet = []
  obs.on('SceneItemTransformChanged', (e) => seen.push(e))
  quiet.on('SceneItemTransformChanged', (e) => seenQuiet.push(e))
  quiet.on('InputSettingsChanged', () => seenQuiet.push('input'))
  try {
    await setTransform(obs, 'Gameplay', 2, { positionX: 11 })
    await waitFor(() => seen.length === 1, 'the transform event')
    assert.equal(seen[0].sceneName, 'Gameplay')
    assert.equal(seen[0].sceneItemId, 2)
    assert.equal(seen[0].sceneItemTransform.positionX, 11)
    // a normal event does reach the quiet client, the high-volume one does not
    await swapMedia(obs, { name: 'Logo', kind: 'image_source' }, 'C:/x.png')
    await waitFor(() => seenQuiet.includes('input'), 'the input event on the quiet client')
    assert.deepEqual(seenQuiet.filter((e) => e !== 'input'), [])
  } finally {
    obs.removeAllListeners('SceneItemTransformChanged')
    await quiet.disconnect()
  }
})

test('the mock speaks MessagePack too (what obs-websocket-js uses by default in Node)', async () => {
  const mp = new OBSWebSocketMsgpack()
  await mp.connect(mock.url)
  try {
    const { sceneItemId } = await mp.call('GetSceneItemId', { sceneName: 'Gameplay', sourceName: 'Webcam' })
    assert.equal(sceneItemId, 1)
  } finally {
    await mp.disconnect()
  }
})

// ---- media ---------------------------------------------------------------------------------------------------------

test('listMediaInputs returns only Image and Media sources, sorted', async () => {
  assert.deepEqual(await listMediaInputs(obs), [
    { name: 'Logo', kind: 'image_source' },
    { name: 'Loop', kind: 'ffmpeg_source' },
    { name: 'Stream', kind: 'ffmpeg_source' },
  ])
})

test('getMediaPath reads the file of an image and of a media source', async () => {
  assert.equal(await getMediaPath(obs, { name: 'Logo', kind: 'image_source' }), 'C:/old/logo.png')
  assert.equal(await getMediaPath(obs, { name: 'Loop', kind: 'ffmpeg_source' }), 'C:/old/loop.mp4')
  assert.equal(await getMediaPath(obs, { name: 'Stream', kind: 'ffmpeg_source' }), '', 'a URL-based media source has no local file')
})

test('swapMedia changes the image file and keeps the source\'s other settings', async () => {
  const set = await swapMedia(obs, { name: 'Logo', kind: 'image_source' }, ' "D:/new logo.png" ')
  assert.equal(set, 'D:/new logo.png')
  assert.deepEqual(mock.requestsOf('SetInputSettings')[0].data, { inputName: 'Logo', inputSettings: { file: 'D:/new logo.png' }, overlay: true })
  assert.deepEqual(mock.state.inputs.Logo.settings, { file: 'D:/new logo.png', unload: false })
})

test('swapMedia on a media source marks the file local and can restart playback', async () => {
  await swapMedia(obs, { name: 'Stream', kind: 'ffmpeg_source' }, 'D:/clip.mp4', { restart: true })
  assert.deepEqual(mock.state.inputs.Stream.settings, { is_local_file: true, input: 'rtmp://example/live', local_file: 'D:/clip.mp4' })
  assert.deepEqual(mock.requestsOf('TriggerMediaInputAction')[0].data, {
    inputName: 'Stream', mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART',
  })
})

test('no restart unless asked, and never for an image', async () => {
  await swapMedia(obs, { name: 'Loop', kind: 'ffmpeg_source' }, 'D:/a.mp4')
  await swapMedia(obs, { name: 'Logo', kind: 'image_source' }, 'D:/a.png', { restart: true })
  assert.equal(mock.requestsOf('TriggerMediaInputAction').length, 0)
})

test('swapMedia refuses an empty path or a non-media source without sending anything', async () => {
  await assert.rejects(swapMedia(obs, { name: 'Logo', kind: 'image_source' }, '   '), /Enter a file path/)
  await assert.rejects(swapMedia(obs, { name: 'Webcam', kind: 'dshow_input' }, 'C:/x.png'), /not an Image or Media source/)
  assert.equal(mock.requestsOf('SetInputSettings').length, 0)
})

test('swapMedia surfaces OBS errors for a source that no longer exists', async () => {
  await assert.rejects(swapMedia(obs, { name: 'Gone', kind: 'image_source' }, 'C:/x.png'), /No input was found/)
})

test('InputSettingsChanged is announced to listeners after a swap', async () => {
  const seen = []
  obs.on('InputSettingsChanged', (e) => seen.push(e))
  try {
    await swapMedia(obs, { name: 'Logo', kind: 'image_source' }, 'C:/z.png')
    await waitFor(() => seen.length === 1, 'InputSettingsChanged')
    assert.equal(seen[0].inputName, 'Logo')
    assert.equal(seen[0].inputSettings.file, 'C:/z.png')
  } finally {
    obs.removeAllListeners('InputSettingsChanged')
  }
})
