import { createClient } from "@supabase/supabase-js"
import type { Database } from "./types"

/**
 * Server-side Supabase client.
 *
 * Since we replaced Supabase Auth with Clerk, RLS policies based on
 * `auth.uid()` no longer apply. App-layer gates (requireRole,
 * requireBrandAccess) enforce permissions instead. So every server
 * call uses the service-role client which bypasses RLS.
 *
 * Kept as `createSupabaseServerClient` (the historical name) so
 * existing call sites work unchanged.
 */
export async function createSupabaseServerClient() {
  return createSupabaseServiceClient()
}

export function createSupabaseServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
