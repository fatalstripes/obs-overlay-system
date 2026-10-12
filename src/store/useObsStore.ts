import OBSWebSocket from 'obs-websocket-js'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  /** Reconnect automatically on load. Set after a successful connect, cleared by Disconnect. */
  autoConnect: boolean
  inputs: string[]
  filters: string[]
  /** Whether the chosen shader filter has "Use Effect File (.effect)" ticked (the `override_entire_effect` setting) ('unknown' if it isn't a shader filter). */
  shaderOverride: 'on' | 'off' | 'unknown'
  /** Whether the chosen shader filter is switched on in OBS (the eye icon); null if it can't be found. */
  shaderEnabled: boolean | null

  setUrl: (url: string) => void
  setPassword: (password: string) => void
  setLiveSync: (on: boolean) => void
  forgetPassword: () => void
  dismissSyncError: () => void
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  refreshInputs: () => Promise<void>
  /** Loads the source's filters into the store and returns their names. */
  refreshFilters: (source: string) => Promise<string[]>
  refreshShaderOverride: (source: string, filter: string) => Promise<void>
  /** Switches the filter on or off in OBS. Rejects if OBS refuses. */
  setShaderEnabled: (source: string, filter: string, enabled: boolean) => Promise<void>
}

export const useObsStore = create<ObsState>()(
  persist(
    (set, get) => ({
      url: 'ws://localhost:4455',
      password: '',
      status: 'disconnected',
      error: null,
      syncError: null,
      liveSync: true,
      autoConnect: false,
      inputs: [],
      filters: [],
      shaderOverride: 'unknown',
      shaderEnabled: null,

      setUrl: (url) => set({ url }),
      setPassword: (password) => set({ password }),
      setLiveSync: (liveSync) => set({ liveSync }),
      forgetPassword: () => set({ password: '', autoConnect: false }),
      dismissSyncError: () => set({ syncError: null }),

      connect: async () => {
        const { url, password, status } = get()
        if (status !== 'disconnected') return // e.g. StrictMode's double mount, or a double click
        set({ status: 'connecting', error: null })
        try {
          await obs.connect(url, password || undefined)
          set({ status: 'connected', autoConnect: true })
          await get().refreshInputs()
        } catch (e) {
          set({ status: 'disconnected', error: e instanceof Error ? e.message : String(e) })
        }
      },

      disconnect: async () => {
        // An explicit disconnect means "don't reconnect on next load"; a dropped connection does not.
        set({ autoConnect: false })
        await obs.disconnect()
      },

      refreshInputs: async () => {
        const { inputs } = await obs.call('GetInputList')
        set({ inputs: inputs.map((i) => String(i.inputName)) })
      },

      refreshFilters: async (source) => {
        let names: string[] = []
        if (source) {
          try {
            const { filters } = await obs.call('GetSourceFilterList', { sourceName: source })
            names = filters.map((f) => String(f.filterName))
          } catch {
            // unknown source: leave the list empty
          }
        }
        set({ filters: names })
        return names
      },

      refreshShaderOverride: async (source, filter) => {
        let state: 'on' | 'off' | 'unknown' = 'unknown'
        let enabled: boolean | null = null
        if (source && filter) {
          try {
            const f = await obs.call('GetSourceFilter', { sourceName: source, filterName: filter })
            enabled = f.filterEnabled
            // Only obs-shaderfilter filters have this setting; leave other filter kinds alone.
            if (String(f.filterKind).includes('shader')) {
              state = f.filterSettings.override_entire_effect === true ? 'on' : 'off'
            }
          } catch {
            // unknown source/filter
          }
        }
        set({ shaderOverride: state, shaderEnabled: enabled })
      },

      setShaderEnabled: async (source, filter, enabled) => {
        await obs.call('SetSourceFilterEnabled', { sourceName: source, filterName: filter, filterEnabled: enabled })
        set({ shaderEnabled: enabled })
      },
    }),
    {
      name: 'obs-overlay-connection',
      // The password is stored in this browser's localStorage in plain text (it only guards a local OBS).
      partialize: (s) => ({ url: s.url, password: s.password, liveSync: s.liveSync, autoConnect: s.autoConnect }),
    },
  ),
)

obs.on('ConnectionClosed', () => {
  useObsStore.setState({ status: 'disconnected', inputs: [], filters: [], shaderOverride: 'unknown', shaderEnabled: null })
})
