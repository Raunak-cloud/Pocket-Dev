"use client";

import { useState, useEffect, useCallback } from "react";
import type { CompatibleUser } from "@/app/contexts/AuthContext";
import type { SavedProject } from "@/app/types";

interface StripeConnectInfo {
  connected: boolean;
  status: string | null;
  onboardingComplete?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
}

interface SettingsContentProps {
  user: CompatibleUser | null;
  savedProjects: SavedProject[];
}

export default function SettingsContent({ user, savedProjects }: SettingsContentProps) {
  const [stripeInfo, setStripeInfo] = useState<StripeConnectInfo | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeActionLoading, setStripeActionLoading] = useState(false);

  const fetchStripeStatus = useCallback(async () => {
    if (!user) return;
    setStripeLoading(true);
    try {
      const res = await fetch("/api/stripe/connect/status");
      if (res.ok) {
        setStripeInfo(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setStripeLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStripeStatus();
  }, [fetchStripeStatus]);

  const handleConnectStripe = async () => {
    setStripeActionLoading(true);
    try {
      const res = await fetch("/api/stripe/connect/create-account", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // silently fail
    } finally {
      setStripeActionLoading(false);
    }
  };

  const handleCompleteSetup = async () => {
    setStripeActionLoading(true);
    try {
      const res = await fetch("/api/stripe/connect/refresh-link", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // silently fail
    } finally {
      setStripeActionLoading(false);
    }
  };

  const handleOpenDashboard = async () => {
    setStripeActionLoading(true);
    try {
      const res = await fetch("/api/stripe/connect/dashboard-link", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch {
      // silently fail
    } finally {
      setStripeActionLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full p-6">
      <h2 className="text-2xl font-semibold text-text-primary mb-6">Settings</h2>

      <div className="space-y-6">
        {/* Profile Section */}
        <div className="bg-bg-secondary/50 border border-border-primary rounded-xl p-6">
          <h3 className="text-lg font-medium text-text-primary mb-4">Profile</h3>
          <div className="flex items-center gap-4">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
                <span className="text-2xl font-semibold text-text-primary">
                  {user?.displayName?.charAt(0) ||
                    user?.email?.charAt(0) ||
                    "U"}
                </span>
              </div>
            )}
            <div>
              <p className="text-text-primary font-medium">
                {user?.displayName || "User"}
              </p>
              <p className="text-text-tertiary text-sm">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="bg-bg-secondary/50 border border-border-primary rounded-xl p-6">
          <h3 className="text-lg font-medium text-text-primary mb-4">Account</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-text-tertiary">Plan</span>
              <span className="text-text-primary">Free</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-text-tertiary">Projects Created</span>
              <span className="text-text-primary">{savedProjects.length}</span>
            </div>
          </div>
        </div>

        {/* Payments Section */}
        <div className="bg-bg-secondary/50 border border-border-primary rounded-xl p-6">
          <h3 className="text-lg font-medium text-text-primary mb-4">Payments</h3>

          {stripeLoading ? (
            <div className="flex items-center gap-2 text-text-tertiary text-sm">
              <div className="w-4 h-4 border-2 border-text-tertiary/30 border-t-text-tertiary rounded-full animate-spin" />
              Loading payment status...
            </div>
          ) : !stripeInfo || !stripeInfo.connected ? (
            /* Not connected */
            <div>
              <p className="text-text-tertiary text-sm mb-4">
                Connect your Stripe account to accept payments in your generated apps.
              </p>
              <button
                onClick={handleConnectStripe}
                disabled={stripeActionLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
              >
                {stripeActionLoading ? "Connecting..." : "Connect Stripe"}
              </button>
            </div>
          ) : stripeInfo.status === "active" ? (
            /* Active */
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 rounded-full text-xs font-medium text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Connected
                </span>
              </div>
              <p className="text-text-tertiary text-sm mb-4">
                Your Stripe account is active. You can accept payments in your generated apps.
              </p>
              <button
                onClick={handleOpenDashboard}
                disabled={stripeActionLoading}
                className="px-4 py-2 bg-bg-tertiary hover:bg-bg-tertiary/80 disabled:opacity-50 text-text-primary text-sm font-medium rounded-lg border border-border-primary transition"
              >
                {stripeActionLoading ? "Opening..." : "View Stripe Dashboard"}
              </button>
            </div>
          ) : (
            /* Pending or Restricted */
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 rounded-full text-xs font-medium text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Setup Incomplete
                </span>
              </div>
              <p className="text-text-tertiary text-sm mb-4">
                Your Stripe account setup is not complete. Finish onboarding to start accepting payments.
              </p>
              <button
                onClick={handleCompleteSetup}
                disabled={stripeActionLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
              >
                {stripeActionLoading ? "Loading..." : "Complete Setup"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
