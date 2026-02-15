"use client";

interface TokenConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  confirmationType: "generation" | "edit";
  appCost: number;
  integrationCost: number;
  appBalance: number;
  integrationBalance: number;
  skipEditTokenConfirm: boolean;
  onSkipEditTokenConfirmChange: (skip: boolean) => void;
  onConfirm: () => void;
  currentAppAuth?: string[];
  editAppAuth?: string[];
}

export function TokenConfirmModal({
  isOpen,
  onClose,
  confirmationType,
  appCost,
  integrationCost,
  appBalance,
  integrationBalance,
  skipEditTokenConfirm,
  onSkipEditTokenConfirmChange,
  onConfirm,
  currentAppAuth = [],
  editAppAuth = [],
}: TokenConfirmModalProps) {
  if (!isOpen) return null;

  const isGeneration = confirmationType === "generation";
  const authList = isGeneration ? currentAppAuth : editAppAuth;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="relative px-6 pt-8 pb-4 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition"
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
          <div
            className={`inline-flex items-center justify-center w-14 h-14 mb-4 rounded-2xl ${
              isGeneration
                ? "bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/30"
                : "bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30"
            }`}
          >
            <svg
              className={`w-7 h-7 ${isGeneration ? "text-blue-400" : "text-violet-400"}`}
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
          <h3 className="text-lg font-bold text-text-primary mb-1">
            {isGeneration ? "Create New Project" : "Edit Project"}
          </h3>
          <p className="text-text-tertiary text-sm">
            {isGeneration
              ? "This action will deduct tokens from your balance."
              : "This edit will deduct tokens from your balance."}
          </p>
        </div>
        <div className="px-6 pb-4 space-y-3">
          {appCost > 0 && (
            <div className="p-4 rounded-xl border bg-blue-500/5 border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-blue-400 uppercase tracking-wide">
                  App Tokens
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-secondary">
                  Project creation
                </span>
                <span className="text-sm font-bold text-blue-400">
                  -{appCost}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-text-tertiary pt-2 border-t border-border-secondary/50">
                <span>Balance: {appBalance}</span>
                <span>After: {appBalance - appCost}</span>
              </div>
            </div>
          )}
          {integrationCost > 0 && (
            <div className="p-4 rounded-xl border bg-violet-500/5 border-violet-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-violet-400 uppercase tracking-wide">
                  Integration Tokens
                </span>
              </div>
              {isGeneration ? (
                <>
                  {authList.includes("username-password") && (
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-text-secondary">
                        Username & Password auth
                      </span>
                      <span className="text-sm font-bold text-violet-400">
                        -30
                      </span>
                    </div>
                  )}
                  {authList.includes("google") && (
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-text-secondary">
                        Google OAuth auth
                      </span>
                      <span className="text-sm font-bold text-violet-400">
                        -30
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {authList.includes("username-password") && (
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-text-secondary">
                        Username & Password auth
                      </span>
                      <span className="text-sm font-bold text-violet-400">
                        -30
                      </span>
                    </div>
                  )}
                  {authList.includes("google") && (
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-text-secondary">
                        Google OAuth auth
                      </span>
                      <span className="text-sm font-bold text-violet-400">
                        -30
                      </span>
                    </div>
                  )}
                  {authList.length === 0 && (
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-text-secondary">
                        Edit changes
                      </span>
                      <span className="text-sm font-bold text-violet-400">
                        -3
                      </span>
                    </div>
                  )}
                </>
              )}
              <div className="flex items-center justify-between text-xs text-text-tertiary pt-2 border-t border-border-secondary/50">
                <span>Balance: {integrationBalance}</span>
                <span>
                  After: {integrationBalance - integrationCost}
                </span>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <svg
              className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <p className="text-xs text-amber-700">
              Tokens are non-refundable once deducted, even if you
              cancel during the process.
            </p>
          </div>
          {!isGeneration && (
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={skipEditTokenConfirm}
                onChange={(e) => {
                  onSkipEditTokenConfirmChange(e.target.checked);
                  localStorage.setItem(
                    "skipEditTokenConfirm",
                    String(e.target.checked),
                  );
                }}
                className="w-4 h-4 rounded border-text-faint bg-bg-tertiary text-violet-500 focus:ring-violet-500 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-xs text-text-tertiary group-hover:text-text-secondary transition">
                Don&apos;t show this again for edits
              </span>
            </label>
          )}
        </div>
        <div className="px-6 pb-6 space-y-2">
          <button
            onClick={onConfirm}
            className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold rounded-xl transition-all text-white ${
              isGeneration
                ? "bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400"
                : "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400"
            }`}
          >
            {isGeneration ? "Create Project" : "Start Edit"}
          </button>
          <button
            onClick={onClose}
            className="w-full px-5 py-2.5 text-text-tertiary hover:text-text-primary text-sm font-medium transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
