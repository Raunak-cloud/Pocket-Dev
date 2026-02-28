"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSupabaseAuth } from "@/lib/supabase-auth/client";

function SignUpContent() {
  const { openSignIn } = useSupabaseAuth();
  const params = useSearchParams();

  useEffect(() => {
    const redirect = params.get("redirect") || "/";
    void openSignIn({ redirectUrl: redirect });
  }, [openSignIn, params]);

  return (
    <p className="text-sm text-text-tertiary">Redirecting to sign up...</p>
  );
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Suspense fallback={<p className="text-sm text-text-tertiary">Loading...</p>}>
        <SignUpContent />
      </Suspense>
    </div>
  );
}
