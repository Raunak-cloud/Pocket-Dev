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
    description: "Understanding your app requirements and features",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    id: "architecture",
    label: "Designing architecture",
    description: "Planning component structure and data flow",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: "components",
    label: "Creating components",
    description: "Building reusable UI components",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  },
  {
    id: "pages",
    label: "Building pages",
    description: "Assembling pages with navigation",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "styling",
    label: "Styling with Tailwind",
    description: "Applying beautiful, responsive styles",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
  {
    id: "routing",
    label: "Setting up routing",
    description: "Configuring page navigation",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    id: "checks",
    label: "Running checks",
    description: "Validating code quality and fixing issues",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const EDITING_STEPS = [
  {
    id: "understand",
    label: "Understanding changes",
    description: "Analyzing your edit request and existing code",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    id: "planning",
    label: "Planning modifications",
    description: "Determining the best approach for your changes",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    id: "updating",
    label: "Updating components",
    description: "Modifying existing UI components",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    id: "refining",
    label: "Refining layout",
    description: "Adjusting structure and organization",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  },
  {
    id: "polishing",
    label: "Polishing styles",
    description: "Enhancing visual design and responsiveness",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
  {
    id: "integrating",
    label: "Integrating features",
    description: "Connecting new functionality with existing code",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "testing",
    label: "Testing changes",
    description: "Verifying functionality and fixing any issues",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function GenerationProgress({
  prompt,
  progressMessages,
  onCancel,
  isMinimized = false,
  onToggleMinimize,
}: GenerationProgressProps) {
  // Detect if this is an edit operation (check for "Editing: " prefix)
  const isEditMode = prompt.toLowerCase().startsWith("editing:");
  const steps = isEditMode ? EDITING_STEPS : GENERATION_STEPS;

  const totalSteps = steps.length;
  const currentStep = progressMessages.length;
  const progress = Math.min((currentStep / totalSteps) * 100, 95);

  // Remove "Editing: " prefix if present
  const cleanPrompt = isEditMode ? prompt.substring("Editing:".length).trim() : prompt;

  // Extract app type from prompt
  const getAppType = () => {
    const lowerPrompt = cleanPrompt.toLowerCase();
    if (lowerPrompt.includes("e-commerce") || lowerPrompt.includes("shop")) return "E-Commerce App";
    if (lowerPrompt.includes("restaurant") || lowerPrompt.includes("food")) return "Restaurant App";
    if (lowerPrompt.includes("portfolio")) return "Portfolio App";
    if (lowerPrompt.includes("blog")) return "Blog App";
    if (lowerPrompt.includes("saas") || lowerPrompt.includes("landing")) return "SaaS Landing Page";
    if (lowerPrompt.includes("fitness") || lowerPrompt.includes("workout")) return "Fitness App";
    if (lowerPrompt.includes("dashboard")) return "Dashboard App";
    return "React App";
  };

  // Minimized floating indicator
  if (isMinimized) {
    return (
      <button
        onClick={onToggleMinimize}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl hover:border-slate-600 transition-all group"
      >
        <div className="relative">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center">
            <Logo size={24} animate />
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
        </div>
        <div className="text-left">
          <p className="text-sm font-medium text-white">
            {isEditMode ? "Editing App" : `Building ${getAppType()}`}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-slate-400">{Math.round(progress)}%</span>
          </div>
        </div>
        <svg
          className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>
    );
  }

  // Sketchy hand-drawn workflow design with row wrapping
  const stepsPerRow = 4;
  const rows: typeof steps[][] = [];
  for (let i = 0; i < steps.length; i += stepsPerRow) {
    rows.push(steps.slice(i, i + stepsPerRow));
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header - Sketchy Style */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center mb-4">
          <div className="relative">
            <div className="absolute inset-0 blur-2xl bg-gradient-to-r from-blue-500 to-violet-500 opacity-20" />
            <Logo size={48} animate className="relative" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
          {isEditMode ? "Editing your App" : `Building ${getAppType()}`}
        </h2>
        <p className="text-slate-400 text-sm max-w-2xl mx-auto line-clamp-2 mb-4">
          {cleanPrompt}
        </p>

        {/* Sketchy progress badge */}
        <div className="inline-flex items-center gap-4 px-6 py-2.5 bg-slate-900/60 border-2 border-dashed border-slate-700 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm animate-pulse" />
            <span className="text-sm text-slate-300 font-semibold">
              {isEditMode ? "Applying Changes" : "In Progress"}
            </span>
          </div>
          <div className="w-px h-4 bg-slate-600" />
          <span className="text-sm font-black text-blue-400 tabular-nums">{Math.round(progress)}%</span>
          <div className="w-px h-4 bg-slate-600" />
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            ⏱️ {isEditMode ? "3-5 min" : "5-7 min"}
          </div>
          {isEditMode && (
            <>
              <div className="w-px h-4 bg-slate-600" />
              <span className="text-xs text-amber-400 font-medium">⚠️ This may take some time</span>
            </>
          )}
        </div>
      </div>

      {/* Sketchy Workflow Pipeline with Row Wrapping */}
      <div className="bg-slate-900/60 border-2 border-dashed border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div>
          {rows.map((rowSteps, rowIndex) => (
            <div key={rowIndex}>
              {/* Steps Row */}
              <div className="flex items-center justify-center gap-2 mb-4">
                {rowSteps.map((step, stepInRow) => {
                  const i = rowIndex * stepsPerRow + stepInRow;
                  const isCompleted = i < currentStep - 1;
                  const isCurrent = i === currentStep - 1;
                  const isPending = i > currentStep - 1;
                  const isLastInRow = stepInRow === rowSteps.length - 1;
                  const isLastOverall = i === GENERATION_STEPS.length - 1;

                  return (
                    <div key={step.id} className="flex items-center">
                      {/* Step Node - Sketchy */}
                      <div className="flex flex-col items-center gap-2 relative">
                        {/* Sketchy Icon Box */}
                        <div
                          className={`
                            relative w-20 h-20 flex items-center justify-center transition-all duration-500
                            border-2 border-dashed rounded-lg
                            ${isCompleted ? "bg-emerald-900/20 border-emerald-500" : ""}
                            ${isCurrent ? "bg-blue-900/30 border-blue-500 scale-110 shadow-lg shadow-blue-500/30" : ""}
                            ${isPending ? "bg-slate-800/30 border-slate-600 opacity-60" : ""}
                          `}
                        >
                          {isCompleted ? (
                            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <div className={isCurrent ? "text-blue-400" : "text-slate-500"}>
                              {step.icon}
                            </div>
                          )}

                          {/* Sketchy glow for current */}
                          {isCurrent && (
                            <>
                              <div className="absolute inset-0 rounded-lg bg-blue-500 opacity-10 blur-md" />
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-ping" />
                            </>
                          )}
                        </div>

                        {/* Sketchy Label */}
                        <div className="text-center max-w-[110px]">
                          <p
                            className={`text-xs font-bold mb-0.5 transition-colors ${
                              isCompleted ? "text-emerald-400" : isCurrent ? "text-white" : "text-slate-500"
                            }`}
                            style={{ fontFamily: 'Comic Sans MS, cursive' }}
                          >
                            {step.label}
                          </p>
                        </div>

                        {/* Sketchy number badge */}
                        <div
                          className={`
                            absolute -top-3 -right-3 w-7 h-7 border-2 border-dashed rounded-sm flex items-center justify-center text-xs font-black
                            ${isCompleted ? "bg-emerald-900/40 border-emerald-500 text-emerald-400" : ""}
                            ${isCurrent ? "bg-blue-900/40 border-blue-500 text-blue-400 animate-pulse" : ""}
                            ${isPending ? "bg-slate-800/40 border-slate-600 text-slate-500" : ""}
                          `}
                          style={{ fontFamily: 'Comic Sans MS, cursive' }}
                        >
                          {i + 1}
                        </div>
                      </div>

                      {/* Sketchy Arrow - Horizontal */}
                      {!isLastInRow && !isLastOverall && (
                        <div className="flex items-center px-2">
                          <svg width="50" height="24" viewBox="0 0 50 24">
                            {/* Sketchy wavy line */}
                            <path
                              d="M 2 12 Q 12 8, 25 12 T 45 12"
                              fill="none"
                              strokeWidth="2"
                              strokeDasharray="3,2"
                              className={`transition-all duration-500 ${
                                isCompleted ? "stroke-emerald-500" :
                                isCurrent && i === currentStep - 2 ? "stroke-blue-500" :
                                isCurrent && i === currentStep - 1 ? "stroke-blue-500/50" :
                                "stroke-slate-600"
                              }`}
                            />
                            {/* Arrow head */}
                            <path
                              d="M 45 12 L 40 8 L 42 12 L 40 16 Z"
                              className={`transition-all duration-500 ${
                                isCompleted ? "fill-emerald-500" :
                                isCurrent && i === currentStep - 2 ? "fill-blue-500" :
                                isCurrent && i === currentStep - 1 ? "fill-blue-500/50" :
                                "fill-slate-600"
                              }`}
                            />
                            {/* Animated dot */}
                            {isCurrent && i === currentStep - 1 && (
                              <circle cx="0" cy="12" r="3" className="fill-blue-400">
                                <animate attributeName="cx" from="2" to="45" dur="1.5s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0;1;1;0" dur="1.5s" repeatCount="indefinite" />
                              </circle>
                            )}
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Turning Arrow to Next Row */}
              {rowIndex < rows.length - 1 && (
                <div className="flex justify-end pr-12 mb-4">
                  <svg width="60" height="60" viewBox="0 0 60 60">
                    {/* Curved sketchy arrow going down and turning */}
                    <path
                      d="M 30 5 Q 35 20, 30 35 Q 25 45, 15 50"
                      fill="none"
                      strokeWidth="2.5"
                      strokeDasharray="4,3"
                      className={`transition-all ${
                        rowIndex * stepsPerRow + rowSteps.length - 1 < currentStep - 1
                          ? "stroke-emerald-500"
                          : rowIndex * stepsPerRow + rowSteps.length - 1 === currentStep - 1
                          ? "stroke-blue-500"
                          : "stroke-slate-600"
                      }`}
                    />
                    {/* Arrow head pointing to next row */}
                    <path
                      d="M 15 50 L 18 45 L 15 47 L 10 45 Z"
                      className={`transition-all ${
                        rowIndex * stepsPerRow + rowSteps.length - 1 < currentStep - 1
                          ? "fill-emerald-500"
                          : rowIndex * stepsPerRow + rowSteps.length - 1 === currentStep - 1
                          ? "fill-blue-500"
                          : "fill-slate-600"
                      }`}
                    />
                  </svg>
                </div>
              )}
            </div>
          ))}

          {/* Current Step Detail - Sketchy Banner */}
          {currentStep > 0 && currentStep <= steps.length && (
            <div className="mt-6 p-4 bg-blue-500/10 border-2 border-dashed border-blue-500/40 rounded-lg">
              <div className="flex items-center justify-center gap-3">
                <div className="text-2xl">{steps[currentStep - 1].icon}</div>
                <div className="text-center">
                  <p className="text-white font-bold text-sm" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
                    → {steps[currentStep - 1].label}
                  </p>
                  <p className="text-blue-300/70 text-xs">
                    {steps[currentStep - 1].description}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions - Sketchy */}
        <div className="mt-6 pt-4 border-t-2 border-dashed border-slate-800 flex items-center justify-center gap-4">
          {onToggleMinimize && (
            <button
              onClick={onToggleMinimize}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 border border-dashed border-slate-700 rounded-lg transition"
            >
              ↓ Minimize
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-dashed border-red-500/30 rounded-lg transition"
            >
              ✕ Cancel
            </button>
          )}
        </div>
      </div>

      {/* Tip - Sketchy */}
      <div className="mt-6 text-center">
        <p className="text-xs text-slate-500 italic">
          💡 Tip: Minimize to explore while we build your app
        </p>
      </div>
    </div>
  );
}
