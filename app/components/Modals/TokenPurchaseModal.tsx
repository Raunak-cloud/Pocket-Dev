"use client";

type TokenType = "app" | "integration";

interface TokenPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenType: TokenType;
  onTokenTypeChange: (type: TokenType) => void;
  amount: number;
  onAmountChange: (amount: number) => void;
  appTokens: number;
  integrationTokens: number;
  insufficientMessage: string | null;
  isProcessing: boolean;
  onPurchase: () => Promise<void>;
}

export function TokenPurchaseModal({
  isOpen,
  onClose,
  tokenType,
  onTokenTypeChange,
  amount,
  onAmountChange,
  appTokens,
  integrationTokens,
  insufficientMessage,
  isProcessing,
  onPurchase,
}: TokenPurchaseModalProps) {
  if (!isOpen) return null;

  const getTokenOptions = () =>
    tokenType === "app"
      ? [
          { aud: 2, tokens: 2, label: "2 tokens" },
          { aud: 5, tokens: 5, label: "5 tokens" },
          { aud: 10, tokens: 10, label: "10 tokens" },
          { aud: 20, tokens: 20, label: "20 tokens" },
        ]
      : [
          { aud: 1, tokens: 10, label: "10 tokens" },
          { aud: 5, tokens: 50, label: "50 tokens" },
          { aud: 10, tokens: 100, label: "100 tokens" },
          { aud: 20, tokens: 200, label: "200 tokens" },
        ];

  const tokensToReceive =
    tokenType === "app" ? amount : amount * 10;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-bg-secondary border border-border-secondary rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col my-auto">
        {/* Modal Header */}
        <div className="relative px-6 pt-8 pb-4 text-center flex-shrink-0">
          <button
            onClick={() => {
              onClose();
              onAmountChange(0);
            }}
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
            className={`inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl ${
              tokenType === "app"
                ? "bg-gradient-to-br from-blue-500 to-violet-500"
                : "bg-gradient-to-br from-violet-500 to-purple-500"
            }`}
          >
            <svg
              className="w-8 h-8 text-white"
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
          <h3 className="text-xl font-bold text-text-primary mb-2">
            Buy {tokenType === "app" ? "App" : "Integration"} Tokens
          </h3>
          {insufficientMessage ? (
            <div className="mt-1 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-left">
              <div className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5"
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
                <p className="text-sm text-red-300">{insufficientMessage}</p>
              </div>
            </div>
          ) : (
            <p className="text-text-tertiary text-sm">
              {tokenType === "app"
                ? "App tokens are used to create new projects (2 tokens per project). New accounts start with 4 free tokens."
                : "Integration tokens are used for AI edits and backend/API calls (3 tokens per edit)."}
            </p>
          )}
          <p className="text-text-muted text-xs mt-2">
            Current balance:{" "}
            {tokenType === "app"
              ? appTokens
              : integrationTokens}{" "}
            tokens
          </p>
        </div>

        {/* Token Type Tabs */}
        <div className="px-6 pb-3 flex-shrink-0">
          <div className="flex bg-bg-tertiary rounded-lg p-1">
            <button
              onClick={() => {
                onTokenTypeChange("app");
                onAmountChange(0);
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                tokenType === "app"
                  ? "bg-blue-600 text-white"
                  : "text-text-tertiary hover:text-text-primary"
              }`}
            >
              App Tokens
            </button>
            <button
              onClick={() => {
                onTokenTypeChange("integration");
                onAmountChange(0);
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                tokenType === "integration"
                  ? "bg-violet-600 text-white"
                  : "text-text-tertiary hover:text-text-primary"
              }`}
            >
              Integration Tokens
            </button>
          </div>
        </div>

        {/* Amount Selection */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          <p className="text-xs text-text-tertiary mb-3">
            {tokenType === "app"
              ? "1 AUD = 1 app token"
              : "1 AUD = 10 integration tokens"}
          </p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {getTokenOptions().map((option) => (
              <button
                key={option.aud}
                onClick={() => onAmountChange(option.aud)}
                className={`p-3 rounded-xl border-2 transition-all text-left ${
                  amount === option.aud
                    ? tokenType === "app"
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-violet-500 bg-violet-500/10"
                    : "border-border-secondary bg-bg-tertiary/50 hover:border-text-faint"
                }`}
              >
                <div className="text-lg font-bold text-text-primary">
                  ${option.aud} AUD
                </div>
                <div
                  className={`text-xs ${
                    tokenType === "app"
                      ? "text-blue-400"
                      : "text-violet-400"
                  }`}
                >
                  {option.label}
                </div>
              </button>
            ))}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm font-medium">
              $
            </span>
            <input
              type="number"
              min={1}
              placeholder="Custom amount"
              value={amount || ""}
              onChange={(e) =>
                onAmountChange(Math.max(0, parseInt(e.target.value) || 0))
              }
              className={`w-full pl-7 pr-16 py-2.5 bg-bg-tertiary/50 border rounded-xl text-text-primary text-sm font-medium focus:outline-none transition placeholder-text-muted ${
                tokenType === "app"
                  ? "border-blue-500/30 focus:border-blue-500"
                  : "border-violet-500/30 focus:border-violet-500"
              }`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">
              AUD
            </span>
          </div>
          {amount > 0 && (
            <div
              className={`mt-3 p-3 rounded-xl border ${
                tokenType === "app"
                  ? "bg-blue-500/5 border-blue-500/20"
                  : "bg-violet-500/5 border-violet-500/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">
                  You&apos;ll receive
                </span>
                <span
                  className={`text-lg font-bold ${tokenType === "app" ? "text-blue-400" : "text-violet-400"}`}
                >
                  {tokensToReceive} tokens
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 space-y-3 flex-shrink-0">
          {amount > 0 && (
            <button
              onClick={onPurchase}
              disabled={isProcessing}
              className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white ${
                tokenType === "app"
                  ? "bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400"
                  : "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400"
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
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
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                  Pay ${amount} AUD - {tokensToReceive} tokens
                </>
              )}
            </button>
          )}
          <button
            onClick={() => {
              onClose();
              onAmountChange(0);
            }}
            className="w-full px-5 py-2.5 text-text-tertiary hover:text-text-primary text-sm font-medium transition"
          >
            Cancel
          </button>
          {amount > 0 && (
            <p className="text-xs text-text-muted text-center">
              Secure payment powered by Stripe
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
