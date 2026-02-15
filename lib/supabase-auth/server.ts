import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type AuthUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  username: string | null;
  imageUrl: string | null;
};

function toAuthUser(user: SupabaseUser): AuthUser {
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    null;
  const username =
    (user.user_metadata?.user_name as string | undefined) ||
    (user.user_metadata?.preferred_username as string | undefined) ||
    null;
  const imageUrl =
    (user.user_metadata?.avatar_url as string | undefined) || null;

  return {
    id: user.id,
    email: user.email ?? null,
    fullName,
    username,
    imageUrl,
  };
}

export async function auth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { userId: user?.id ?? null };
}

export async function currentUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? toAuthUser(user) : null;
}

