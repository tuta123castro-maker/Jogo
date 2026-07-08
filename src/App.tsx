import { config } from './lib/config'

export default function App() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Open Markets</h1>
      <p className="text-sm text-slate-400">
        Private paper-trading simulator — v1 scaffold.
      </p>
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-left text-xs text-slate-300">
        <p className="mb-1 font-medium text-slate-200">Setup status</p>
        <ul className="space-y-1">
          <li>
            Supabase: {config.hasSupabase ? '✅ configured' : '⚠️ not configured'}
          </li>
          <li>
            EODHD: {config.hasEodhd ? '✅ configured' : '⚠️ not configured'}
          </li>
        </ul>
      </div>
    </main>
  )
}
