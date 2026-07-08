import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from './config'

/**
 * Singleton Supabase client. Returns `null` until credentials are configured,
 * so the app can render a "setup required" state instead of crashing.
 */
let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!config.hasSupabase) return null
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}
