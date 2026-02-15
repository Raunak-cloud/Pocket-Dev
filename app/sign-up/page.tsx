"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSupabaseAuth } from "@/lib/supabase-auth/client";

export default function SignUpPage() {
  const { openSignIn } = useSupabaseAuth();
  const params = useSearchParams();

  useEffect(() => {
    const redirect = params.get("redirect") || "/";
    void openSignIn({ redirectUrl: redirect });
  }, [openSignIn, params]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-text-tertiary">Redirecting to sign up...</p>
    </div>
  );
}
