import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Supabase-Client mit Service-Role-Key (umgeht RLS).
 * Wird lazy initialisiert, damit der Server auch ohne gesetzte
 * Env-Variablen startet (z.B. für /api/health im Setup).
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein (.env).'
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !process.env.SUPABASE_URL.includes('DEIN-PROJEKT')
  );
}
