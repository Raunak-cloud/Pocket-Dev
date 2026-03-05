"use client";

import { useState } from "react";

export interface CustomApiConfig {
  id: string;
  name: string;
  slug: string;
  baseUrl: string;
  authType: string;
  authHeaderName?: string | null;
  authParamName?: string | null;
  description?: string | null;
}

interface CustomApisSectionProps {
  projectId: string;
  apis: CustomApiConfig[];
  onChange: (apis: CustomApiConfig[]) => void;
}

type AuthType = "api_key_header" | "bearer_token" | "query_param" | "none";

const AUTH_TYPE_LABELS: Record<AuthType, string> = {
  api_key_header: "API Key Header",
  bearer_token: "Bearer Token",
  query_param: "Query Parameter",
  none: "None",
};

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function CustomAPIsSection({ projectId, apis, onChange }: CustomApisSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [description, setDescription] = useState("");
  const [authType, setAuthType] = useState<AuthType>("api_key_header");
  const [authHeaderName, setAuthHeaderName] = useState("X-API-Key");
  const [authParamName, setAuthParamName] = useState("");
  const [apiKey, setApiKey] = useState("");

  const slug = toSlug(name);

  const resetForm = () => {
    setName("");
    setBaseUrl("");
    setDescription("");
    setAuthType("api_key_header");
    setAuthHeaderName("X-API-Key");
    setAuthParamName("");
    setApiKey("");
    setFormError(null);
  };

  const handleCancel = () => {
    resetForm();
    setShowForm(false);
  };

  const handleAdd = async () => {
    setFormError(null);

    if (!name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (!baseUrl.trim()) {
      setFormError("Base URL is required.");
      return;
    }
    try {
      new URL(baseUrl.trim());
    } catch {
      setFormError("Base URL must be a valid URL (e.g. https://api.example.com).");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/user-apis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: name.trim(),
          baseUrl: baseUrl.trim(),
          description: description.trim() || undefined,
          authType,
          authHeaderName: authType === "api_key_header" ? (authHeaderName.trim() || "X-API-Key") : undefined,
          authParamName: authType === "query_param" ? authParamName.trim() || undefined : undefined,
          apiKey: authType !== "none" && apiKey.trim() ? apiKey.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed to add API.");
        return;
      }

      onChange([...apis, data.api as CustomApiConfig]);
      resetForm();
      setShowForm(false);
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/user-apis?id=${encodeURIComponent(id)}&projectId=${encodeURIComponent(projectId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onChange(apis.filter((a) => a.id !== id));
      }
    } catch {
      // Silently ignore
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary/50 overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-bg-tertiary flex-shrink-0">
            <svg className="w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">Custom APIs</p>
            <p className="text-xs text-text-tertiary mt-1">
              Connect any REST API. Keys stay server-side — no CORS issues.
            </p>
          </div>
        </div>

        {/* Existing API chips */}
        {apis.length > 0 && (
          <div className="mt-4 space-y-2">
            {apis.map((api) => (
              <div
                key={api.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-tertiary border border-border-primary group"
              >
                <span className="text-xs font-medium text-text-primary truncate flex-1">{api.name}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20 flex-shrink-0">
                  {api.slug}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(api.id)}
                  disabled={deletingId === api.id}
                  className="p-0.5 text-text-tertiary hover:text-red-400 transition rounded flex-shrink-0 opacity-0 group-hover:opacity-100"
                  aria-label={`Remove ${api.name}`}
                >
                  {deletingId === api.id ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add button */}
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-300 hover:text-blue-200 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add API
          </button>
        )}
      </div>

      {/* Inline add form */}
      {showForm && (
        <div className="border-t border-border-primary px-5 py-4 space-y-3 bg-bg-tertiary/40">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="OpenWeather API"
              className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border-primary rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition"
            />
            {slug && (
              <p className="mt-1 text-[11px] text-text-tertiary">
                Slug: <span className="font-mono text-blue-300">{slug}</span>
              </p>
            )}
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Base URL <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openweathermap.org/data/2.5"
              className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border-primary rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Real-time weather data"
              className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border-primary rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition"
            />
          </div>

          {/* Auth Type */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Auth Type</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(AUTH_TYPE_LABELS) as AuthType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setAuthType(t);
                    if (t === "api_key_header" && !authHeaderName) setAuthHeaderName("X-API-Key");
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition text-left ${
                    authType === t
                      ? "bg-blue-500/15 border-blue-500/40 text-blue-300"
                      : "bg-bg-secondary border-border-primary text-text-tertiary hover:border-border-secondary"
                  }`}
                >
                  {AUTH_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional: Header Name */}
          {authType === "api_key_header" && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Header Name</label>
              <input
                type="text"
                value={authHeaderName}
                onChange={(e) => setAuthHeaderName(e.target.value)}
                placeholder="X-API-Key"
                className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border-primary rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition"
              />
            </div>
          )}

          {/* Conditional: Param Name */}
          {authType === "query_param" && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Parameter Name</label>
              <input
                type="text"
                value={authParamName}
                onChange={(e) => setAuthParamName(e.target.value)}
                placeholder="appid"
                className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border-primary rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition"
              />
            </div>
          )}

          {/* API Key */}
          {authType !== "none" && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                API Key{" "}
                <span className="text-text-tertiary font-normal">(stored encrypted)</span>
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="••••••••••••••••"
                autoComplete="new-password"
                className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border-primary rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition"
              />
            </div>
          )}

          {/* Error */}
          {formError && (
            <p className="text-xs text-red-400">{formError}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-text-tertiary hover:text-text-primary bg-bg-secondary border border-border-primary hover:border-border-secondary transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? "Adding…" : "Add API →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
