"use client";

import Logo from "./Logo";

interface Props {
  prompt: string;
  messages: string[];
}

export default function StreamingTemplateLayout({ prompt, messages }: Props) {
  const currentIndex = messages.length - 1;
  const totalSteps = Math.max(messages.length, 8);
  const progress = messages.length > 0 ? Math.min((messages.length / totalSteps) * 100, 95) : 0;
  const currentMessage = messages[currentIndex] || "Initializing...";

  return (
    <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="relative">
            <div className="absolute inset-0 blur-2xl bg-gradient-to-r from-blue-500 to-violet-500 opacity-20 animate-pulse" />
            <Logo size={40} animate className="relative" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Building your site</h2>
            <p className="text-slate-400 text-xs flex items-center gap-1.5">
              <svg className="w-3 h-3 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </p>
          </div>
        </div>

        {/* Prompt summary */}
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-4 py-3 mb-4">
          <p className="text-slate-300 text-sm line-clamp-2">{prompt}</p>
        </div>

        {/* Progress card */}
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
          {/* Progress header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-xs font-medium">Progress</span>
            <span className="text-blue-400 text-sm font-bold">{Math.round(progress)}%</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-violet-500 to-blue-500 rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                backgroundSize: "200% 100%",
                animation: "progressShimmer 2s linear infinite",
              }}
            />
          </div>

          {/* Current action - highlighted */}
          <div className="bg-slate-800/50 rounded-lg px-3 py-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-sm text-white font-medium">{currentMessage}</span>
            </div>
          </div>

          {/* Completed steps */}
          {messages.length > 1 && (
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
              {messages.slice(0, -1).map((msg, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-slate-500">{msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* Loading state when no messages */}
          {messages.length === 0 && (
            <div className="flex items-center justify-center py-4">
              <div className="flex items-center gap-2">
                <div className="loading-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="text-slate-400 text-sm">Starting generation...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
