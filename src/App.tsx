import { useEffect } from 'react'
import { ConnectionPanel } from './components/ConnectionPanel'
import { ShaderLibraryPanel } from './components/ShaderLibraryPanel'
import { PresetPanel } from './components/PresetPanel'
import { ShaderPanel } from './components/ShaderPanel'
import { TextPanel } from './components/TextPanel'
import { startLiveSync } from './lib/sync'

export default function App() {
  useEffect(() => startLiveSync(), [])

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">OBS Overlay Control</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <ConnectionPanel />
          <PresetPanel />
          <ShaderLibraryPanel />
        </div>
        <ShaderPanel />
        <TextPanel />
      </div>
    </div>
  )
}
