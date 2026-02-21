"use client";

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
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
        <div className="p-6 space-y-6">
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
                  onClick={() => {
                    navigator.clipboard.writeText(publishedUrl);
                  }}
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
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customDomain}
                onChange={(e) => onCustomDomainChange(e.target.value)}
                placeholder="yourdomain.com"
                className="flex-1 px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm"
              />
              <button
                onClick={() => onConnectDomain(customDomain)}
                disabled={!customDomain.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect
              </button>
            </div>
            <p className="text-xs text-text-muted">
              Point your domain&apos;s CNAME record to{" "}
              <span className="font-mono text-text-tertiary">
                cname.pocketdev.app
              </span>
            </p>
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
              <div className="flex items-start gap-3">
                <div className="p-2 bg-violet-500/20 rounded-lg">
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
                  <p className="text-xs text-text-tertiary mb-3">
                    Search for available domains and purchase them
                    directly. Prices start from $9.99/year.
                  </p>
                  <button
                    onClick={() =>
                      window.open(
                        "https://domains.google.com/registrar/search",
                        "_blank",
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    Search Domains
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-bg-tertiary/50 border-t border-border-primary flex gap-3">
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
