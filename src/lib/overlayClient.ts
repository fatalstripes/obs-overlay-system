import OBSWebSocket, { type OBSRequestTypes } from 'obs-websocket-js'
import {
  ackMessage, parseBridgeMessage, requestMessage, type BridgeMessage, type TextEngineSettings,
} from './textEngine'

export type OverlayStatus = 'connecting' | 'connected' | 'disconnected'

type Options = {
  url: string
  password: string
  onSettings: (s: TextEngineSettings) => void
  onStatus: (s: OverlayStatus, detail?: string) => void
}

/** Bridge messages are plain JSON; obs-websocket-js just wants its own JSON object type. */
export const toEventData = (message: BridgeMessage) => message as unknown as OBSRequestTypes['BroadcastCustomEvent']['eventData']

const send = (obs: OBSWebSocket, message: BridgeMessage) =>
  obs.call('BroadcastCustomEvent', { eventData: toEventData(message) })

/**
 * The overlay's own obs-websocket connection. A Browser Source page is just another client, so it connects like the
 * dashboard does, listens for our `CustomEvent`s and asks the dashboard for the current settings on every
 * (re)connect. It reconnects with a backoff when OBS restarts or the socket drops. Returns a stop function.
 */
export function startOverlayClient({ url, password, onSettings, onStatus }: Options): () => void {
  const obs = new OBSWebSocket()
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
      await send(obs, requestMessage()) // the dashboard replies with the current settings
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
    const msg = parseBridgeMessage(data)
    if (msg?.type !== 'settings') return // our own requests/acks and anyone else's events are ignored
    onSettings(msg.settings)
    void send(obs, ackMessage(Date.now())).catch(() => {})
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
