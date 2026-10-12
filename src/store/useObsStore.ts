import OBSWebSocket from 'obs-websocket-js'
import { create } from 'zustand'

export const obs = new OBSWebSocket()

export type ObsStatus = 'disconnected' | 'connecting' | 'connected'

type ObsState = {
  url: string
  password: string
  status: ObsStatus
  /** Connection failures, shown in the Connection panel. */
  error: string | null
  /** Failed pushes to OBS, shown in the dashboard-wide banner. */
  syncError: string | null
  /** Push changes to OBS as they are made. */
  liveSync: boolean
  inputs: string[]
  filters: string[]

  setUrl: (url: string) => void
  setPassword: (password: string) => void
  setLiveSync: (on: boolean) => void
  dismissSyncError: () => void
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  refreshInputs: () => Promise<void>
  refreshFilters: (source: string) => Promise<void>
}

export const useObsStore = create<ObsState>((set, get) => ({
  url: 'ws://localhost:4455',
  password: '',
  status: 'disconnected',
  error: null,
  syncError: null,
  liveSync: true,
  inputs: [],
  filters: [],

  setUrl: (url) => set({ url }),
  setPassword: (password) => set({ password }),
  setLiveSync: (liveSync) => set({ liveSync }),
  dismissSyncError: () => set({ syncError: null }),

  connect: async () => {
    const { url, password } = get()
    set({ status: 'connecting', error: null })
    try {
      await obs.connect(url, password || undefined)
      set({ status: 'connected' })
      await get().refreshInputs()
    } catch (e) {
      set({ status: 'disconnected', error: e instanceof Error ? e.message : String(e) })
    }
  },

  disconnect: async () => {
    await obs.disconnect()
  },

  refreshInputs: async () => {
    const { inputs } = await obs.call('GetInputList')
    set({ inputs: inputs.map((i) => String(i.inputName)) })
  },

  refreshFilters: async (source) => {
    if (!source) return set({ filters: [] })
    try {
      const { filters } = await obs.call('GetSourceFilterList', { sourceName: source })
      set({ filters: filters.map((f) => String(f.filterName)) })
    } catch {
      set({ filters: [] })
    }
  },
}))

obs.on('ConnectionClosed', () => {
  useObsStore.setState({ status: 'disconnected', inputs: [], filters: [] })
})
