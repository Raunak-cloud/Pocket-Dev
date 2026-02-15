"use client";

type AuthType = "username-password" | "google";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAuth: string[];
  onAuthChange: (auth: AuthType) => void;
}

export function AuthModal({
  isOpen,
  onClose,
  selectedAuth,
  onAuthChange,
}: AuthModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-3 flex items-center justify-between border-b border-border-primary">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/30 flex items-center justify-center">
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
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">
                Authentication
              </h3>
              <p className="text-xs text-text-tertiary">
                Select auth for your next app
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

        {/* Options */}
        <div className="p-4 space-y-2.5">
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
                <p
                  className={`font-medium text-sm ${selectedAuth.includes("username-password") ? "text-blue-300" : "text-text-primary"}`}
                >
                  Username & Password
                </p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Email/password sign up, login & protected routes
                </p>
              </div>
              <span className="text-xs font-medium text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                2 tokens
              </span>
              {selectedAuth.includes("username-password") && (
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
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
                </div>
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
                <p
                  className={`font-medium text-sm ${selectedAuth.includes("google") ? "text-blue-300" : "text-text-primary"}`}
                >
                  Google OAuth
                </p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Sign in with Google, profile & protected routes
                </p>
              </div>
              <span className="text-xs font-medium text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                2 tokens
              </span>
              {selectedAuth.includes("google") && (
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
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
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Info footer */}
        {selectedAuth.length > 0 && (
          <div className="mx-4 mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <svg
                className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5"
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
              <p className="text-xs text-blue-300">
                <span className="font-medium">
                  {selectedAuth
                    .map((a) =>
                      a === "username-password"
                        ? "Username & Password"
                        : "Google OAuth",
                    )
                    .join(" + ")}
                </span>{" "}
                auth will be included in your next app. Costs{" "}
                <span className="font-medium text-violet-400">
                  {selectedAuth.length * 2} app tokens
                </span>
                .
              </p>
            </div>
          </div>
        )}

        {/* Done button */}
        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 text-white rounded-xl transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
