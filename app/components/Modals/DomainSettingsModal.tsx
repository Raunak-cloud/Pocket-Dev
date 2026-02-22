"use client";

import { useMemo, useState } from "react";

interface DomainSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  publishedUrl: string | null;
  customDomain: string;
  onCustomDomainChange: (domain: string) => void;
  onConnectDomain: (domain: string) => void;
  hasUnpublishedChanges: boolean;
  isPublishing: boolean;
  isUnpublishing: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
}

export function DomainSettingsModal({
  isOpen,
  onClose,
  publishedUrl,
  customDomain,
  onCustomDomainChange,
  onConnectDomain,
  hasUnpublishedChanges,
  isPublishing,
  isUnpublishing,
  onPublish,
  onUnpublish,
}: DomainSettingsModalProps) {
  const [domainSearchQuery, setDomainSearchQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<"host" | "value" | "url" | null>(
    null,
  );

  const sanitizedDomain = useMemo(
    () =>
      customDomain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "")
        .replace(/\.+$/, ""),
    [customDomain],
  );

  const cloudflareProjectHost = useMemo(() => {
    if (!publishedUrl) return "";
    try {
      return new URL(publishedUrl).host;
    } catch {
      return publishedUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    }
  }, [publishedUrl]);

  const cnameHost = "www";
  const cnameValue = cloudflareProjectHost;
  const fqdn = sanitizedDomain ? `${cnameHost}.${sanitizedDomain}` : "";
  const canConnectDomain = Boolean(publishedUrl && customDomain.trim());
  const registrarQuery = (
    domainSearchQuery || sanitizedDomain || customDomain || ""
  ).trim();

  const copyValue = async (key: "host" | "value" | "url", value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1400);
    } catch {
      // ignore clipboard errors
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-[min(96vw,1100px)] max-h-[92dvh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border-primary flex-shrink-0">
          <h3 className="text-lg font-semibold text-text-primary">
            Domain Settings
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition"
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

        {/* Modal Content */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto">
          {/* Published URL */}
          {publishedUrl && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary">
                Published URL
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-sm text-text-secondary font-mono truncate">
                  {publishedUrl}
                </div>
                <button
                  onClick={() => copyValue("url", publishedUrl)}
                  className="px-3 py-2 text-text-tertiary hover:text-text-primary bg-bg-tertiary hover:bg-border-secondary border border-border-secondary rounded-lg transition"
                  title="Copy URL"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
                {copiedKey === "url" && (
                  <span className="text-[11px] text-emerald-400">Copied</span>
                )}
                <a
                  href={publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-text-tertiary hover:text-text-primary bg-bg-tertiary hover:bg-border-secondary border border-border-secondary rounded-lg transition"
                  title="Open in new tab"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
            </div>
          )}

          {/* Connect Custom Domain */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-text-secondary">
              Connect Custom Domain
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={customDomain}
                onChange={(e) => onCustomDomainChange(e.target.value)}
                placeholder="yourdomain.com"
                className="flex-1 px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm"
              />
              <button
                onClick={() => onConnectDomain(customDomain)}
                disabled={!canConnectDomain}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                Save & Verify
              </button>
            </div>
            {!publishedUrl && (
              <p className="text-xs text-amber-300">
                Publish your site first to enable custom domain verification.
              </p>
            )}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
              <p className="text-xs text-blue-200 font-medium">
                Cloudflare status
              </p>
              <p className="text-sm text-blue-300 mt-0.5">initializing</p>
              <p className="text-xs text-text-muted mt-2">
                Add the DNS records below at your registrar, then wait for
                Cloudflare verification.
              </p>
            </div>
            {sanitizedDomain && cnameValue && (
              <div className="rounded-xl border border-border-primary bg-bg-tertiary/40 overflow-hidden">
                <div className="px-3 py-2 border-b border-border-primary text-xs text-text-tertiary font-medium">
                  Required DNS Record
                </div>
                <div className="p-3 space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr_auto] gap-2 items-center">
                    <span className="text-text-muted">Type</span>
                    <span className="font-mono text-text-primary">CNAME</span>
                    <span />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr_auto] gap-2 items-center">
                    <span className="text-text-muted">Host/Name</span>
                    <div className="font-mono text-text-primary break-all">
                      {cnameHost}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyValue("host", cnameHost)}
                      className="px-2.5 py-1.5 rounded-md border border-border-secondary bg-bg-secondary hover:bg-bg-tertiary text-text-secondary transition"
                    >
                      {copiedKey === "host" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr_auto] gap-2 items-center">
                    <span className="text-text-muted">Value/Target</span>
                    <div className="font-mono text-text-primary break-all">
                      {cnameValue}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyValue("value", cnameValue)}
                      className="px-2.5 py-1.5 rounded-md border border-border-secondary bg-bg-secondary hover:bg-bg-tertiary text-text-secondary transition"
                    >
                      {copiedKey === "value" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="pt-1 text-[11px] text-text-muted space-y-1">
                    <p>
                      For most DNS providers, set{" "}
                      <span className="font-mono text-text-secondary">
                        Host/Name
                      </span>{" "}
                      to <span className="font-mono text-text-secondary">www</span>{" "}
                      (not the full domain).
                    </p>
                    <p>
                      This creates:{" "}
                      <span className="font-mono text-text-secondary">
                        {fqdn}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-secondary"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-bg-secondary text-text-muted">
                or
              </span>
            </div>
          </div>

          {/* Buy Domain */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-text-secondary">
              Buy a New Domain
            </label>
            <div className="p-4 bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/20 rounded-xl">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-violet-500/20 rounded-lg shrink-0">
                  <svg
                    className="w-5 h-5 text-violet-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-text-primary mb-1">
                    Get a custom domain
                  </h4>
                  <p className="text-xs text-text-tertiary">
                    Enter a domain idea and open any registrar below.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  value={domainSearchQuery}
                  onChange={(e) => setDomainSearchQuery(e.target.value)}
                  placeholder="yourbrand.com"
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-violet-500 text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      window.open(
                        `https://dash.cloudflare.com/?to=/:account/domains/register/${encodeURIComponent(registrarQuery)}`,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition"
                  >
                    Cloudflare Registrar
                  </button>
                  <button
                    onClick={() =>
                      window.open(
                        `https://porkbun.com/checkout/search?q=${encodeURIComponent(registrarQuery)}`,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-tertiary hover:bg-border-secondary text-text-secondary border border-border-secondary text-xs font-medium rounded-lg transition"
                  >
                    Porkbun
                  </button>
                  <button
                    onClick={() =>
                      window.open(
                        `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(registrarQuery)}`,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-tertiary hover:bg-border-secondary text-text-secondary border border-border-secondary text-xs font-medium rounded-lg transition"
                  >
                    Namecheap
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-4 bg-bg-tertiary/50 border-t border-border-primary flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-text-secondary hover:text-text-primary bg-bg-tertiary hover:bg-border-secondary border border-border-secondary rounded-lg transition text-sm font-medium"
          >
            Close
          </button>
          {publishedUrl && (
            <>
              {hasUnpublishedChanges ? (
                <button
                  onClick={onPublish}
                  disabled={isPublishing || isUnpublishing}
                  className="px-4 py-2 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPublishing ? "Publishing..." : "Publish Changes"}
                </button>
              ) : (
                <button
                  onClick={onUnpublish}
                  disabled={isUnpublishing}
                  className="px-4 py-2 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUnpublishing ? "Unpublishing..." : "Unpublish"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
