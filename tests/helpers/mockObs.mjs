/**
 * A small in-process obs-websocket v5 server for tests. It speaks the real protocol (Hello / Identify / requests /
 * events, in both the JSON and MessagePack encodings obs-websocket-js can use) over a real WebSocket, so the app's own
 * obs-websocket-js client runs against it unchanged.
 *
 * It simulates:
 *   - scenes and scene items with transforms (GetSceneItemList / GetSceneItemId / Get- and SetSceneItemTransform),
 *     emitting the high-volume `SceneItemTransformChanged` event only to clients that subscribed to it,
 *   - inputs and their settings (GetInputList / GetInputSettings / SetInputSettings with `overlay`), emitting
 *     `InputSettingsChanged`, and TriggerMediaInputAction,
 *   - BroadcastCustomEvent, delivered as `CustomEvent` to every identified client (like the real thing),
 *   - GetSceneList / GetVersion, and `CurrentProgramSceneChanged` via `setScene()`.
 *
 * Every request is recorded in `mock.requests` so tests can assert on exactly what was sent.
 */
import { decode, encode } from '@msgpack/msgpack'
import { WebSocketServer } from 'ws'

const SCENE_ITEM_TRANSFORM_CHANGED = 1 << 19 // EventSubscription.SceneItemTransformChanged (high volume)
const ALL_LOW_VOLUME = (1 << 11) - 1 // everything obs-websocket-js's `All` covers

export const defaultTransform = (over = {}) => ({
  positionX: 0, positionY: 0, rotation: 0, scaleX: 1, scaleY: 1,
  sourceWidth: 400, sourceHeight: 200, width: 400, height: 200,
  alignment: 5, boundsType: 'OBS_BOUNDS_NONE', boundsAlignment: 0, boundsWidth: 1, boundsHeight: 1,
  cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0, ...over,
})

/** The scene contents most tests want. */
export function sampleState() {
  return {
    currentScene: 'Gameplay',
    scenes: {
      Gameplay: [
        { sceneItemId: 1, sourceName: 'Webcam', inputKind: 'dshow_input', transform: defaultTransform() },
        { sceneItemId: 2, sourceName: 'Logo', inputKind: 'image_source', transform: defaultTransform({ positionX: 100, positionY: 50 }) },
      ],
      Intro: [{ sceneItemId: 1, sourceName: 'Logo', inputKind: 'image_source', transform: defaultTransform({ positionX: 7 }) }],
    },
    inputs: {
      Webcam: { kind: 'dshow_input', settings: {} },
      Logo: { kind: 'image_source', settings: { file: 'C:/old/logo.png', unload: false } },
      Loop: { kind: 'ffmpeg_source', settings: { is_local_file: true, local_file: 'C:/old/loop.mp4', looping: true } },
      Stream: { kind: 'ffmpeg_source', settings: { is_local_file: false, input: 'rtmp://example/live' } },
    },
  }
}

class RequestError extends Error {
  constructor(code, comment) {
    super(comment)
    this.code = code
  }
}

/** Starts the mock on a free port (or `port`). `await mock.close()` when done. */
export async function startMockObs({ port = 0, state = sampleState() } = {}) {
  const requests = []
  const clients = new Set()
  const wss = new WebSocketServer({ port, host: '127.0.0.1', handleProtocols: (protocols) => [...protocols][0] ?? false })
  await new Promise((resolve) => wss.once('listening', resolve))

  const sceneItems = (name) => {
    const items = state.scenes[name]
    if (!items) throw new RequestError(600, `No scene was found by the name of ${name}`)
    return items
  }
  const findItem = (d) => {
    const items = sceneItems(d.sceneName)
    const item = items.find((i) => i.sceneItemId === d.sceneItemId)
    if (!item) throw new RequestError(600, `No scene item was found in scene ${d.sceneName} with id ${d.sceneItemId}`)
    return item
  }
  const input = (name) => {
    const i = state.inputs[name]
    if (!i) throw new RequestError(600, `No input was found by the name of ${name}`)
    return i
  }
  const need = (d, key, type) => {
    if (typeof d[key] !== type) throw new RequestError(300, `Your request is missing or has an invalid ${key}`)
  }

  const send = (c, op, d) => c.ws.send(c.binary ? encode({ op, d }) : JSON.stringify({ op, d }))
  const emit = (eventType, eventData, { highVolumeBit } = {}) => {
    for (const c of clients) {
      if (!c.identified) continue
      if (highVolumeBit && !(c.subscriptions & highVolumeBit)) continue
      send(c, 5, { eventType, eventIntent: highVolumeBit ?? 1, eventData })
    }
  }

  const handlers = {
    GetVersion: () => ({ obsVersion: '32.0.0', obsWebSocketVersion: '5.7.0', rpcVersion: 1, availableRequests: [], supportedImageFormats: ['png'] }),
    GetSceneList: () => ({
      currentProgramSceneName: state.currentScene,
      currentPreviewSceneName: null,
      // obs-websocket lists bottom-up
      scenes: Object.keys(state.scenes).map((sceneName, sceneIndex) => ({ sceneName, sceneIndex })).reverse(),
    }),
    GetSceneItemList: (d) => ({
      sceneItems: sceneItems(d.sceneName).map(({ sceneItemId, sourceName, inputKind }, sceneItemIndex) => ({
        sceneItemId, sourceName, inputKind, sceneItemIndex, isGroup: false, sourceType: 'OBS_SOURCE_TYPE_INPUT',
      })),
    }),
    GetSceneItemId: (d) => {
      const items = sceneItems(d.sceneName)
      const item = items.find((i) => i.sourceName === d.sourceName)
      if (!item) throw new RequestError(600, `No scene items were found in scene ${d.sceneName} with source ${d.sourceName}`)
      return { sceneItemId: item.sceneItemId }
    },
    GetSceneItemTransform: (d) => ({ sceneItemTransform: { ...findItem(d).transform } }),
    SetSceneItemTransform: (d) => {
      const item = findItem(d)
      const t = d.sceneItemTransform
      if (!t || typeof t !== 'object') throw new RequestError(300, 'Your request is missing the sceneItemTransform')
      for (const [k, v] of Object.entries(t)) {
        if (!(k in item.transform)) throw new RequestError(400, `Unknown transform field ${k}`)
        if (typeof v !== 'number' || !Number.isFinite(v)) throw new RequestError(400, `Transform field ${k} must be a number`)
      }
      Object.assign(item.transform, t)
      // The rendered size follows the scale, like OBS (when there are no bounds)
      item.transform.width = item.transform.sourceWidth * Math.abs(item.transform.scaleX)
      item.transform.height = item.transform.sourceHeight * Math.abs(item.transform.scaleY)
      emit(
        'SceneItemTransformChanged',
        { sceneName: d.sceneName, sceneUuid: 'uuid', sceneItemId: d.sceneItemId, sceneItemTransform: { ...item.transform } },
        { highVolumeBit: SCENE_ITEM_TRANSFORM_CHANGED },
      )
      return undefined
    },
    GetInputList: () => ({
      inputs: Object.entries(state.inputs).map(([inputName, i]) => ({ inputName, inputKind: i.kind, unversionedInputKind: i.kind, inputUuid: inputName })),
    }),
    GetInputSettings: (d) => {
      const i = input(d.inputName)
      return { inputSettings: { ...i.settings }, inputKind: i.kind }
    },
    SetInputSettings: (d) => {
      const i = input(d.inputName)
      need(d, 'inputSettings', 'object')
      i.settings = d.overlay === false ? { ...d.inputSettings } : { ...i.settings, ...d.inputSettings }
      emit('InputSettingsChanged', { inputName: d.inputName, inputUuid: d.inputName, inputSettings: { ...i.settings } })
      return undefined
    },
    TriggerMediaInputAction: (d) => {
      const i = input(d.inputName)
      if (i.kind !== 'ffmpeg_source') throw new RequestError(604, 'The input is not a media input')
      need(d, 'mediaAction', 'string')
      emit('MediaInputActionTriggered', { inputName: d.inputName, inputUuid: d.inputName, mediaAction: d.mediaAction })
      return undefined
    },
    BroadcastCustomEvent: (d) => {
      need(d, 'eventData', 'object')
      emit('CustomEvent', d.eventData)
      return undefined
    },
  }

  wss.on('connection', (ws, req) => {
    const client = { ws, binary: String(req.headers['sec-websocket-protocol'] ?? '').includes('msgpack'), identified: false, subscriptions: 0 }
    clients.add(client)
    send(client, 0, { obsWebSocketVersion: '5.7.0', rpcVersion: 1 })
    ws.on('close', () => clients.delete(client))
    ws.on('message', (raw, isBinary) => {
      const m = isBinary ? decode(raw) : JSON.parse(raw.toString())
      if (m.op === 1) {
        client.identified = true
        client.subscriptions = (m.d.eventSubscriptions ?? ALL_LOW_VOLUME) | 0
        return send(client, 2, { negotiatedRpcVersion: 1 })
      }
      if (m.op !== 6 || !client.identified) return
      const { requestType, requestId, requestData } = m.d
      const data = requestData ?? {}
      requests.push({ type: requestType, data })
      const reply = (ok, code, comment, responseData) =>
        send(client, 7, {
          requestType, requestId,
          requestStatus: ok ? { result: true, code: 100 } : { result: false, code, comment },
          ...(responseData === undefined ? {} : { responseData }),
        })
      const handler = handlers[requestType]
      if (!handler) return reply(false, 204, `Unknown request type: ${requestType}`)
      try {
        reply(true, 100, undefined, handler(data))
      } catch (e) {
        if (e instanceof RequestError) reply(false, e.code, e.message)
        else throw e
      }
    })
  })

  return {
    url: `ws://127.0.0.1:${wss.address().port}`,
    state,
    /** Every request received, oldest first: `{ type, data }`. */
    requests,
    requestsOf: (type) => requests.filter((r) => r.type === type),
    clearRequests: () => requests.splice(0),
    /** Sends an event to every identified client. */
    emit,
    /** Changes the program scene and announces it, like switching scenes in OBS. */
    setScene: (sceneName) => {
      state.currentScene = sceneName
      emit('CurrentProgramSceneChanged', { sceneName, sceneUuid: sceneName })
    },
    /** Moves an item as if the user dragged it in OBS (emits SceneItemTransformChanged). */
    moveInObs: (sceneName, sceneItemId, patch) => handlers.SetSceneItemTransform({ sceneName, sceneItemId, sceneItemTransform: patch }),
    clientCount: () => [...clients].filter((c) => c.identified).length,
    close: () =>
      new Promise((resolve) => {
        for (const c of clients) c.ws.terminate()
        wss.close(() => resolve())
      }),
  }
}
