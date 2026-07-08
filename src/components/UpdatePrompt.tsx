import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Surfaces the two states vite-plugin-pwa's service worker reaches: a fresh
 * install that's now cached for offline use, and a new version waiting to
 * take over. Installed PWAs are often left open for days, so a silent
 * autoUpdate would otherwise never actually apply until the user manually
 * reloads.
 */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!offlineReady && !needRefresh) return null

  function dismiss() {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm shadow-lg">
      <p className="text-slate-200">
        {needRefresh
          ? 'A new version is ready.'
          : 'Open Markets is ready to work offline.'}
      </p>
      <div className="flex shrink-0 gap-2">
        {needRefresh ? (
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-500"
          >
            Reload
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-400"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
