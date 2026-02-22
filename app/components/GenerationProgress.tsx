"use client";

import Logo from "./Logo";
import CodeEditorLoading from "./CodeEditorLoading";

interface GenerationProgressProps {
  prompt: string;
  progressMessages: string[];
  onCancel?: () => void;
  onViewDetails?: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

interface ProgressStep {
  id: string;
  label: string;
  detail: string;
  icon: string;
  keywords: string[];
}

const GENERATION_STEPS: ProgressStep[] = [
  {
    id: "understand",
    label: "Understanding your request",
    detail: "Reviewing your idea, goals, and visual direction.",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    keywords: ["understanding", "analyz", "requirement", "planning"],
  },
  {
    id: "create",
    label: "Creating your website",
    detail: "Generating the core structure and components.",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    keywords: ["creating", "generat", "building", "website"],
  },
  {
    id: "prepare",
    label: "Preparing project files",
    detail: "Organizing files and dependencies for your app.",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    keywords: ["preparing", "parse", "file", "project files"],
  },
  {
    id: "refine",
    label: "Refining reliability and layout",
    detail: "Improving responsiveness and interaction quality.",
    icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
    keywords: ["reliability", "responsive", "layout", "navigation", "syntax"],
  },
  {
    id: "quality",
    label: "Running code quality checks",
    detail: "Verifying consistency and implementation quality.",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    keywords: ["quality", "lint", "checking", "polishing"],
  },
  {
    id: "finalize",
    label: "Finalizing and saving",
    detail: "Saving your generated app and preparing the preview.",
    icon: "M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4",
    keywords: ["finalizing", "saving", "persist", "merging"],
  },
  {
    id: "ready",
    label: "Ready to preview",
    detail: "Your app is prepared and ready.",
    icon: "M5 13l4 4L19 7",
    keywords: ["ready", "complete", "done", "preview"],
  },
];

const EDITING_STEPS: ProgressStep[] = [
  {
    id: "understand-edit",
    label: "Understanding your edits",
    detail: "Reviewing the requested changes and scope.",
    icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    keywords: ["understanding", "analyz", "edit"],
  },
  {
    id: "apply-edit",
    label: "Applying requested updates",
    detail: "Implementing changes in the right components.",
    icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    keywords: ["creating", "generat", "update", "modif"],
  },
  {
    id: "prepare-edit",
    label: "Preparing updated files",
    detail: "Aligning file structure for your latest changes.",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    keywords: ["preparing", "parse", "file"],
  },
  {
    id: "refine-edit",
    label: "Refining layout and behavior",
    detail: "Improving responsiveness and interaction flow.",
    icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
    keywords: ["responsive", "layout", "navigation", "reliability", "syntax"],
  },
  {
    id: "quality-edit",
    label: "Running code quality checks",
    detail: "Confirming stable edits before save.",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    keywords: ["quality", "lint", "checking", "polishing"],
  },
  {
    id: "save-edit",
    label: "Finalizing and saving edits",
    detail: "Applying your updates to the latest version.",
    icon: "M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4",
    keywords: ["finalizing", "saving", "persist", "merge", "applying"],
  },
  {
    id: "ready-edit",
    label: "Edits ready",
    detail: "Your updated app is ready to preview.",
    icon: "M5 13l4 4L19 7",
    keywords: ["ready", "complete", "done", "preview"],
  },
];

const STEP_PATTERN = /\[(\d+)\s*\/\s*(\d+)\]/;

function dedupeConsecutive(messages: string[]): string[] {
  const output: string[] = [];
  for (const message of messages) {
    if (output.length === 0 || output[output.length - 1] !== message) {
      output.push(message);
    }
  }
  return output;
}

function normalizeMessage(message: string): string {
  return message.replace(STEP_PATTERN, "").trim().toLowerCase();
}

function inferStepIndex(message: string, steps: ProgressStep[]): number {
  if (!message.trim()) return 0;

  const explicit = message.match(STEP_PATTERN);
  if (explicit) {
    const rawStep = Number.parseInt(explicit[1], 10);
    const step = Number.isFinite(rawStep) ? rawStep - 1 : 0;
    return Math.max(0, Math.min(step, steps.length - 1));
  }

  const normalized = normalizeMessage(message);
  const matchedIndex = steps.findIndex((step) =>
    step.keywords.some((keyword) => normalized.includes(keyword)),
  );
  if (matchedIndex !== -1) {
    return matchedIndex;
  }

  if (
    normalized.includes("ready") ||
    normalized.includes("complete") ||
    normalized.includes("done")
  ) {
    return steps.length - 1;
  }

  return 0;
}

function getProgressValue(stepIndex: number, totalSteps: number): number {
  const raw = ((stepIndex + 1) / totalSteps) * 100;
  if (stepIndex >= totalSteps - 1) return 100;
  return Math.min(Math.max(raw, 8), 97);
}

export default function GenerationProgress({
  prompt,
  progressMessages,
  onCancel,
  isMinimized = false,
  onToggleMinimize,
}: GenerationProgressProps) {
  const isEditMode = prompt.toLowerCase().startsWith("editing:");
  const cleanPrompt = isEditMode
    ? prompt.substring("Editing:".length).trim()
    : prompt;
  const steps = isEditMode ? EDITING_STEPS : GENERATION_STEPS;
  const cleanedMessages = dedupeConsecutive(progressMessages);
  const latestMessage = cleanedMessages[cleanedMessages.length - 1] || "";
  const currentStepIndex = inferStepIndex(latestMessage, steps);
  const currentStep = steps[currentStepIndex];
  const progress = getProgressValue(currentStepIndex, steps.length);

  const showCodeEditor =
    latestMessage.toLowerCase().includes("install") &&
    latestMessage.toLowerCase().includes("dependencies");

  const getAppType = () => {
    const lowerPrompt = cleanPrompt.toLowerCase();
    if (lowerPrompt.includes("e-commerce") || lowerPrompt.includes("shop")) {
      return "E-Commerce App";
    }
    if (lowerPrompt.includes("restaurant") || lowerPrompt.includes("food")) {
      return "Restaurant App";
    }
    if (lowerPrompt.includes("portfolio")) return "Portfolio App";
    if (lowerPrompt.includes("blog")) return "Blog App";
    if (lowerPrompt.includes("saas") || lowerPrompt.includes("landing")) {
      return "SaaS Landing Page";
    }
    if (lowerPrompt.includes("fitness") || lowerPrompt.includes("workout")) {
      return "Fitness App";
    }
    if (lowerPrompt.includes("dashboard")) return "Dashboard App";
    return "your App";
  };

  if (isMinimized) {
    return (
      <button
        onClick={onToggleMinimize}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-bg-secondary/90 backdrop-blur-xl border border-border-secondary/50 rounded-2xl shadow-2xl shadow-blue-500/10 hover:border-blue-500/30 hover:shadow-blue-500/20 transition-all duration-300 group"
      >
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center ring-1 ring-white/5">
            <Logo size={24} animate />
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse ring-2 ring-bg-secondary" />
        </div>
        <div className="text-left">
          <p className="text-sm font-medium text-text-primary">
            {isEditMode ? "Editing App" : `Building ${getAppType()}`}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="w-24 h-1.5 bg-border-secondary/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-text-tertiary tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
        <svg
          className="w-4 h-4 text-text-muted group-hover:text-blue-400 transition-colors ml-1"
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
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-blue-500/[0.05] rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/3 w-[280px] h-[280px] bg-violet-500/[0.05] rounded-full blur-3xl" />
      </div>

      <div className="relative w-full h-full flex flex-col bg-bg-secondary/70 backdrop-blur-2xl border border-border-secondary/40 shadow-2xl shadow-black/20 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-[1px] -left-[1px] -right-[1px] h-[1px]"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(99,102,241,0.32), rgba(139,92,246,0.32), transparent)",
            }}
          />
        </div>

        <div className="px-8 pt-8 pb-5 text-center">
          <div className="relative inline-flex mb-4">
            <div className="absolute inset-0 blur-xl bg-gradient-to-r from-blue-500 to-violet-500 opacity-25 scale-150" />
            <div className="relative p-3.5 rounded-2xl bg-gradient-to-br from-bg-tertiary/80 to-bg-tertiary/40 ring-1 ring-white/[0.08]">
              <Logo size={40} animate />
            </div>
          </div>

          <h2 className="text-xl font-bold text-text-primary tracking-tight mb-2">
            {isEditMode ? "Editing your app" : `Building ${getAppType()}`}
          </h2>
          <p className="text-text-tertiary text-sm leading-relaxed max-w-md mx-auto line-clamp-2">
            {cleanPrompt}
          </p>
        </div>

        <div className="px-8 pb-5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Current Step
            </span>
            <span className="text-sm font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>

          <div className="relative h-2.5 bg-bg-tertiary/80 rounded-full overflow-hidden ring-1 ring-white/[0.04]">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 progress-shimmer" />
            </div>
          </div>
        </div>

        <div className="mx-8 h-px bg-gradient-to-r from-transparent via-border-secondary/50 to-transparent" />

        <div className="flex-1 flex items-center justify-center px-6 py-6">
          <div className="relative w-full">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/[0.08] via-indigo-500/[0.06] to-violet-500/[0.08] blur-2xl rounded-[2rem]" />

            <div className="relative rounded-[2rem] border border-border-secondary/60 bg-bg-tertiary/55 backdrop-blur-xl p-8 sm:p-10 text-center shadow-[0_20px_60px_-30px_rgba(59,130,246,0.5)]">
              <div className="relative mx-auto w-20 h-20 mb-6 floating-icon">
                <div className="absolute inset-0 rounded-full border border-blue-400/35 orbit-ring" />
                <div className="absolute inset-[10px] rounded-full bg-gradient-to-br from-blue-500/15 to-violet-500/15 ring-1 ring-white/10 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-blue-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={currentStep.icon}
                    />
                  </svg>
                </div>
              </div>

              <p className="text-[11px] uppercase tracking-[0.2em] text-text-muted font-semibold mb-3">
                {isEditMode ? "Editing In Progress" : "Generation In Progress"}
              </p>
              <h3 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight mb-3">
                {currentStep.label}
              </h3>
              <p className="text-sm sm:text-base text-text-tertiary mx-auto">
                {currentStep.detail}
              </p>

              <div className="mt-6 flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400/80 dot-bounce dot-delay-0" />
                <span className="w-2 h-2 rounded-full bg-indigo-400/80 dot-bounce dot-delay-1" />
                <span className="w-2 h-2 rounded-full bg-violet-400/80 dot-bounce dot-delay-2" />
              </div>
            </div>
          </div>
        </div>

        <div className="mx-8 h-px bg-gradient-to-r from-transparent via-border-secondary/50 to-transparent" />

        <div className="px-8 py-4 flex items-center justify-center gap-3">
          {onToggleMinimize && (
            <button
              onClick={onToggleMinimize}
              className="flex items-center gap-2 px-4 py-2 text-sm text-text-tertiary hover:text-text-primary bg-bg-tertiary/40 hover:bg-border-secondary/50 rounded-lg ring-1 ring-white/[0.06] hover:ring-white/[0.1] transition-all duration-200"
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
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              Minimize
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-2 px-4 py-2 text-sm text-red-400/80 hover:text-red-300 bg-red-500/[0.06] hover:bg-red-500/10 rounded-lg ring-1 ring-red-500/10 hover:ring-red-500/20 transition-all duration-200"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Cancel
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .progress-shimmer {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.35) 50%,
            transparent 100%
          );
          animation: shimmer 2s ease-in-out infinite;
          opacity: 0.3;
        }

        .floating-icon {
          animation: float 3.2s ease-in-out infinite;
        }

        .orbit-ring {
          animation: orbit 4.5s linear infinite;
        }

        .dot-bounce {
          animation: dotBounce 1.2s infinite ease-in-out;
        }

        .dot-delay-0 {
          animation-delay: 0s;
        }

        .dot-delay-1 {
          animation-delay: 0.2s;
        }

        .dot-delay-2 {
          animation-delay: 0.4s;
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        @keyframes orbit {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes dotBounce {
          0%,
          80%,
          100% {
            transform: translateY(0);
            opacity: 0.35;
          }
          40% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }
      `}</style>

      {showCodeEditor && <CodeEditorLoading message={latestMessage} />}
    </div>
  );
}
