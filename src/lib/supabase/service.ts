import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env-server";

/**
 * Service-role client. BYPASSES Row Level Security. Use only in server code that has already
 * authorised the caller: webhooks, signed document URLs for admins, scheduled jobs.
 */
export function createServiceClient() {
  return createClient(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
