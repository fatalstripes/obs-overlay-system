import { toEventData } from './overlayClient.ts'
import { errorMessage } from './sync.ts'
import { parseSocialsMessage, socialsSettingsMessage } from './socials.ts'
import { obs, useObsStore } from '../store/useObsStore.ts'
import { useSocialsStore } from '../store/useSocialsStore.ts'

/** Broadcasts the current socials settings to every socials overlay listening on this OBS (obs-websocket CustomEvent). */
export async function sendSocialsSettings(): Promise<void> {
  const { settings } = useSocialsStore.getState()
  await obs.call('BroadcastCustomEvent', { eventData: toEventData(socialsSettingsMessage(settings)) })
  useSocialsStore.setState({ lastSentAt: Date.now() })
}

const report = (e: unknown) => useObsStore.setState({ syncError: errorMessage(e) })

/**
 * The dashboard's half of the socials bridge: pushes settings as they change (throttled, while connected and live sync
 * is on), pushes on connect, answers an overlay's "request" and records its "ack".
 */
export function startSocialsBridge(throttleMs = 60): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined

  const push = () => {
    if (useObsStore.getState().status !== 'connected') return
    sendSocialsSettings().catch(report)
  }

  const unsubSettings = useSocialsStore.subscribe((s, prev) => {
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
    const msg = parseSocialsMessage(data)
    if (msg?.type === 'request') push()
    else if (msg?.type === 'ack') useSocialsStore.setState({ lastAckAt: msg.at })
  }
  obs.on('CustomEvent', onCustomEvent)

  return () => {
    unsubSettings()
    unsubObs()
    obs.off('CustomEvent', onCustomEvent)
    clearTimeout(timer)
  }
}
