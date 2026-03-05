import Logo from "../Logo";
import GenerationProgress from "../GenerationProgress";
import LaunchAnimation from "../LaunchAnimation";
import type { CompatibleUser } from "@/app/contexts/AuthContext";
import type { UploadedFile } from "@/app/types";

const MOBILE_EXAMPLES = [
  {
    icon: "🛍️",
    name: "E-Commerce",
    desc: "Product listings, cart & checkout",
    query: "Create a modern e-commerce app with product listings",
  },
  {
    icon: "🍕",
    name: "Restaurant",
    desc: "Menu, reservations & about",
    query: "Create a restaurant app with menu, and about pages",
  },
  {
    icon: "🚀",
    name: "SaaS Dashboard",
    desc: "Users, billing & analytics",
    query:
      "Create a SaaS dashboard app with billing section, and analytics charts",
  },
  {
    icon: "✍️",
    name: "Blog",
    desc: "Posts, comments & search",
    query:
      "Create a blog app with MDX support, and full-text search functionality",
  },
];

const DESKTOP_ONLY_EXAMPLES = [
  {
    icon: "💼",
    name: "Portfolio",
    desc: "Case studies & contact flow",
    query: "Create a portfolio website with case studies and contact page",
  },
  {
    icon: "🏋️",
    name: "Fitness",
    desc: "Plans, trainers & schedule",
    query:
      "Create a fitness studio website with trainers, class schedules, and pricing",
  },
  {
    icon: "🏠",
    name: "Real Estate",
    desc: "Listings, agents & inquiry",
    query:
      "Create a real estate website with property listings, agent profiles, and contact forms",
  },
  {
    icon: "💡",
    name: "Agency",
    desc: "Services, projects & CTA",
    query:
      "Create a digital agency website with services, case studies, and lead capture",
  },
];

interface CreateContentProps {
  user: CompatibleUser | null;
  status: string;
  isGenerationMinimized: boolean;
  generationPrompt: string;
  progressMessages: string[];
  error: string;
  prompt: string;
  uploadedFiles: UploadedFile[];
  fileInputRef: React.RefObject<HTMLInputElement>;
  backendEnabled: boolean;
  isRecording: boolean;
  voiceError: string | null;
  authPromptWarning: string | null;
  blockedPromptWords: string[];
  checkingAuthIntent: boolean;
  setIsGenerationMinimized: (val: boolean) => void;
  cancelGeneration: () => void;
  setShowSignInModal: (val: boolean) => void;
  setPrompt: (val: string) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeFile: (idx: number) => void;
  startRecording: () => void;
  stopRecording: () => void;
  setVoiceError: (val: string | null) => void;
  onToggleBackend: () => void;
  projectType: "website" | "dashboard";
  onSetProjectType: (type: "website" | "dashboard") => void;
  paymentsEnabled: boolean;
  onTogglePayments: () => void;
  handleGenerate: (e: React.FormEvent) => void;
  setAuthPromptWarning: (val: string | null) => void;
  setBlockedPromptWords: (val: string[]) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  isLaunching?: boolean;
}

export default function CreateContent({
  user,
  status,
  isGenerationMinimized,
  generationPrompt,
  progressMessages,
  error,
  prompt,
  uploadedFiles,
  fileInputRef,
  backendEnabled,
  isRecording,
  voiceError,
  authPromptWarning,
  blockedPromptWords,
  checkingAuthIntent,
  setIsGenerationMinimized,
  cancelGeneration,
  setShowSignInModal,
  setPrompt,
  handleFileUpload,
  removeFile,
  startRecording,
  stopRecording,
  setVoiceError,
  onToggleBackend,
  projectType,
  onSetProjectType,
  paymentsEnabled,
  onTogglePayments,
  handleGenerate,
  setAuthPromptWarning,
  setBlockedPromptWords,
  textareaRef,
  isLaunching = false,
}: CreateContentProps) {
  if (isLaunching) {
    return <LaunchAnimation prompt={generationPrompt || prompt} />;
  }

  if (status === "loading" && !isGenerationMinimized) {
    return (
      <GenerationProgress
        prompt={generationPrompt}
        progressMessages={progressMessages}
        onCancel={cancelGeneration}
        isMinimized={false}
        onToggleMinimize={() => setIsGenerationMinimized(true)}
      />
    );
  }

  return (
    <>
      {status === "loading" && isGenerationMinimized && (
        <div className="w-full max-w-2xl mb-6">
          <button
            onClick={() => setIsGenerationMinimized(false)}
            className="w-full flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl hover:bg-blue-500/15 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Logo size={24} animate />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-blue-300">
                  Building your app...
                </p>
                <p className="text-xs text-blue-400/70">
                  Click to view progress
                </p>
              </div>
            </div>
            <svg
              className="w-5 h-5 text-blue-400 group-hover:translate-x-1 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      )}

      {!user && (
        <div className="text-center mb-10 max-w-2xl">
          <div className="inline-flex items-center justify-center mb-6">
            <Logo size={56} animate />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-text-primary mb-3 tracking-tight">
            Mato
          </h1>
          <p className="text-lg text-text-tertiary max-w-md mx-auto mb-6">
            Describe your app and watch it come to life
          </p>
          <button
            onClick={() => setShowSignInModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-medium rounded-lg transition-all"
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
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M18 12l-3-3m0 0l3-3m-3 3h8.25"
              />
            </svg>
            Sign In to Get Started
          </button>
        </div>
      )}

      {user && !isGenerationMinimized && (
        <div className="text-center mb-8 w-full max-w-3xl">
          <h2 className="text-2xl font-semibold text-text-primary mb-2">
            Create a New App
          </h2>
          <p className="text-text-tertiary">
            Describe your app and we&apos;ll build it for you
          </p>
          <div className="mt-3 flex justify-center">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${
                projectType === "dashboard"
                  ? "text-blue-700 bg-blue-100 border-blue-300 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/30"
                  : "text-slate-700 bg-slate-100 border-slate-300 dark:text-slate-300 dark:bg-slate-500/10 dark:border-slate-500/30"
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                {projectType === "dashboard" ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 12h18M12 3c4.97 0 9 4.03 9 9s-4.03 9-9 9-9-4.03-9-9 4.03-9 9-9z"
                  />
                )}
              </svg>
              {projectType === "dashboard" ? "Dashboard mode" : "Website mode"}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="w-full max-w-3xl mb-6">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-300 rounded-xl text-red-800 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300">
            <svg
              className="w-5 h-5 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium">Generation failed</p>
              <p className="text-sm text-red-700 mt-1 dark:text-red-300/90">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-3xl mb-8 overflow-x-hidden">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3 text-center">
          Quick start
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {MOBILE_EXAMPLES.map((ex) => (
            <button
              key={ex.name}
              onClick={() => setPrompt(ex.query)}
              className="group p-3 bg-bg-secondary/50 hover:bg-bg-tertiary/70 border border-border-primary hover:border-border-secondary rounded-xl text-left transition-all duration-200"
            >
              <div className="flex items-center gap-2.5 mb-1">
                <span className="text-xl">{ex.icon}</span>
                <span className="text-sm font-medium text-text-primary group-hover:text-blue-400 transition-colors">
                  {ex.name}
                </span>
              </div>
              <p className="text-xs text-text-muted pl-8 line-clamp-1">
                {ex.desc}
              </p>
            </button>
          ))}
          {DESKTOP_ONLY_EXAMPLES.map((ex) => (
            <button
              key={ex.name}
              onClick={() => setPrompt(ex.query)}
              className="hidden sm:block group p-3 bg-bg-secondary/50 hover:bg-bg-tertiary/70 border border-border-primary hover:border-border-secondary rounded-xl text-left transition-all duration-200"
            >
              <div className="flex items-center gap-2.5 mb-1">
                <span className="text-xl">{ex.icon}</span>
                <span className="text-sm font-medium text-text-primary group-hover:text-blue-400 transition-colors">
                  {ex.name}
                </span>
              </div>
              <p className="text-xs text-text-muted pl-8 line-clamp-1">
                {ex.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="w-full mb-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {uploadedFiles.map((file, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary/50 border border-border-secondary rounded-lg text-sm"
              >
                <span className="text-xs text-text-secondary">{file.name}</span>
                <button
                  onClick={() => removeFile(idx)}
                  className="text-text-muted hover:text-red-400 transition"
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
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {voiceError && (
        <div className="mb-3 p-4 bg-red-50 border border-red-300 rounded-xl flex items-start gap-3 dark:bg-red-500/10 dark:border-red-500/30">
          <svg
            className="w-5 h-5 text-red-700 dark:text-red-300 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-sm text-red-800 dark:text-red-300 font-medium">
            {voiceError}
          </p>
          <button
            onClick={() => setVoiceError(null)}
            className="text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200 transition"
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
      )}

      {authPromptWarning && (
        <div className="mb-3 p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 dark:bg-amber-500/10 dark:border-amber-500/30">
          <svg
            className="w-5 h-5 text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium whitespace-pre-line">
              {authPromptWarning}
            </p>
            {blockedPromptWords.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-amber-900 dark:text-amber-200">
                  Blocked word(s):
                </span>
                {blockedPromptWords.map((word) => (
                  <span
                    key={word}
                    className="inline-flex items-center rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-300"
                  >
                    {word}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setAuthPromptWarning(null);
              setBlockedPromptWords([]);
            }}
            className="text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 transition"
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
      )}

      <form onSubmit={handleGenerate} className="w-full max-w-3xl">
        <div className="bg-bg-secondary/80 backdrop-blur-xl border border-border-primary rounded-2xl shadow-2xl shadow-black/30 overflow-hidden focus-within:border-border-secondary transition-colors w-full">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (prompt.trim()) {
                  handleGenerate(e as unknown as React.FormEvent);
                }
              }
            }}
            rows={1}
            className="w-full px-4 pt-4 pb-4 bg-transparent text-text-primary focus:outline-none resize-none text-base"
            style={{ minHeight: "52px", maxHeight: "150px" }}
            placeholder="Describe your app..."
          />

          <div className="flex flex-col gap-2 px-3 py-2.5 bg-bg-secondary/50 border-t border-border-primary/60 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center flex-wrap gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-text-muted hover:text-text-secondary hover:bg-bg-tertiary rounded-lg transition"
                title="Attach files"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() =>
                  isRecording ? stopRecording() : startRecording()
                }
                className={`p-2 rounded-lg transition ${isRecording ? "text-red-500 bg-red-500/10 hover:text-red-400 hover:bg-red-500/20 animate-pulse" : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary"}`}
                title={isRecording ? "Stop recording" : "Voice input"}
              >
                {isRecording ? (
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                    />
                  </svg>
                )}
              </button>
              <div className="w-px h-5 bg-border-secondary mx-0.5" />
              <select
                value={projectType}
                onChange={(e) => onSetProjectType(e.target.value as "website" | "dashboard")}
                className={`px-2 py-1.5 rounded-lg transition text-[11px] font-medium bg-transparent border-none outline-none cursor-pointer appearance-none pr-5 max-w-[110px] sm:max-w-none ${
                  projectType === "dashboard"
                    ? "text-blue-300 bg-blue-500/10"
                    : "text-text-muted hover:text-text-secondary"
                }`}
                title="Select project type"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center' }}
              >
                <option value="website">Website</option>
                <option value="dashboard">Dashboard</option>
              </select>
              <button
                type="button"
                onClick={onToggleBackend}
                className={`px-2 py-1 rounded-lg transition flex flex-col items-center leading-none ${backendEnabled ? "text-violet-300 bg-violet-500/10 hover:bg-violet-500/20" : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary"}`}
                title={
                  backendEnabled
                    ? "Backend enabled (authentication + database)"
                    : "Enable backend (authentication + database)"
                }
              >
                <svg
                  className="w-5 h-5"
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
                <span className="mt-0.5 text-[10px] font-medium">Backend</span>
              </button>
              <button
                type="button"
                onClick={onTogglePayments}
                className={`px-2 py-1 rounded-lg transition flex flex-col items-center leading-none ${paymentsEnabled ? "text-amber-300 bg-amber-500/10 hover:bg-amber-500/20" : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary"}`}
                title={
                  paymentsEnabled
                    ? "Payments enabled (Stripe Checkout)"
                    : "Enable payments (Stripe Checkout)"
                }
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 7.5h16.5M5.25 5.25h13.5A1.5 1.5 0 0120.25 6.75v10.5a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V6.75a1.5 1.5 0 011.5-1.5zm10.5 8.25h1.5"
                  />
                </svg>
                <span className="mt-0.5 text-[10px] font-medium">Payment</span>
              </button>
            </div>
            <button
              type="submit"
              disabled={!prompt.trim() || checkingAuthIntent}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {checkingAuthIntent ? (
                <svg
                  className="w-4 h-4 animate-spin"
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
              ) : (
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
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              )}
              {checkingAuthIntent ? "Checking..." : "Generate"}
            </button>
          </div>
        </div>
      </form>

      <div className="flex items-center justify-center gap-2 mt-2.5 flex-wrap max-w-2xl">
        {backendEnabled && (
          <button
            type="button"
            onClick={onToggleBackend}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-100 border border-violet-300 rounded-full hover:bg-violet-200 transition dark:bg-violet-500/10 dark:border-violet-500/30 dark:hover:bg-violet-500/20"
          >
            <svg
              className="w-3.5 h-3.5 text-violet-700 dark:text-violet-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
              />
            </svg>
            <span className="text-xs text-violet-800 font-medium dark:text-violet-200">
              Backend enabled (Auth + Database)
            </span>
          </button>
        )}
        {paymentsEnabled && (
          <button
            type="button"
            onClick={onTogglePayments}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 border border-amber-300 rounded-full hover:bg-amber-200 transition dark:bg-amber-500/10 dark:border-amber-500/30 dark:hover:bg-amber-500/20"
          >
            <svg
              className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 7.5h16.5M5.25 5.25h13.5A1.5 1.5 0 0120.25 6.75v10.5a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V6.75a1.5 1.5 0 011.5-1.5zm10.5 8.25h1.5"
              />
            </svg>
            <span className="text-xs text-amber-800 font-medium dark:text-amber-200">
              Payments (Stripe)
            </span>
          </button>
        )}
      </div>
    </>
  );
}
