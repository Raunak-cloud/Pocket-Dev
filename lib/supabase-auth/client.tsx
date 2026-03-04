"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type AuthClientUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  username: string | null;
  imageUrl: string | null;
};

type AuthClientContext = {
  user: AuthClientUser | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  openSignIn: (opts?: { redirectUrl?: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthClientContext | null>(null);

function resolveAuthRedirectOrigin(): string {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_AUTH_REDIRECT_ORIGIN?.trim() || "";
  const browserOrigin =
    typeof window !== "undefined" ? window.location.origin : "";

  if (!configuredOrigin) {
    return browserOrigin;
  }

  try {
    return new URL(configuredOrigin).origin;
  } catch {
    console.warn(
      "[Auth] Invalid NEXT_PUBLIC_AUTH_REDIRECT_ORIGIN. Falling back to window.location.origin.",
    );
    return browserOrigin;
  }
}

function toAuthClientUser(user: SupabaseUser): AuthClientUser {
  return {
    id: user.id,
    email: user.email ?? null,
    fullName:
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      null,
    username:
      (user.user_metadata?.user_name as string | undefined) ||
      (user.user_metadata?.preferred_username as string | undefined) ||
      null,
    imageUrl: (user.user_metadata?.avatar_url as string | undefined) || null,
  };
}

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<AuthClientUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const {
        data: { user: supaUser },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(supaUser ? toAuthClientUser(supaUser) : null);
      setIsLoaded(true);
    };

    load();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toAuthClientUser(session.user) : null);
      setIsLoaded(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const openSignIn = useCallback(
    async (opts?: { redirectUrl?: string }) => {
      const redirectUrl = opts?.redirectUrl || "/";
      const origin = resolveAuthRedirectOrigin();
      const callback = `${origin}/auth/callback?next=${encodeURIComponent(
        redirectUrl,
      )}`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (!data?.url) {
        throw new Error("Failed to get OAuth authorization URL");
      }

      if (typeof window !== "undefined") {
        console.log("[Auth] OAuth callback:", callback);
        console.log("[Auth] OAuth URL:", data.url);
        window.location.assign(data.url);
      }
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, [supabase]);

  return (
    <AuthCtx.Provider
      value={{
        user,
        isLoaded,
        isSignedIn: Boolean(user),
        openSignIn,
        signOut,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useSupabaseUser() {
  const ctx = useContext(AuthCtx);
  if (!ctx) {
    throw new Error("useSupabaseUser must be used within SupabaseAuthProvider");
  }
  return {
    user: ctx.user,
    isLoaded: ctx.isLoaded,
    isSignedIn: ctx.isSignedIn,
  };
}

export function useSupabaseAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) {
    throw new Error("useSupabaseAuth must be used within SupabaseAuthProvider");
  }
  return {
    openSignIn: ctx.openSignIn,
    signOut: ctx.signOut,
  };
}
