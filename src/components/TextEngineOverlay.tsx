import { useEffect, useState } from 'react'
import { startOverlayClient, type OverlayStatus } from '../lib/overlayClient'
import { DEFAULT_SETTINGS, sanitizeSettings, type OverlayRoute, type TextEngineSettings } from '../lib/textEngine'
import { TextEngineView } from './TextEngineView'

const LAST_KEY = 'obs-overlay-textengine-last'

function loadLast(): TextEngineSettings {
  try {
    const raw = localStorage.getItem(LAST_KEY)
    return raw ? sanitizeSettings(JSON.parse(raw)) : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

/**
 * The page to load as an OBS Browser Source (`index.html#/overlay/text?ws=...`). Transparent background, nothing but the
 * text; it follows the dashboard's settings live through obs-websocket CustomEvents.
 */
export function TextEngineOverlay({ route }: { route: NonNullable<OverlayRoute> }) {
  // Settings are remembered, so a reloaded source shows the last text immediately instead of waiting for the socket.
  const [settings, setSettings] = useState<TextEngineSettings>(loadLast)
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
      startOverlayClient({
        url: route.ws,
        password: route.password,
        onSettings: (next) => {
          setSettings(next)
          try {
            localStorage.setItem(LAST_KEY, JSON.stringify(next))
          } catch {
            // storage can be unavailable; the overlay still works
          }
        },
        onStatus: (s, detail) => setStatus({ s, detail }),
      }),
    [route.ws, route.password],
  )

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <TextEngineView settings={settings} />
      {route.debug && (
        <div
          style={{
            position: 'fixed', left: 6, bottom: 6, font: '12px system-ui', color: '#fff',
            background: 'rgba(0,0,0,.6)', padding: '2px 6px', borderRadius: 4,
          }}
        >
          text engine: {status.s}
          {status.detail ? ` (${status.detail})` : ''}
        </div>
      )}
    </div>
  )
}
