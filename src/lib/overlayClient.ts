import OBSWebSocket, { type OBSRequestTypes } from 'obs-websocket-js'
import {
  ackMessage, parseBridgeMessage, requestMessage, type TextEngineSettings,
} from './textEngine.ts'

export type OverlayStatus = 'connecting' | 'connected' | 'disconnected'

/** Bridge messages are plain JSON; obs-websocket-js just wants its own JSON object type. */
export const toEventData = (message: object) => message as unknown as OBSRequestTypes['BroadcastCustomEvent']['eventData']

type ClientOptions = {
  url: string
  password: string
  /** Sent on every (re)connect; the dashboard replies with the current settings. */
  hello: object
  /** Called with every CustomEvent's data; return a message to send back (the ack), or nothing to ignore the event. */
  onEvent: (data: unknown) => object | void
  onStatus: (s: OverlayStatus, detail?: string) => void
}

/**
 * An overlay's own obs-websocket connection. A Browser Source page is just another client, so it connects like the
 * dashboard does, listens for our `CustomEvent`s and asks the dashboard for the current settings on every
 * (re)connect. It reconnects with a backoff when OBS restarts or the socket drops. Returns a stop function.
 */
export function startBridgeClient({ url, password, hello, onEvent, onStatus }: ClientOptions): () => void {
  const obs = new OBSWebSocket()
  const send = (message: object) => obs.call('BroadcastCustomEvent', { eventData: toEventData(message) })
  let stopped = false
  let retry: ReturnType<typeof setTimeout> | undefined
  let delay = 1000

  const connect = async () => {
    if (stopped) return
    onStatus('connecting')
    try {
      await obs.connect(url, password || undefined)
      delay = 1000
      onStatus('connected')
      await send(hello)
    } catch (e) {
      onStatus('disconnected', e instanceof Error ? e.message : String(e))
      schedule()
    }
  }
  const schedule = () => {
    if (stopped) return
    clearTimeout(retry)
    retry = setTimeout(() => void connect(), delay)
    delay = Math.min(delay * 2, 10_000)
  }

  obs.on('CustomEvent', (data) => {
    const reply = onEvent(data)
    if (reply) void send(reply).catch(() => {})
  })
  obs.on('ConnectionClosed', () => {
    if (stopped) return
    onStatus('disconnected')
    schedule()
  })

  void connect()
  return () => {
    stopped = true
    clearTimeout(retry)
    void obs.disconnect().catch(() => {})
  }
}

type TextOptions = {
  url: string
  password: string
  onSettings: (s: TextEngineSettings) => void
  onStatus: (s: OverlayStatus, detail?: string) => void
}

/** The text overlay's client: applies `settings` messages and acknowledges them. */
export function startOverlayClient({ url, password, onSettings, onStatus }: TextOptions): () => void {
  return startBridgeClient({
    url,
    password,
    hello: requestMessage(),
    onStatus,
    onEvent: (data) => {
      const msg = parseBridgeMessage(data)
      if (msg?.type !== 'settings') return // our own requests/acks and anyone else's events are ignored
      onSettings(msg.settings)
      return ackMessage(Date.now())
    },
  })
}
