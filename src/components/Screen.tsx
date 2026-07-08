import type { ReactNode } from 'react'

/** Centered card layout shared by the pre-app screens (auth, onboarding, setup). */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-6 py-10">
      {children}
    </main>
  )
}

export function Brand({ tagline }: { tagline?: string }) {
  return (
    <div className="text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Open Markets</h1>
      {tagline ? (
        <p className="mt-1 text-sm text-slate-400">{tagline}</p>
      ) : null}
    </div>
  )
}
