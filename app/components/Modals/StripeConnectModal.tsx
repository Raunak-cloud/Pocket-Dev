"use client";

import { useState } from "react";

interface StripeConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectStatus: string | null; // null = not connected, "pending" | "restricted" | "active"
  onSuccess: () => void; // called after redirect to Stripe finishes and payments should be enabled
}

export function StripeConnectModal({
  isOpen,
  onClose,
  connectStatus,
  onSuccess,
}: StripeConnectModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isPending = connectStatus === "pending" || connectStatus === "restricted";

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = isPending
        ? "/api/stripe/connect/refresh-link"
        : "/api/stripe/connect/create-account";
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        setError(data.error);
      }
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // If already active, just enable and close
  if (connectStatus === "active") {
    onSuccess();
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="relative px-6 pt-8 pb-4 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 flex items-center justify-center">
            <svg className="w-7 h-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
          </div>

          <h3 className="text-xl font-semibold text-text-primary">
            Connect Stripe to Accept Payments
          </h3>
          <p className="text-text-tertiary text-sm mt-2 leading-relaxed">
            {isPending
              ? "Your Stripe account setup is incomplete. Complete onboarding to enable payments in your apps."
              : "Connect your Stripe account so your generated apps can accept real payments. Setup takes about 2 minutes."}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 space-y-3">
          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium rounded-xl transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Redirecting to Stripe...
              </>
            ) : isPending ? (
              "Complete Setup"
            ) : (
              "Connect Stripe"
            )}
          </button>

          <button
            onClick={onClose}
            className="w-full py-3 text-text-tertiary hover:text-text-primary text-sm font-medium rounded-xl transition"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
