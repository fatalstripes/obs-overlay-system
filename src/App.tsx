import { useEffect } from 'react'
import { ConnectionPanel } from './components/ConnectionPanel'
import { SyncErrorBanner } from './components/SyncErrorBanner'
import { ScenePanel } from './components/ScenePanel'
import { ShaderLibraryPanel } from './components/ShaderLibraryPanel'
import { PresetPanel } from './components/PresetPanel'
import { ShaderPanel } from './components/ShaderPanel'
import { TextPanel } from './components/TextPanel'
import { startSceneBinding } from './lib/sceneBinding'
import { startLiveSync } from './lib/sync'
import { useObsStore } from './store/useObsStore'

export default function App() {
  useEffect(() => startLiveSync(), [])

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
    </div>
  )
}
