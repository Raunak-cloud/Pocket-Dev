import { createClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey, getSupabaseUrl } from "@/lib/supabase/env";

export function createAdminClient() {
  const url = getSupabaseUrl();
  const secret = getSupabaseSecretKey();

  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
