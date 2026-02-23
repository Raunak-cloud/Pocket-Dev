"use client";

import { useState } from "react";

interface EditIntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  backendEnabled: boolean;
  onBackendChange: (enabled: boolean) => void;
  onPaymentClick: () => void;
}

export function EditIntegrationsModal({
  isOpen,
  onClose,
  backendEnabled,
  onBackendChange,
  onPaymentClick,
}: EditIntegrationsModalProps) {
  const [paymentInfoVisible, setPaymentInfoVisible] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border-primary flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-violet-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">
                Integrations
              </h3>
              <p className="text-xs text-text-tertiary">
                Configure backend and payment integrations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => onBackendChange(!backendEnabled)}
              className={`w-full text-left p-5 rounded-xl border transition-all ${
                backendEnabled
                  ? "bg-violet-600/15 border-violet-500/40 ring-1 ring-violet-500/20"
                  : "bg-bg-secondary/50 border-border-primary hover:border-border-secondary"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${backendEnabled ? "bg-violet-500/20" : "bg-bg-tertiary"}`}
                >
                  <svg
                    className={`w-5 h-5 ${backendEnabled ? "text-violet-300" : "text-text-tertiary"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m-7.5 1.5V6.75a4.5 4.5 0 119 0v4.75m-9.75 10.5h10.5A2.25 2.25 0 0020.25 19.5v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75A2.25 2.25 0 006.75 22z"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">
                    Enable Backend
                  </p>
                  <p className="text-xs text-text-tertiary mt-1">
                    Includes production-ready sign up/sign in/session handling
                    plus database schema, CRUD APIs, and secure data access
                    patterns.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="px-2 py-1 rounded-md text-[11px] bg-blue-500/15 text-blue-300 border border-blue-500/25">
                      Authentication
                    </span>
                    <span className="px-2 py-1 rounded-md text-[11px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                      Database
                    </span>
                    <span className="px-2 py-1 rounded-md text-[11px] bg-violet-500/15 text-violet-300 border border-violet-500/25">
                      Protected Data
                    </span>
                  </div>
                </div>
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center ${backendEnabled ? "bg-violet-500 border-violet-500" : "border-border-secondary"}`}
                >
                  {backendEnabled && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                onPaymentClick();
                setPaymentInfoVisible(true);
                setTimeout(() => setPaymentInfoVisible(false), 3000);
              }}
              className="w-full text-left p-5 rounded-xl border transition-all bg-bg-secondary/50 border-border-primary hover:border-amber-500/30 hover:bg-amber-500/5"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-bg-tertiary">
                  <svg
                    className="w-5 h-5 text-text-tertiary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 7.5h16.5M5.25 5.25h13.5A1.5 1.5 0 0120.25 6.75v10.5a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V6.75a1.5 1.5 0 011.5-1.5zm10.5 8.25h1.5"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary">
                      Payment System
                    </p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/25">
                      Coming soon
                    </span>
                  </div>
                  <p className="text-xs text-text-tertiary mt-1">
                    Accept payments from your users with a hosted checkout and
                    transaction flow.
                  </p>
                </div>
              </div>
            </button>
            {paymentInfoVisible && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Payment system is coming soon. You will be able to accept user
                payments shortly.
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white rounded-lg text-sm font-medium transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
