/**
 * Central runtime configuration, read from Vite env vars.
 *
 * Secrets are NEVER hardcoded. Provide them via a local `.env` file (see
 * `.env.example`) or via the hosting provider's environment settings.
 *
 * NOTE: Anything prefixed `VITE_` is embedded into the client bundle and is
 * therefore PUBLIC. The Supabase anon key and an EODHD key placed here are
 * visible to end users. That is acceptable for the anon key (Row Level
 * Security protects the data). For EODHD, prefer routing calls through a
 * Supabase Edge Function so the key stays server-side — see the data-layer
 * phase. `VITE_EODHD_API_KEY` below is only for early local testing.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const eodhdApiKey = import.meta.env.VITE_EODHD_API_KEY ?? ''

export const config = {
  supabaseUrl,
  supabaseAnonKey,
  eodhdApiKey,
  hasSupabase: Boolean(supabaseUrl && supabaseAnonKey),
  hasEodhd: Boolean(eodhdApiKey),
} as const
