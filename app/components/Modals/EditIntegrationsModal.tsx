"use client";

import { useState } from "react";

interface EditIntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAuth: string[];
  onAuthChange: (auth: string) => void;
  selectedDatabase: string[];
  onDatabaseChange: (selected: string[]) => void;
}

const DB_OPTIONS: Array<{
  id: string;
  label: string;
  description: string;
  helpText: string;
}> = [
  {
    id: "supabase-postgres",
    label: "Save App Data",
    description:
      "We will create the data tables (data holders) your app needs.",
    helpText: "Your app can store things like users, orders, forms, and posts.",
  },
  {
    id: "crud-api-routes",
    label: "Add ability to Create, View, Edit, and Delete Data",
    description: "We will add create, view, edit, and delete actions.",
    helpText: "Your app can add new data, show it, update it, and remove it.",
  },
  {
    id: "row-level-security",
    label: "Private User Data",
    description: "Each user sees only their own data.",
    helpText:
      "Private account data stays private. Public content (like blog posts) can still be visible to everyone.",
  },
];

export function EditIntegrationsModal({
  isOpen,
  onClose,
  selectedAuth,
  onAuthChange,
  selectedDatabase,
  onDatabaseChange,
}: EditIntegrationsModalProps) {
  const [draftSelection, setDraftSelection] = useState<string[]>(
    selectedDatabase,
  );

  if (!isOpen) return null;

  const toggleDatabase = (id: string) => {
    setDraftSelection((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id],
    );
  };

  const handleDone = () => {
    onDatabaseChange(draftSelection);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-bg-secondary/95 backdrop-blur px-6 pt-6 pb-3 flex items-center justify-between border-b border-border-primary z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-violet-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
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
                Configure authentication and database for your app
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

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Authentication Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
              <h4 className="text-sm font-semibold text-text-primary">
                Authentication
              </h4>
            </div>
            <div className="space-y-2.5">
              {/* Username/Password */}
              <button
                onClick={() => onAuthChange("username-password")}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedAuth.includes("username-password")
                    ? "bg-blue-600/15 border-blue-500/40 ring-1 ring-blue-500/20"
                    : "bg-bg-secondary/50 border-border-primary hover:border-border-secondary"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${selectedAuth.includes("username-password") ? "bg-blue-500/20" : "bg-bg-tertiary"}`}
                  >
                    <svg
                      className={`w-5 h-5 ${selectedAuth.includes("username-password") ? "text-blue-400" : "text-text-tertiary"}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      Username & Password
                    </p>
                    <p className="text-xs text-text-tertiary">
                      Users create accounts with email and password
                    </p>
                  </div>
                  {selectedAuth.includes("username-password") && (
                    <svg
                      className="w-5 h-5 text-blue-400 flex-shrink-0"
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
              </button>

              {/* Google OAuth */}
              <button
                onClick={() => onAuthChange("google")}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedAuth.includes("google")
                    ? "bg-blue-600/15 border-blue-500/40 ring-1 ring-blue-500/20"
                    : "bg-bg-secondary/50 border-border-primary hover:border-border-secondary"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${selectedAuth.includes("google") ? "bg-blue-500/20" : "bg-bg-tertiary"}`}
                  >
                    <svg
                      className={`w-5 h-5 ${selectedAuth.includes("google") ? "text-blue-400" : "text-text-tertiary"}`}
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      Google OAuth
                    </p>
                    <p className="text-xs text-text-tertiary">
                      Users sign in with their Google account
                    </p>
                  </div>
                  {selectedAuth.includes("google") && (
                    <svg
                      className="w-5 h-5 text-blue-400 flex-shrink-0"
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
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-border-primary to-transparent" />

          {/* Database Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
                />
              </svg>
              <h4 className="text-sm font-semibold text-text-primary">
                Database Storage
              </h4>
            </div>
            <div className="space-y-2.5">
              {DB_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => toggleDatabase(option.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    draftSelection.includes(option.id)
                      ? "bg-emerald-600/15 border-emerald-500/40 ring-1 ring-emerald-500/20"
                      : "bg-bg-secondary/50 border-border-primary hover:border-border-secondary"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${draftSelection.includes(option.id) ? "bg-emerald-500/20" : "bg-bg-tertiary"}`}
                    >
                      <svg
                        className={`w-5 h-5 ${draftSelection.includes(option.id) ? "text-emerald-400" : "text-text-tertiary"}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">
                        {option.label}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        {option.description}
                      </p>
                    </div>
                    {draftSelection.includes(option.id) && (
                      <svg
                        className="w-5 h-5 text-emerald-400 flex-shrink-0"
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
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-bg-secondary/95 backdrop-blur px-6 py-4 border-t border-border-primary flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-text-secondary bg-bg-tertiary hover:bg-border-secondary rounded-lg text-sm font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDone}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white rounded-lg text-sm font-medium transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
