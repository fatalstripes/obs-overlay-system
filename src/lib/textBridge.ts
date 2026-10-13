import { toEventData } from './overlayClient'
import { parseBridgeMessage, settingsMessage } from './textEngine'
import { errorMessage } from './sync'
import { obs, useObsStore } from '../store/useObsStore'
import { useTextEngineStore } from '../store/useTextEngineStore'

/** Broadcasts the current text-engine settings to every overlay listening on this OBS (obs-websocket CustomEvent). */
export async function sendTextSettings(): Promise<void> {
  const { settings } = useTextEngineStore.getState()
  await obs.call('BroadcastCustomEvent', { eventData: toEventData(settingsMessage(settings)) })
  useTextEngineStore.setState({ lastSentAt: Date.now() })
}

const report = (e: unknown) => useObsStore.setState({ syncError: errorMessage(e) })

/**
 * The dashboard's half of the bridge:
 *  - pushes settings as they change (throttled, only while connected and live sync is on),
 *  - pushes them on connect,
 *  - answers an overlay's "request" (it just loaded or reconnected) with the current settings,
 *  - records the overlay's "ack" so the panel can show that it got them.
 */
export function startTextBridge(throttleMs = 60): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined

  const push = () => {
    if (useObsStore.getState().status !== 'connected') return
    sendTextSettings().catch(report)
  }

  const unsubSettings = useTextEngineStore.subscribe((s, prev) => {
    if (s.settings === prev.settings || !useObsStore.getState().liveSync) return
    timer ??= setTimeout(() => {
      timer = undefined
      push()
    }, throttleMs)
  })

  const unsubObs = useObsStore.subscribe((s, prev) => {
    if (s.status === 'connected' && prev.status !== 'connected') push()
  })

  const onCustomEvent = (data: unknown) => {
    const msg = parseBridgeMessage(data)
    if (msg?.type === 'request') push()
    else if (msg?.type === 'ack') useTextEngineStore.setState({ lastAckAt: msg.at })
  }
  obs.on('CustomEvent', onCustomEvent)

  return () => {
    unsubSettings()
    unsubObs()
    obs.off('CustomEvent', onCustomEvent)
    clearTimeout(timer)
  }
}
