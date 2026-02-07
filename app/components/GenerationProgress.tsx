"use client";

import Logo from "./Logo";

interface GenerationProgressProps {
  prompt: string;
  progressMessages: string[];
  onCancel?: () => void;
  onViewDetails?: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

const GENERATION_STEPS = [
  {
    id: "analyze",
    label: "Analyzing requirements",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  },
  {
    id: "architecture",
    label: "Designing architecture",
    icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
  },
  {
    id: "components",
    label: "Creating components",
    icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
  },
  {
    id: "pages",
    label: "Building pages",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    id: "styling",
    label: "Styling with Tailwind",
    icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01",
  },
  {
    id: "routing",
    label: "Setting up routing",
    icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
  },
  {
    id: "checks",
    label: "Running final checks",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
];

const EDITING_STEPS = [
  {
    id: "understand",
    label: "Understanding changes",
    icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    id: "planning",
    label: "Planning modifications",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  },
  {
    id: "updating",
    label: "Updating components",
    icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  },
  {
    id: "refining",
    label: "Refining layout",
    icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
  },
  {
    id: "polishing",
    label: "Polishing styles",
    icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01",
  },
  {
    id: "integrating",
    label: "Integrating features",
    icon: "M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z",
  },
  {
    id: "testing",
    label: "Testing changes",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
];

export default function GenerationProgress({
  prompt,
  progressMessages,
  onCancel,
  isMinimized = false,
  onToggleMinimize,
}: GenerationProgressProps) {
  const isEditMode = prompt.toLowerCase().startsWith("editing:");
  const steps = isEditMode ? EDITING_STEPS : GENERATION_STEPS;
  const currentStep = progressMessages.length;
  const progress = Math.min((currentStep / steps.length) * 100, 95);
  const cleanPrompt = isEditMode
    ? prompt.substring("Editing:".length).trim()
    : prompt;

  const getAppType = () => {
    const lp = cleanPrompt.toLowerCase();
    if (lp.includes("e-commerce") || lp.includes("shop"))
      return "E-Commerce App";
    if (lp.includes("restaurant") || lp.includes("food"))
      return "Restaurant App";
    if (lp.includes("portfolio")) return "Portfolio App";
    if (lp.includes("blog")) return "Blog App";
    if (lp.includes("saas") || lp.includes("landing"))
      return "SaaS Landing Page";
    if (lp.includes("fitness") || lp.includes("workout")) return "Fitness App";
    if (lp.includes("dashboard")) return "Dashboard App";
    return "Next.js App";
  };

  // Minimized floating indicator
  if (isMinimized) {
    return (
      <button
        onClick={onToggleMinimize}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-blue-500/10 hover:border-blue-500/30 hover:shadow-blue-500/20 transition-all duration-300 group"
      >
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center ring-1 ring-white/5">
            <Logo size={24} animate />
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse ring-2 ring-slate-900" />
        </div>
        <div className="text-left">
          <p className="text-sm font-medium text-white">
            {isEditMode ? "Editing App" : `Building ${getAppType()}`}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="w-24 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
        <svg
          className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors ml-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Ambient glow background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-violet-500/[0.03] rounded-full blur-3xl" />
      </div>

      {/* Glass card */}
      <div className="relative w-full h-full flex flex-col bg-slate-900/70 backdrop-blur-2xl border border-slate-700/40 rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
        {/* Shimmer border effect */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div
            className="absolute -top-[1px] -left-[1px] -right-[1px] h-[1px]"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(99,102,241,0.3), rgba(139,92,246,0.3), transparent)",
            }}
          />
        </div>

        {/* Header section */}
        <div className="px-6 pt-6 pb-4 text-center">
          {/* Logo with glow */}
          <div className="relative inline-flex mb-3">
            <div className="absolute inset-0 blur-xl bg-gradient-to-r from-blue-500 to-violet-500 opacity-25 scale-150" />
            <div className="relative p-2.5 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-800/40 ring-1 ring-white/[0.08]">
              <Logo size={32} animate />
            </div>
          </div>

          <h2 className="text-base font-semibold text-white tracking-tight mb-1">
            {isEditMode ? "Editing your app" : `Building ${getAppType()}`}
          </h2>
          <p className="text-slate-400 text-xs leading-relaxed max-w-xs mx-auto line-clamp-2">
            {cleanPrompt}
          </p>
        </div>

        {/* Progress section */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Progress
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">
                {isEditMode ? "5-7 min" : "~5-7 min"}
              </span>
              <span className="text-xs font-semibold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent tabular-nums">
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          {/* Fancy progress bar */}
          <div className="relative h-2 bg-slate-800/80 rounded-full overflow-hidden ring-1 ring-white/[0.04]">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            >
              {/* Animated shine */}
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
                  animation: "shimmer 2s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-6 h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />

        {/* Steps list */}
        <div className="flex-1 px-3 py-3 overflow-y-auto">
          {steps.map((step, i) => {
            const isCompleted = i < currentStep - 1;
            const isCurrent = i === currentStep - 1;

            return (
              <div
                key={step.id}
                className={`relative flex items-center gap-3 px-3 py-[7px] rounded-xl transition-all duration-400 ${
                  isCurrent
                    ? "bg-gradient-to-r from-blue-500/[0.08] to-violet-500/[0.04]"
                    : ""
                }`}
              >
                {/* Vertical line connector */}
                {i < steps.length - 1 && (
                  <div
                    className={`absolute left-[23px] top-[28px] w-px h-[calc(100%-14px)] transition-colors duration-500 ${
                      isCompleted ? "bg-emerald-500/30" : "bg-slate-700/40"
                    }`}
                  />
                )}

                {/* Step indicator */}
                <div className="relative flex-shrink-0 z-10">
                  {isCompleted ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center ring-1 ring-emerald-500/30">
                      <svg
                        className="w-3 h-3 text-emerald-400"
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
                  ) : isCurrent ? (
                    <div className="w-5 h-5 rounded-full bg-blue-500/15 flex items-center justify-center ring-1 ring-blue-500/40">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-slate-800/60 flex items-center justify-center ring-1 ring-slate-700/40">
                      <div className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
                    </div>
                  )}
                </div>

                {/* Icon */}
                <div
                  className={`flex-shrink-0 transition-colors duration-300 ${
                    isCompleted
                      ? "text-emerald-500/50"
                      : isCurrent
                        ? "text-blue-400"
                        : "text-slate-600"
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={step.icon}
                    />
                  </svg>
                </div>

                {/* Label */}
                <span
                  className={`text-[13px] transition-all duration-300 ${
                    isCompleted
                      ? "text-slate-500"
                      : isCurrent
                        ? "text-white font-medium"
                        : "text-slate-500/70"
                  }`}
                >
                  {step.label}
                </span>

                {/* Current step spinner */}
                {isCurrent && (
                  <div className="ml-auto flex items-center gap-2">
                    <svg
                      className="w-3.5 h-3.5 text-blue-400/70 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  </div>
                )}

                {/* Completed check badge */}
                {isCompleted && (
                  <span className="ml-auto text-[10px] text-emerald-500/50 font-medium">
                    Done
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="mx-6 h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />

        {/* Actions */}
        <div className="px-6 py-3 flex items-center justify-center gap-2">
          {onToggleMinimize && (
            <button
              onClick={onToggleMinimize}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-700/50 rounded-lg ring-1 ring-white/[0.06] hover:ring-white/[0.1] transition-all duration-200"
            >
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              Minimize
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-red-400/80 hover:text-red-300 bg-red-500/[0.06] hover:bg-red-500/10 rounded-lg ring-1 ring-red-500/10 hover:ring-red-500/20 transition-all duration-200"
            >
              <svg
                className="w-3 h-3"
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
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Inline keyframes */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
      `}</style>
    </div>
  );
}
