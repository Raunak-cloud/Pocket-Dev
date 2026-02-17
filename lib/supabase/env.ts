export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL).",
    );
  }
  return url;
}

export function getSupabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Missing Supabase publishable key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }
  return key;
}

export function getSupabaseSecretKey(): string {
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing Supabase secret key. Set SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  return key;
}

export function getSupabaseEnvBundle() {
  const bundle: Record<string, string> = {};
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url) {
    bundle.NEXT_PUBLIC_SUPABASE_URL = url;
  }
  if (publishable) {
    // Expose both names for compatibility with legacy/generated code.
    bundle.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishable;
    bundle.NEXT_PUBLIC_SUPABASE_ANON_KEY = publishable;
  }

  // SECURITY: Never expose service role key to generated apps
  // Multi-tenant architecture uses Row-Level Security (RLS) for data isolation
  // Service role key bypasses RLS and would allow cross-tenant data access
  // Generated apps should only use the anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY)

  return bundle;
}
