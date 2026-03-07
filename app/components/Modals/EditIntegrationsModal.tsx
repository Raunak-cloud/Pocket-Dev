"use client";

import { CustomAPIsSection, type CustomApiConfig } from "@/app/components/Integrations/CustomAPIsSection";

interface EditIntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  backendEnabled: boolean;
  onBackendChange: (enabled: boolean) => void;
  paymentsEnabled: boolean;
  onTogglePayments: () => void;
  projectId?: string;
  customApis?: CustomApiConfig[];
  onCustomApisChange?: (apis: CustomApiConfig[]) => void;
  systemDisabledFeatures?: { backend: boolean; payments: boolean; apis: boolean };
}

export function EditIntegrationsModal({
  isOpen,
  onClose,
  backendEnabled,
  onBackendChange,
  paymentsEnabled,
  onTogglePayments,
  projectId,
  customApis = [],
  onCustomApisChange,
  systemDisabledFeatures = { backend: false, payments: false, apis: false },
}: EditIntegrationsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-bg-secondary border border-border-secondary rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-xl max-h-[92dvh] sm:max-h-[85dvh] overflow-hidden flex flex-col">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border-primary flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-violet-600 dark:text-violet-300"
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
                Configure backend, payments, and custom APIs
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

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <div className="space-y-3">
            {!systemDisabledFeatures.backend && (
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
                    className={`w-5 h-5 ${backendEnabled ? "text-violet-600 dark:text-violet-300" : "text-text-tertiary"}`}
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
                    <span className="px-2 py-1 rounded-md text-[11px] bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/25">
                      Authentication
                    </span>
                    <span className="px-2 py-1 rounded-md text-[11px] bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25">
                      Database
                    </span>
                    <span className="px-2 py-1 rounded-md text-[11px] bg-violet-100 text-violet-700 border border-violet-300 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25">
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
            )}

            {!systemDisabledFeatures.payments && (
            <button
              type="button"
              onClick={onTogglePayments}
              className={`w-full text-left p-5 rounded-xl border transition-all ${
                paymentsEnabled
                  ? "bg-amber-600/15 border-amber-500/40 ring-1 ring-amber-500/20"
                  : "bg-bg-secondary/50 border-border-primary hover:border-amber-500/30 hover:bg-amber-500/5"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${paymentsEnabled ? "bg-amber-500/20" : "bg-bg-tertiary"}`}
                >
                  <svg
                    className={`w-5 h-5 ${paymentsEnabled ? "text-amber-600 dark:text-amber-300" : "text-text-tertiary"}`}
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
                  <p className="text-sm font-semibold text-text-primary">
                    Payment System
                  </p>
                  <p className="text-xs text-text-tertiary mt-1">
                    Accept payments with Stripe Checkout — checkout API route,
                    success/cancel pages, and buy buttons on pricing sections.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="px-2 py-1 rounded-md text-[11px] bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25">
                      Stripe Checkout
                    </span>
                    <span className="px-2 py-1 rounded-md text-[11px] bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25">
                      Payment Pages
                    </span>
                    <span className="px-2 py-1 rounded-md text-[11px] bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25">
                      Buy Buttons
                    </span>
                  </div>
                </div>
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center ${paymentsEnabled ? "bg-amber-500 border-amber-500" : "border-border-secondary"}`}
                >
                  {paymentsEnabled && (
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
            )}

            {/* Custom APIs */}
            {!systemDisabledFeatures.apis && projectId && (
              <CustomAPIsSection
                projectId={projectId}
                apis={customApis}
                onChange={onCustomApisChange ?? (() => {})}
              />
            )}
          </div>
        </div>

        <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-2 border-t border-border-primary/60">
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
