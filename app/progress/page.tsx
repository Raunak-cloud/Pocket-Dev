"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GenerationProgress from "@/app/components/GenerationProgress";
import { useAuth } from "@/app/contexts/AuthContext";
import { waitForInngestCompletion } from "@/lib/inngest-helpers";

type ActiveGenerationSession = {
  mode: "generation" | "edit";
  runId: string;
  prompt: string;
  userId: string;
  backendEnabled: boolean;
  paymentsEnabled: boolean;
  startedAt: number;
  projectId?: string | null;
};

const ACTIVE_GENERATION_STORAGE_KEY = "__pocketActiveGeneration";
const ACTIVE_GENERATION_VIEW_PREFERENCE_KEY = "__pocketActiveGenerationView";

type ActiveGenerationViewPreference = {
  runId: string;
  minimized: boolean;
  updatedAt: number;
};

const parseActiveGenerationSession = (
  raw: string | null,
): ActiveGenerationSession | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ActiveGenerationSession>;
    if (
      typeof parsed.runId !== "string" ||
      !parsed.runId.trim() ||
      typeof parsed.prompt !== "string" ||
      typeof parsed.userId !== "string" ||
      !parsed.userId.trim()
    ) {
      return null;
    }
    return {
      mode: parsed.mode === "edit" ? "edit" : "generation",
      runId: parsed.runId.trim(),
      prompt: parsed.prompt,
      userId: parsed.userId.trim(),
      backendEnabled: parsed.backendEnabled === true,
      paymentsEnabled: parsed.paymentsEnabled === true,
      startedAt:
        typeof parsed.startedAt === "number" && Number.isFinite(parsed.startedAt)
          ? parsed.startedAt
          : Date.now(),
      projectId:
        typeof parsed.projectId === "string" && parsed.projectId.trim()
          ? parsed.projectId.trim()
          : null,
    };
  } catch {
    return null;
  }
};

const parseActiveGenerationViewPreference = (
  raw: string | null,
): ActiveGenerationViewPreference | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ActiveGenerationViewPreference>;
    if (typeof parsed.runId !== "string" || !parsed.runId.trim()) {
      return null;
    }
    return {
      runId: parsed.runId.trim(),
      minimized: parsed.minimized === true,
      updatedAt:
        typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt)
          ? parsed.updatedAt
          : Date.now(),
    };
  } catch {
    return null;
  }
};

export default function ProgressPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [session, setSession] = useState<ActiveGenerationSession | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const persistViewPreference = useCallback(
    (preference: ActiveGenerationViewPreference) => {
      if (typeof window === "undefined") return;
      localStorage.setItem(
        ACTIVE_GENERATION_VIEW_PREFERENCE_KEY,
        JSON.stringify(preference),
      );
    },
    [],
  );

  const setRunMinimizedPreference = useCallback(
    (runId: string, minimized: boolean) => {
      const safeRunId = runId.trim();
      if (!safeRunId) return;
      persistViewPreference({
        runId: safeRunId,
        minimized,
        updatedAt: Date.now(),
      });
    },
    [persistViewPreference],
  );

  const clearLocalSession = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACTIVE_GENERATION_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_GENERATION_VIEW_PREFERENCE_KEY);
  }, []);

  const readViewPreference = useCallback(() => {
    if (typeof window === "undefined") return null;
    return parseActiveGenerationViewPreference(
      localStorage.getItem(ACTIVE_GENERATION_VIEW_PREFERENCE_KEY),
    );
  }, []);

  const readLocalSession = useCallback(() => {
    if (typeof window === "undefined") return null;
    return parseActiveGenerationSession(
      localStorage.getItem(ACTIVE_GENERATION_STORAGE_KEY),
    );
  }, []);

  const fetchServerSession = useCallback(async () => {
    const res = await fetch("/api/inngest/active-run", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      activeRun?: ActiveGenerationSession | null;
    };
    const activeRun = data.activeRun;
    if (!activeRun) return null;
    return {
      ...activeRun,
      mode: activeRun.mode === "edit" ? "edit" : "generation",
      runId: String(activeRun.runId || "").trim(),
      prompt: String(activeRun.prompt || ""),
      userId: String(activeRun.userId || "").trim(),
      backendEnabled: activeRun.backendEnabled === true,
      paymentsEnabled: activeRun.paymentsEnabled === true,
      startedAt:
        typeof activeRun.startedAt === "number" &&
        Number.isFinite(activeRun.startedAt)
          ? activeRun.startedAt
          : Date.now(),
      projectId:
        typeof activeRun.projectId === "string" && activeRun.projectId.trim()
          ? activeRun.projectId.trim()
          : null,
    } as ActiveGenerationSession;
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      clearLocalSession();
      router.replace("/");
      return;
    }

    let cancelled = false;

    const loadSession = async () => {
      const serverSession = await fetchServerSession().catch(() => null);
      if (cancelled) return;

      const localSession = readLocalSession();
      const candidate =
        serverSession ??
        (localSession && localSession.userId === user.uid ? localSession : null);

      if (!candidate) {
        clearLocalSession();
        router.replace("/");
        return;
      }

      if (candidate.userId !== user.uid) {
        clearLocalSession();
        router.replace("/");
        return;
      }

      setSession(candidate);
      const existingPreference = readViewPreference();
      if (
        !existingPreference ||
        existingPreference.runId !== candidate.runId ||
        existingPreference.minimized
      ) {
        setRunMinimizedPreference(candidate.runId, false);
      }
      if (serverSession) {
        localStorage.setItem(
          ACTIVE_GENERATION_STORAGE_KEY,
          JSON.stringify(serverSession),
        );
      }
      setMessages([
        candidate.mode === "edit"
          ? "Resuming edit in background..."
          : "Resuming generation in background...",
      ]);
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    clearLocalSession,
    fetchServerSession,
    readLocalSession,
    readViewPreference,
    router,
    setRunMinimizedPreference,
    user,
  ]);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    const run = async () => {
      try {
        await waitForInngestCompletion(session.runId, "generate.completed", (msg) => {
          if (cancelled) return;
          setMessages((prev) => [...prev, msg]);
        });
        if (cancelled) return;
        const completionVisibility =
          typeof document !== "undefined" &&
          (document.visibilityState === "visible" || document.hasFocus())
            ? "visible"
            : "hidden";
        const target = `/?completed_run=${encodeURIComponent(session.runId)}&completed_mode=${encodeURIComponent(session.mode)}&completion_visibility=${completionVisibility}`;
        router.replace(target);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message || "Generation failed");
        clearLocalSession();
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [clearLocalSession, router, session]);

  const promptText = useMemo(() => {
    if (!session) return "Preparing your run...";
    return session.mode === "edit" ? `Editing: ${session.prompt}` : session.prompt;
  }, [session]);

  const cancelRun = useCallback(async () => {
    if (!session) return;
    await fetch("/api/inngest/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: session.runId, reason: "manual" }),
    }).catch(() => {});
    clearLocalSession();
    router.replace("/");
  }, [clearLocalSession, router, session]);

  const requestCancelRun = useCallback(() => {
    setShowCancelConfirm(true);
  }, []);

  const confirmAndCancelRun = useCallback(async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await cancelRun();
    } finally {
      setIsCancelling(false);
      setShowCancelConfirm(false);
    }
  }, [cancelRun, isCancelling]);

  const minimizeToBackground = useCallback(() => {
    if (!session) return;
    setRunMinimizedPreference(session.runId, true);
    router.replace("/");
  }, [router, session, setRunMinimizedPreference]);

  if (error) {
    return (
      <div className="h-[100dvh] w-screen bg-bg-primary text-text-primary flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-border-secondary bg-bg-secondary p-6">
          <h1 className="text-xl font-semibold">Run Failed</h1>
          <p className="mt-3 text-sm text-text-secondary">{error}</p>
          <button
            onClick={() => router.replace("/")}
            className="mt-5 inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Back to Editor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-screen bg-bg-primary text-text-primary overflow-hidden">
      <div className="h-full w-full">
        <GenerationProgress
          prompt={promptText}
          progressMessages={messages}
          onCancel={requestCancelRun}
          onToggleMinimize={minimizeToBackground}
          isMinimized={false}
        />
      </div>

      {showCancelConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border-secondary bg-bg-secondary shadow-2xl">
            <div className="px-6 pt-7 pb-4 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15">
                <svg
                  className="h-7 w-7 text-red-400"
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
              </div>
              <h2 className="text-xl font-semibold text-text-primary">
                {session?.mode === "edit" ? "Cancel Edit Run?" : "Cancel Generation Run?"}
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                This will stop the current run immediately and discard in-progress output.
              </p>
              <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                <p className="text-xs font-medium text-amber-300">
                  Tokens used for this run won&apos;t be refunded.
                </p>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={isCancelling}
                className="flex-1 rounded-xl bg-bg-tertiary px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-border-secondary disabled:opacity-60"
              >
                Continue Run
              </button>
              <button
                onClick={() => {
                  void confirmAndCancelRun();
                }}
                disabled={isCancelling}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-60"
              >
                {isCancelling ? "Cancelling..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
