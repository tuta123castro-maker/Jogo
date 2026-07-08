import { config } from '../lib/config'
import { Brand, Screen } from './Screen'

/** Shown until Supabase (and, ideally, EODHD) credentials are configured. */
export function SetupRequired() {
  return (
    <Screen>
      <Brand tagline="Private paper-trading simulator — v1" />
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-left text-xs text-slate-300">
        <p className="mb-2 font-medium text-slate-200">Setup required</p>
        <ul className="space-y-1">
          <li>
            Supabase: {config.hasSupabase ? '✅ configured' : '⚠️ not configured'}
          </li>
          <li>
            EODHD: {config.hasEodhd ? '✅ configured' : '⚠️ not configured'}
          </li>
        </ul>
        <p className="mt-3 text-slate-400">
          Copy <code className="text-slate-300">.env.example</code> to{' '}
          <code className="text-slate-300">.env</code>, add your Supabase
          credentials, then reload. Sign-in unlocks once Supabase is set.
        </p>
      </div>
    </Screen>
  )
}
