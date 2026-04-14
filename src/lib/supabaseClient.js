import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Browser Supabase client (uses anon key + RLS).
 * If env vars are missing, returns null so the app can keep using mocks until configured.
 */
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;

export function isSupabaseConfigured() {
  return Boolean(supabase);
}
