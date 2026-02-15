import { useRef, useCallback, useEffect } from "react";
import Logo from "../Logo";
import GenerationProgress from "../GenerationProgress";
import type { CompatibleUser } from "@/app/contexts/AuthContext";
import type { ReactProject, UploadedFile } from "@/app/types";

const EXAMPLES = [
  {
    icon: "🛍️",
    name: "E-Commerce",
    desc: "Product listings, cart & checkout",
    query:
      "Create a modern e-commerce Next.js app with product listings, shopping cart, and checkout pages using App Router and server components",
  },
  {
    icon: "🍕",
    name: "Restaurant",
    desc: "Menu, reservations & about",
    query:
      "Create a restaurant Next.js app with menu, reservations, and about pages using dynamic routes and App Router",
  },
  {
    icon: "🚀",
    name: "SaaS Dashboard",
    desc: "Users, billing & analytics",
    query:
      "Create a SaaS dashboard Next.js app with user authentication, billing section, and analytics charts using Recharts",
  },
  {
    icon: "✍️",
    name: "Blog",
    desc: "Posts, comments & search",
    query:
      "Create a blog Next.js app with MDX support, comments section, and full-text search functionality",
  },
  {
    icon: "🎬",
    name: "Movie Database",
    desc: "Listings, ratings & reviews",
    query:
      "Create a movie database Next.js app with movie listings, user ratings, and review functionality",
  },
  {
    icon: "📚",
    name: "Learning Platform",
    desc: "Courses, lessons & progress",
    query:
      "Create an online learning platform Next.js app with courses, lessons, and student progress tracking",
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
  currentAppAuth: string[];
  isRecording: boolean;
  voiceError: string | null;
  authPromptWarning: string | null;
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
  setShowAuthModal: (val: boolean) => void;
  setCurrentAppAuth: (val: string[]) => void;
  handleGenerate: (e: React.FormEvent) => void;
  setShowDbModal: (val: boolean) => void;
  setAuthPromptWarning: (val: string | null) => void;
  setError: (val: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
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
  currentAppAuth,
  isRecording,
  voiceError,
  authPromptWarning,
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
  setShowAuthModal,
  setCurrentAppAuth,
  handleGenerate,
  setShowDbModal,
  setAuthPromptWarning,
  setError,
  textareaRef,
}: CreateContentProps) {
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
                <p className="text-sm font-medium text-blue-300">Building your app...</p>
                <p className="text-xs text-blue-400/70">Click to view progress</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-blue-400 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {!user && (
        <div className="text-center mb-10 max-w-2xl">
          <div className="inline-flex items-center justify-center mb-6">
            <Logo size={56} animate />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-text-primary mb-3 tracking-tight">Pocket Dev</h1>
          <p className="text-lg text-text-tertiary max-w-md mx-auto mb-6">Describe your app and watch it come to life</p>
          <button onClick={() => setShowSignInModal(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-medium rounded-lg transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M18 12l-3-3m0 0l3-3m-3 3h8.25" />
            </svg>
            Sign In to Get Started
          </button>
        </div>
      )}

      {user && !isGenerationMinimized && (
        <div className="text-center mb-8 w-full max-w-3xl">
          <h2 className="text-2xl font-semibold text-text-primary mb-2">Create a New App</h2>
          <p className="text-text-tertiary">Describe your app and we&apos;ll build it for you</p>
        </div>
      )}

      {error && (
        <div className="w-full max-w-3xl mb-6">
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium">Generation failed</p>
              <p className="text-sm text-red-400/80 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-3xl mb-8">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3 text-center">Quick start</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex.name} onClick={() => setPrompt(ex.query)} className="group p-3 bg-bg-secondary/50 hover:bg-bg-tertiary/70 border border-border-primary hover:border-border-secondary rounded-xl text-left transition-all duration-200">
              <div className="flex items-center gap-2.5 mb-1">
                <span className="text-xl">{ex.icon}</span>
                <span className="text-sm font-medium text-text-primary group-hover:text-blue-400 transition-colors">{ex.name}</span>
              </div>
              <p className="text-xs text-text-muted pl-8">{ex.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="w-full mb-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {uploadedFiles.map((file, idx) => (
              <div key={idx} className="inline-flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary/50 border border-border-secondary rounded-lg text-sm">
                <span className="text-xs text-text-secondary">{file.name}</span>
                <button onClick={() => removeFile(idx)} className="text-text-muted hover:text-red-400 transition">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {voiceError && (
        <div className="mb-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-red-300 font-medium">{voiceError}</p>
          <button onClick={() => setVoiceError(null)} className="text-red-400 hover:text-red-300 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {authPromptWarning && (
        <div className="mb-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <p className="text-sm text-amber-300 font-medium">{authPromptWarning}</p>
          <button onClick={() => setAuthPromptWarning(null)} className="text-amber-400 hover:text-amber-300 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <form onSubmit={handleGenerate} className="w-full max-w-3xl">
        <div className="relative bg-bg-secondary/80 backdrop-blur-xl border border-border-primary rounded-2xl shadow-2xl shadow-black/30 overflow-hidden focus-within:border-border-secondary transition-colors w-full">
          <textarea ref={textareaRef} value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (prompt.trim()) handleGenerate(e as any); }}} rows={1} className="w-full px-4 pt-4 pb-14 bg-transparent text-text-primary focus:outline-none resize-none text-base relative z-[1]" style={{ minHeight: "52px", maxHeight: "150px" }} placeholder="Describe your app..." />

          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2.5 bg-bg-secondary/50 z-[2]">
            <div className="flex items-center gap-1">
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleFileUpload} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-text-muted hover:text-text-secondary hover:bg-bg-tertiary rounded-lg transition" title="Attach files">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              </button>
              <button type="button" onClick={() => (isRecording ? stopRecording() : startRecording())} className={`p-2 rounded-lg transition ${isRecording ? "text-red-500 bg-red-500/10 hover:text-red-400 hover:bg-red-500/20 animate-pulse" : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary"}`} title={isRecording ? "Stop recording" : "Voice input"}>
                {isRecording ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg> : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>}
              </button>
              <div className="w-px h-5 bg-border-secondary mx-0.5" />
              <button type="button" onClick={() => setShowAuthModal(true)} className={`p-2 rounded-lg transition ${currentAppAuth.length > 0 ? "text-blue-400 bg-blue-500/10 hover:bg-blue-500/20" : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary"}`} title={currentAppAuth.length > 0 ? `Auth: ${currentAppAuth.map((a) => (a === "username-password" ? "Username/Password" : "Google OAuth")).join(" + ")}` : "Add authentication"}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </button>
              <button type="button" onClick={() => setShowDbModal(true)} className="p-2 text-text-muted hover:text-text-secondary hover:bg-bg-tertiary rounded-lg transition" title="Database options">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
              </button>
            </div>
            <button type="submit" disabled={!prompt.trim() || checkingAuthIntent} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {checkingAuthIntent ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
              {checkingAuthIntent ? "Checking..." : "Generate"}
            </button>
          </div>
        </div>
      </form>

      {currentAppAuth.length > 0 && (
        <div className="flex items-center justify-center gap-2 mt-2.5 flex-wrap max-w-2xl">
          {currentAppAuth.map((auth) => (
            <div key={auth} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span className="text-xs text-blue-300 font-medium">{auth === "username-password" ? "Username/Password" : "Google OAuth"}</span>
              <span className="text-xs text-violet-400">(30 tokens)</span>
              <button type="button" onClick={() => setCurrentAppAuth(currentAppAuth.filter((a) => a !== auth))} className="ml-0.5 text-text-tertiary hover:text-text-primary transition">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
