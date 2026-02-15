"use client";

type ExportStatus = "idle" | "exporting" | "success" | "error";

interface GitHubExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  githubToken: string;
  onTokenChange: (token: string) => void;
  githubRepoName: string;
  onRepoNameChange: (name: string) => void;
  githubPrivate: boolean;
  onPrivateChange: (isPrivate: boolean) => void;
  githubExportStatus: ExportStatus;
  githubExportMessage: string;
  githubRepoUrl: string;
  onPushToGitHub: () => Promise<void>;
}

export function GitHubExportModal({
  isOpen,
  onClose,
  githubToken,
  onTokenChange,
  githubRepoName,
  onRepoNameChange,
  githubPrivate,
  onPrivateChange,
  githubExportStatus,
  githubExportMessage,
  githubRepoUrl,
  onPushToGitHub,
}: GitHubExportModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6 text-text-primary"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <h3 className="text-lg font-semibold text-text-primary">
              Export to GitHub
            </h3>
          </div>
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

        {/* Success State */}
        {githubExportStatus === "success" ? (
          <div className="px-6 py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-emerald-500/20 rounded-2xl">
              <svg
                className="w-8 h-8 text-emerald-400"
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
            </div>
            <h4 className="text-lg font-bold text-text-primary mb-2">
              Pushed to GitHub!
            </h4>
            <p className="text-text-tertiary text-sm mb-4">
              {githubExportMessage}
            </p>
            <a
              href={githubRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black font-medium rounded-xl hover:bg-gray-200 transition text-sm"
            >
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Open Repository
            </a>
            <button
              onClick={onClose}
              className="block w-full mt-3 text-sm text-text-tertiary hover:text-text-primary transition"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              {/* Token */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Personal Access Token
                </label>
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => onTokenChange(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  disabled={githubExportStatus === "exporting"}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-secondary rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
                />
                <p className="mt-1 text-xs text-text-muted">
                  Needs{" "}
                  <span className="text-text-tertiary font-mono">
                    repo
                  </span>{" "}
                  scope.{" "}
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=Pocket+Dev+Export"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Create token
                  </a>
                </p>
              </div>

              {/* Repo Name */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Repository Name
                </label>
                <input
                  type="text"
                  value={githubRepoName}
                  onChange={(e) =>
                    onRepoNameChange(
                      e.target.value.replace(/[^a-zA-Z0-9._-]/g, "-"),
                    )
                  }
                  placeholder="my-nextjs-app"
                  disabled={githubExportStatus === "exporting"}
                  className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-secondary rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
                />
              </div>

              {/* Visibility */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onPrivateChange(false)}
                  disabled={githubExportStatus === "exporting"}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    !githubPrivate
                      ? "bg-blue-600 text-white border border-blue-500"
                      : "bg-bg-tertiary/50 text-text-tertiary border border-border-primary hover:border-border-secondary"
                  }`}
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
                      d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => onPrivateChange(true)}
                  disabled={githubExportStatus === "exporting"}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    githubPrivate
                      ? "bg-blue-600 text-white border border-blue-500"
                      : "bg-bg-tertiary/50 text-text-tertiary border border-border-primary hover:border-border-secondary"
                  }`}
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
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  Private
                </button>
              </div>

              {/* Error */}
              {githubExportStatus === "error" && (
                <div className="px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-sm text-red-400">
                    {githubExportMessage}
                  </p>
                </div>
              )}

              {/* Progress */}
              {githubExportStatus === "exporting" && (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin flex-shrink-0" />
                  <p className="text-sm text-blue-400">
                    {githubExportMessage}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={onClose}
                disabled={githubExportStatus === "exporting"}
                className="flex-1 px-4 py-2.5 text-text-secondary bg-bg-tertiary hover:bg-border-secondary rounded-xl text-sm font-medium transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onPushToGitHub}
                disabled={
                  !githubToken ||
                  !githubRepoName ||
                  githubExportStatus === "exporting"
                }
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {githubExportStatus === "exporting" ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Pushing...
                  </>
                ) : (
                  <>
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
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                    Push to GitHub
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
