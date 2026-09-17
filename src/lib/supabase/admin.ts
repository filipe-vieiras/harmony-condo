import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente com a service role key — NUNCA importar isso em componente 'use client'
 * nem em qualquer módulo que rode no navegador. Usar apenas dentro de Route
 * Handlers (src/app/api/**) ou Server Components/Actions.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
