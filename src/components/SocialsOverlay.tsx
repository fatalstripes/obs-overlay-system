import { useEffect, useState } from 'react'
import { startBridgeClient, type OverlayStatus } from '../lib/overlayClient'
import {
  DEFAULT_SOCIALS, parseSocialsMessage, sanitizeSocials, socialsAckMessage, socialsRequestMessage,
  type SocialsRoute, type SocialsSettings,
} from '../lib/socials'
import { SocialsView } from './SocialsView'

const LAST_KEY = 'obs-overlay-socials-last'

function loadLast(): SocialsSettings {
  try {
    const raw = localStorage.getItem(LAST_KEY)
    return raw ? sanitizeSocials(JSON.parse(raw)) : DEFAULT_SOCIALS
  } catch {
    return DEFAULT_SOCIALS
  }
}

/**
 * The page to load as an OBS Browser Source (`index.html#/overlay/socials?ws=...`). Transparent background, nothing but
 * the rotating handles; it follows the dashboard's settings live through obs-websocket CustomEvents.
 */
export function SocialsOverlay({ route }: { route: NonNullable<SocialsRoute> }) {
  const [settings, setSettings] = useState<SocialsSettings>(loadLast)
  const [status, setStatus] = useState<{ s: OverlayStatus; detail?: string }>({ s: 'connecting' })

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prev = [html.style.background, body.style.background, body.style.overflow]
    html.style.background = 'transparent'
    body.style.background = 'transparent'
    body.style.overflow = 'hidden'
    return () => {
      ;[html.style.background, body.style.background, body.style.overflow] = prev
    }
  }, [])

  useEffect(
    () =>
      startBridgeClient({
        url: route.ws,
        password: route.password,
        hello: socialsRequestMessage(),
        onStatus: (s, detail) => setStatus({ s, detail }),
        onEvent: (data) => {
          const msg = parseSocialsMessage(data)
          if (msg?.type !== 'settings') return
          setSettings(msg.settings)
          try {
            localStorage.setItem(LAST_KEY, JSON.stringify(msg.settings))
          } catch {
            // storage can be unavailable; the overlay still works
          }
          return socialsAckMessage(Date.now())
        },
      }),
    [route.ws, route.password],
  )

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <SocialsView settings={settings} />
      {route.debug && (
        <div
          style={{
            position: 'fixed', left: 6, bottom: 6, font: '12px system-ui', color: '#fff',
            background: 'rgba(0,0,0,.6)', padding: '2px 6px', borderRadius: 4,
          }}
        >
          socials: {status.s}
          {status.detail ? ` (${status.detail})` : ''}
        </div>
      )}
    </div>
  )
}
