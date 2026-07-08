import { Screen } from './Screen'

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <Screen>
      <p className="text-center text-sm text-slate-400">{label}</p>
    </Screen>
  )
}
