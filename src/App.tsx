import { useEffect, useState } from 'react'
import { CustomTextPanel } from './components/CustomTextPanel'
import { LayoutPanel } from './components/LayoutPanel'
import { MediaSwapPanel } from './components/MediaSwapPanel'
import { SocialsOverlay } from './components/SocialsOverlay'
import { SocialsPanel } from './components/SocialsPanel'
import { TextEngineOverlay } from './components/TextEngineOverlay'
import { ConnectionPanel } from './components/ConnectionPanel'
import { SyncErrorBanner } from './components/SyncErrorBanner'
import { ScenePanel } from './components/ScenePanel'
import { ShaderLibraryPanel } from './components/ShaderLibraryPanel'
import { PresetPanel } from './components/PresetPanel'
import { ShaderPanel } from './components/ShaderPanel'
import { TextPanel } from './components/TextPanel'
import { startSceneBinding } from './lib/sceneBinding'
import { startLayoutSync } from './lib/layoutSync'
import { parseSocialsRoute } from './lib/socials'
import { startSocialsBridge } from './lib/socialsBridge'
import { startLiveSync } from './lib/sync'
import { startTextBridge } from './lib/textBridge'
import { parseOverlayRoute } from './lib/textEngine'
import { useObsStore } from './store/useObsStore'

function Dashboard() {
  useEffect(() => startLiveSync(), [])

  // Broadcast the text engine's settings to the overlay Browser Source.
  useEffect(() => startTextBridge(), [])

  // Same for the Socials rotator overlay.
  useEffect(() => startSocialsBridge(), [])

  // Keep the Layout panel in step with transforms changed in OBS.
  useEffect(() => startLayoutSync(), [])

  // Follow OBS's program scene. Registered before the auto-connect below so its first scene isn't missed.
  useEffect(() => startSceneBinding(), [])

  // One-time setup: if we connected before (and didn't explicitly disconnect), reconnect on load.
  useEffect(() => {
    const { autoConnect, connect } = useObsStore.getState()
    if (autoConnect) void connect()
  }, [])

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <SyncErrorBanner />
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">OBS Overlay Control</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <ConnectionPanel />
          <PresetPanel />
          <ScenePanel />
          <ShaderLibraryPanel />
        </div>
        <ShaderPanel />
        <TextPanel />
      </div>
      <div className="mt-4 space-y-4">
        <CustomTextPanel />
        <SocialsPanel />
        <div className="grid gap-4 lg:grid-cols-2">
          <LayoutPanel />
          <MediaSwapPanel />
        </div>
      </div>
    </div>
  )
}

/**
 * Hash routing, so the same build works from GitHub Pages and from file:// (no server rewrites needed):
 * `#/overlay/text?...` and `#/overlay/socials?...` are the transparent overlays for OBS Browser Sources; anything else
 * is the dashboard.
 */
export default function App() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const text = parseOverlayRoute(hash)
  if (text) return <TextEngineOverlay route={text} />
  const socials = parseSocialsRoute(hash)
  if (socials) return <SocialsOverlay route={socials} />
  return <Dashboard />
}
