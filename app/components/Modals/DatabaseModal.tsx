"use client";

import { useState } from "react";

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
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
export function DatabaseModal({
  isOpen,
  onClose,
  selectedDatabase,
  onDatabaseChange,
}: DatabaseModalProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [openOptionInfo, setOpenOptionInfo] = useState<string | null>(null);
  const [draftSelection, setDraftSelection] = useState<string[]>(selectedDatabase);

  if (!isOpen) return null;

  const toggle = (id: string) => {
    setDraftSelection((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id],
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-3 flex items-center justify-between border-b border-border-primary">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
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
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">
                Database Setup for your app
              </h3>
              <p className="text-xs text-text-tertiary">
                Pick what you want. We handle the technical setup.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowInfo((prev) => !prev)}
            className="p-1.5 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition"
            aria-label="What is this?"
            title="What is this?"
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
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
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

        <div className="p-5 space-y-3">
          {showInfo && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
              <p className="text-xs text-emerald-200 leading-relaxed">
                Simple meaning: this helps your app save user data like forms,
                profiles, and items. You do not need to code this yourself.
              </p>
            </div>
          )}
          <p className="text-xs text-text-tertiary">
            Choose the data features for your app.
          </p>
          <div className="space-y-2.5">
            {DB_OPTIONS.map((option) => {
              const active = draftSelection.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggle(option.id)}
                  className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${
                    active
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-border-secondary bg-bg-tertiary/40 hover:border-text-faint"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center ${
                        active
                          ? "border-emerald-400 bg-emerald-500/20"
                          : "border-border-secondary"
                      }`}
                    >
                      {active && (
                        <svg
                          className="w-3 h-3 text-emerald-300"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-text-primary">
                          {option.label}
                        </p>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenOptionInfo((prev) =>
                              prev === option.id ? null : option.id,
                            );
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              setOpenOptionInfo((prev) =>
                                prev === option.id ? null : option.id,
                              );
                            }
                          }}
                          className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-text-faint/50 text-text-muted hover:text-text-primary hover:border-text-faint transition"
                          aria-label={`Explain ${option.label}`}
                          title={`Explain ${option.label}`}
                        >
                          i
                        </span>
                      </div>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {option.description}
                      </p>
                      {openOptionInfo === option.id && (
                        <p className="text-[11px] text-emerald-200 mt-1.5">
                          {option.helpText}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-text-muted">
            Click Use These to apply these choices.
          </p>
        </div>

        <div className="px-5 pb-5 flex items-center gap-2">
          <button
            onClick={() => setDraftSelection([])}
            className="px-4 py-2.5 text-sm font-medium text-text-tertiary bg-bg-tertiary hover:bg-border-secondary rounded-xl transition"
          >
            Reset
          </button>
          <button
            onClick={() => {
              onDatabaseChange(draftSelection);
              onClose();
            }}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition"
          >
            Use These
          </button>
        </div>
      </div>
    </div>
  );
}
