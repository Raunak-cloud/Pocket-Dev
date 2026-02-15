"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  createSandboxServer,
  updateSandboxFiles,
  closeSandbox,
  keepAliveSandbox,
  ensureSandboxHealthy,
} from "@/app/sandbox-actions";
import {
  prepareE2BFiles,
  computeFileDiff,
  hasAuthentication,
} from "@/lib/e2b-utils";
import type { ReactProject } from "@/app/types";

interface E2BPreviewProps {
  project: ReactProject | null;
  previewKey: number;
  projectId?: string | null;
  textEditMode?: boolean;
  onTextEdited?: (originalText: string, updatedText: string) => void;
  onSyncStateChange?: (isSyncing: boolean) => void;
}

export default function E2BPreview({
  project,
  previewKey,
  projectId = null,
  textEditMode = false,
  onTextEdited,
  onSyncStateChange,
}: E2BPreviewProps) {
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [startupId, setStartupId] = useState<string | null>(null);
  const [startupLogs, setStartupLogs] = useState<string[]>([]);
  const [loadingState, setLoadingState] = useState<
    "creating" | "installing" | "starting" | "ready" | "error"
  >("creating");
  const [error, setError] = useState<string | null>(null);
  const prevFilesRef = useRef<Record<string, string> | null>(null);
  const latestProjectRef = useRef<ReactProject | null>(project);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const recoveringRef = useRef(false);
  const hasAuthPreviewHint = project ? hasAuthentication(project) : false;

  useEffect(() => {
    latestProjectRef.current = project;
  }, [project]);

  const startSandbox = useCallback(
    async (opts?: { previousSandboxId?: string | null }) => {
      const currentProject = latestProjectRef.current;
      if (!currentProject) return null;

      let phaseTimer: NodeJS.Timeout | null = null;
      try {
        setLoadingState("creating");
        setError(null);
        setStartupLogs([]);
        const files = prepareE2BFiles(currentProject);
        const newStartupId = `sbx_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 9)}`;
        setStartupId(newStartupId);

        setLoadingState("installing");
        phaseTimer = setTimeout(() => {
          setLoadingState("starting");
        }, 90_000);

        const sandboxPromise = createSandboxServer(files, newStartupId, {
          projectId: projectId || undefined,
        });
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                "Sandbox startup is taking too long (over 15 minutes). Please retry."
              )
            );
          }, 15 * 60 * 1000);
        });

        const { sandboxId: nextSandboxId, url } = await Promise.race([
          sandboxPromise,
          timeoutPromise,
        ]);

        if (phaseTimer) clearTimeout(phaseTimer);

        setSandboxId(nextSandboxId);
        setPreviewUrl(url);
        prevFilesRef.current = files;
        setLoadingState("ready");

        if (
          opts?.previousSandboxId &&
          opts.previousSandboxId !== nextSandboxId
        ) {
          closeSandbox(opts.previousSandboxId);
        }

        return { sandboxId: nextSandboxId, url };
      } catch (err) {
        if (phaseTimer) clearTimeout(phaseTimer);
        setLoadingState("error");
        setError(
          err instanceof Error ? err.message : "Failed to create sandbox",
        );
        return null;
      }
    },
    [projectId],
  );

  // Effect 1: Create sandbox
  useEffect(() => {
    if (!latestProjectRef.current) return;

    let mounted = true;
    let currentSandboxId: string | null = null;

    const init = async () => {
      const started = await startSandbox();
      if (!started) return;
      currentSandboxId = started.sandboxId;

      if (!mounted) {
        await closeSandbox(started.sandboxId);
      }
    };

    init();

    return () => {
      mounted = false;
      if (currentSandboxId) {
        closeSandbox(currentSandboxId);
      }
    };
  }, [previewKey, startSandbox]);

  // Effect 1b: Poll live startup logs/status.
  useEffect(() => {
    if (!startupId || loadingState === "ready" || loadingState === "error") {
      return;
    }

    let stopped = false;

    const poll = async () => {
      try {
        const response = await fetch(`/api/sandbox-status?id=${startupId}`, {
          cache: "no-store",
        });
        if (!response.ok) return;

        const data = await response.json();
        if (stopped || data.found !== true) return;

        if (Array.isArray(data.logs)) {
          setStartupLogs(data.logs);
        }

        if (
          data.phase === "creating" ||
          data.phase === "installing" ||
          data.phase === "starting"
        ) {
          setLoadingState(data.phase);
        }

        if (data.phase === "error") {
          setLoadingState("error");
          setError(
            typeof data.error === "string" && data.error
              ? data.error
              : "Failed to start sandbox",
          );
        }
      } catch {
        // Keep polling.
      }
    };

    poll();
    const interval = setInterval(poll, 1200);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [startupId, loadingState]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: "pocket:set-text-edit-mode", enabled: textEditMode },
      "*"
    );
  }, [textEditMode, previewUrl]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (
        data.type === "pocket:text-edited" &&
        typeof data.originalText === "string" &&
        typeof data.updatedText === "string"
      ) {
        onTextEdited?.(data.originalText, data.updatedText);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onTextEdited]);

  // Effect 2: Update files
  useEffect(() => {
    if (!sandboxId || !prevFilesRef.current || !project) return;

    const update = async () => {
      try {
        const newFiles = prepareE2BFiles(project);
        const { toWrite, toDelete } = computeFileDiff(
          prevFilesRef.current || {},
          newFiles,
        );

        if (toWrite.length > 0 || toDelete.length > 0) {
          onSyncStateChange?.(true);
          await updateSandboxFiles(sandboxId, toWrite, toDelete);
          prevFilesRef.current = newFiles;
        }
      } catch (err) {
        console.error("Error updating sandbox files:", err);
      } finally {
        onSyncStateChange?.(false);
      }
    };

    update();
  }, [project, sandboxId, onSyncStateChange]);

  // Effect 3: Keep sandbox alive while user is on the preview
  useEffect(() => {
    if (!sandboxId || !project) return;

    const interval = setInterval(async () => {
      if (recoveringRef.current) return;
      recoveringRef.current = true;
      try {
        await keepAliveSandbox(sandboxId);
        const health = await ensureSandboxHealthy(sandboxId, {
          projectId: projectId || undefined,
        });

        if (health.ok) {
          if (health.url && health.url !== previewUrl) {
            setPreviewUrl(health.url);
          }
          if (health.restarted) {
            setLoadingState("ready");
          }
          return;
        }

        const restarted = await startSandbox({
          previousSandboxId: sandboxId,
        });
        if (!restarted) {
          setError(
            "Preview sandbox recovery failed. Please click Preview again.",
          );
          setLoadingState("error");
        }
      } catch (err) {
        console.error("Error during sandbox health check:", err);
      } finally {
        recoveringRef.current = false;
      }
    }, 75 * 1000);

    return () => clearInterval(interval);
  }, [project, sandboxId, previewUrl, startSandbox, projectId]);

  return (
    <div className="relative h-full isolate" style={{ colorScheme: "normal" }}>
      {/* Loading overlay */}
      {loadingState !== "ready" && loadingState !== "error" && (
        <div className="absolute inset-0 bg-bg-secondary z-10 flex items-center justify-center">
          <div className="text-center w-full max-w-2xl px-6">
            <div className="relative w-20 h-20 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 border-r-violet-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full animate-pulse"></div>
              </div>
            </div>
            <p className="text-sm font-medium text-text-secondary mb-1">
              {loadingState === "creating" && "Creating sandbox..."}
              {loadingState === "installing" && "Installing dependencies..."}
              {loadingState === "starting" && "Starting dev server..."}
            </p>
            <p className="text-xs text-text-muted">
              {loadingState === "creating" && "Setting up cloud environment"}
              {loadingState === "installing" && "This can take a few minutes"}
              {loadingState === "starting" && "Waiting for Next.js to start"}
            </p>

            {startupLogs.length > 0 && (
              <div className="mt-5 text-left">
                <p className="text-[11px] uppercase tracking-wide text-text-muted mb-2">
                  Live Logs
                </p>
                <div className="h-44 overflow-y-auto rounded-lg border border-border-secondary bg-bg-tertiary/40 p-3 font-mono text-[11px] leading-5 text-text-secondary">
                  {startupLogs.slice(-80).map((line, idx) => (
                    <div key={`${idx}-${line.slice(0, 20)}`} className="whitespace-pre-wrap break-words">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error overlay */}
      {loadingState === "error" && (
        <div className="absolute inset-0 bg-bg-secondary z-10 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Preview Error
            </h3>
            <p className="text-sm text-text-tertiary mb-4">
              {error ||
                "There was an issue loading the preview. Try refreshing the page or regenerating the project."}
            </p>
          </div>
        </div>
      )}

      {/* Iframe preview */}
      {previewUrl && (
        <iframe
          ref={iframeRef}
          src={previewUrl}
          className="w-full h-full border-0"
          style={{ colorScheme: "normal", backgroundColor: "transparent" }}
          title="Next.js Preview"
        />
      )}

      {/* Auth hint: iframe preview stays available; open tab is optional for OAuth flows */}
      {previewUrl && loadingState === "ready" && hasAuthPreviewHint && (
        <div className="pointer-events-none absolute top-3 right-3 z-20 max-w-sm">
          <div className="pointer-events-auto rounded-xl border border-border-primary bg-bg-secondary/95 backdrop-blur-md p-3 shadow-xl">
            <h3 className="text-sm font-semibold text-text-primary mb-1">
              Auth Testing Tip
            </h3>
            <p className="text-xs text-text-tertiary mb-2 leading-relaxed">
              Preview works here. For Google/OAuth sign-in flows, use a new tab.
            </p>
            <button
              onClick={() =>
                window.open(previewUrl, "_blank", "noopener,noreferrer")
              }
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition"
            >
              Open In New Tab
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

