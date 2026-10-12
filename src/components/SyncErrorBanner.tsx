import { useEffect } from 'react'
import { useObsStore } from '../store/useObsStore'

const DISMISS_AFTER_MS = 8000

export function SyncErrorBanner() {
  const syncError = useObsStore((s) => s.syncError)
  const dismiss = useObsStore((s) => s.dismissSyncError)

  useEffect(() => {
    if (!syncError) return
    const t = setTimeout(dismiss, DISMISS_AFTER_MS)
    return () => clearTimeout(t)
  }, [syncError, dismiss])

  if (!syncError) return null
  return (
    <div
      role="alert"
      className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-xl items-start gap-3 rounded-lg border border-red-500/50 bg-red-950/90 px-4 py-3 text-sm text-red-100 shadow-lg"
    >
      <span className="flex-1">
        <strong className="font-semibold">OBS rejected an update:</strong> {syncError}
      </span>
      <button onClick={dismiss} aria-label="Dismiss" className="text-red-300 hover:text-white">
        ✕
      </button>
    </div>
  )
}
