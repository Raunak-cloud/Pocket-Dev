"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { prepareSandboxFiles, computeFileDiff } from "@/lib/sandbox-utils";
import type { ReactProject } from "@/app/types";

interface E2BSandboxPreviewProps {
  project: ReactProject | null;
  sandboxId: string;
  previewKey: number;
  textEditMode?: boolean;
  imageSelectMode?: boolean;
  linkSelectMode?: boolean;
  onTextEdited?: (
    originalText: string,
    updatedText: string,
    occurrence?: number,
  ) => void;
  onImageSelected?: (payload: {
    src: string;
    resolvedSrc?: string;
    alt: string;
    occurrence: number;
  }) => void;
  onButtonSelected?: (payload: {
    name: string;
    occurrence: number;
    tag: string;
  }) => void;
  onSyncStateChange?: (isSyncing: boolean) => void;
}

export default function E2BSandboxPreview({
  project,
  sandboxId,
  previewKey,
  textEditMode = false,
  imageSelectMode = false,
  linkSelectMode = false,
  onTextEdited,
  onImageSelected,
  onButtonSelected,
  onSyncStateChange,
}: E2BSandboxPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [loadingState, setLoadingState] = useState<
    "connecting" | "installing" | "starting" | "ready" | "error"
  >("connecting");
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const prevFilesRef = useRef<Record<string, string> | null>(null);
  const latestProjectRef = useRef<ReactProject | null>(project);
  const sandboxIdRef = useRef(sandboxId);
  const keepaliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bridgeReadyRef = useRef(false);

  useEffect(() => {
    latestProjectRef.current = project;
  }, [project]);

  useEffect(() => {
    sandboxIdRef.current = sandboxId;
  }, [sandboxId]);

  // Effect 1: Connect to sandbox and start dev server
  useEffect(() => {
    const currentProject = latestProjectRef.current;
    if (!currentProject) return;

    const abortController = new AbortController();

    const startSandbox = async (id: string | null, files: Record<string, string>) => {
      const response = await fetch("/api/sandbox/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId: id, files }),
        signal: abortController.signal,
      });

      if (abortController.signal.aborted) return null;

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Sandbox start failed (${response.status})`);
      }

      return response.json();
    };

    const init = async () => {
      try {
        setLoadingState("connecting");
        setError(null);
        setPreviewUrl(null);

        const files = prepareSandboxFiles(currentProject);

        setLoadingState("installing");

        let result;
        try {
          result = await startSandbox(sandboxId, files);
        } catch (firstErr) {
          // If the original sandbox expired, retry with a fresh one
          if (sandboxId && sandboxId !== "create-new") {
            console.warn("[E2B Preview] First attempt failed, retrying with fresh sandbox:", firstErr);
            result = await startSandbox("create-new", files);
          } else {
            throw firstErr;
          }
        }

        if (!result || abortController.signal.aborted) return;

        const { previewUrl: url, sandboxId: activeSandboxId } = result;

        // Update the ref to the actual sandbox ID (may differ if a fresh one was created)
        if (activeSandboxId) {
          sandboxIdRef.current = activeSandboxId;
        }

        prevFilesRef.current = files;

        // Server-side polling already ensures dev server is up before responding
        setPreviewUrl(url);
        setLoadingState("ready");
      } catch (err) {
        if (abortController.signal.aborted) return;
        setLoadingState("error");
        setError(
          err instanceof Error ? err.message : "Failed to start cloud sandbox",
        );
      }
    };

    init();

    return () => {
      abortController.abort();
    };
  }, [previewKey, sandboxId]);

  // Effect: Keepalive every 2 minutes
  useEffect(() => {
    if (loadingState !== "ready") return;

    keepaliveRef.current = setInterval(async () => {
      try {
        await fetch("/api/sandbox/keepalive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sandboxId: sandboxIdRef.current }),
        });
      } catch {
        console.warn("[E2B Preview] Keepalive failed");
      }
    }, 2 * 60 * 1000);

    return () => {
      if (keepaliveRef.current) {
        clearInterval(keepaliveRef.current);
        keepaliveRef.current = null;
      }
    };
  }, [loadingState]);

  // Effect: Kill sandbox on unmount
  useEffect(() => {
    return () => {
      const id = sandboxIdRef.current;
      if (id) {
        fetch("/api/sandbox/kill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sandboxId: id }),
        }).catch(() => {});
      }
    };
  }, [sandboxId]);

  // Effect: Forward text edit mode to iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: "pocket:set-text-edit-mode", enabled: textEditMode },
      "*",
    );
  }, [textEditMode, previewUrl]);

  // Effect: Forward image select mode to iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: "pocket:set-image-select-mode", enabled: imageSelectMode },
      "*",
    );
  }, [imageSelectMode, previewUrl]);

  // Effect: Forward link select mode to iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: "pocket:set-link-select-mode", enabled: linkSelectMode },
      "*",
    );
  }, [linkSelectMode, previewUrl]);

  // Effect: Listen for postMessage from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "pocket:bridge-ready") {
        bridgeReadyRef.current = true;
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) return;
        iframe.contentWindow.postMessage(
          { type: "pocket:set-text-edit-mode", enabled: textEditMode },
          "*",
        );
        iframe.contentWindow.postMessage(
          { type: "pocket:set-image-select-mode", enabled: imageSelectMode },
          "*",
        );
        iframe.contentWindow.postMessage(
          { type: "pocket:set-link-select-mode", enabled: linkSelectMode },
          "*",
        );
        return;
      }

      if (
        data.type === "pocket:text-edited" &&
        typeof data.originalText === "string" &&
        typeof data.updatedText === "string"
      ) {
        onTextEdited?.(
          data.originalText,
          data.updatedText,
          typeof data.occurrence === "number" && data.occurrence > 0
            ? data.occurrence
            : 1,
        );
      }
      if (
        data.type === "pocket:image-selected" &&
        typeof data.src === "string"
      ) {
        onImageSelected?.({
          src: data.src,
          resolvedSrc:
            typeof data.resolvedSrc === "string" ? data.resolvedSrc : undefined,
          alt: typeof data.alt === "string" ? data.alt : "",
          occurrence:
            typeof data.occurrence === "number" && data.occurrence > 0
              ? data.occurrence
              : 1,
        });
      }
      if (
        data.type === "pocket:button-selected" &&
        typeof data.name === "string"
      ) {
        onButtonSelected?.({
          name: data.name,
          occurrence:
            typeof data.occurrence === "number" && data.occurrence > 0
              ? data.occurrence
              : 1,
          tag:
            typeof data.tag === "string" && data.tag.trim()
              ? data.tag
              : "button",
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    onTextEdited,
    onImageSelected,
    onButtonSelected,
    textEditMode,
    imageSelectMode,
    linkSelectMode,
  ]);

  // Effect: Retry iframe if it fails to load (E2B proxy may 502 initially)
  useEffect(() => {
    if (loadingState !== "ready" || !previewUrl) return;

    bridgeReadyRef.current = false;
    const maxRetries = 8;
    let retryCount = 0;

    const retryInterval = setInterval(() => {
      if (bridgeReadyRef.current || retryCount >= maxRetries) {
        clearInterval(retryInterval);
        return;
      }
      retryCount++;
      console.log(`[E2B Preview] No bridge-ready received, retrying iframe (${retryCount}/${maxRetries})...`);
      setIframeKey((prev) => prev + 1);
    }, 6000);

    return () => clearInterval(retryInterval);
  }, [loadingState, previewUrl]);

  // Effect: Update files when project changes (HMR-style sync)
  useEffect(() => {
    if (!prevFilesRef.current || !project) return;
    if (loadingState !== "ready") return;

    const update = async () => {
      try {
        const newFiles = prepareSandboxFiles(project);
        const { toWrite } = computeFileDiff(
          prevFilesRef.current || {},
          newFiles,
        );

        if (toWrite.length === 0) return;

        onSyncStateChange?.(true);

        const filesToWrite = toWrite.map(({ path, data }) => ({
          path,
          content: data,
        }));

        await fetch("/api/sandbox/write-files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sandboxId: sandboxIdRef.current,
            files: filesToWrite,
          }),
        });

        prevFilesRef.current = newFiles;
      } catch (err) {
        console.error("[E2B Preview] Error updating files:", err);
      } finally {
        onSyncStateChange?.(false);
      }
    };

    update();
  }, [project, loadingState, onSyncStateChange]);

  return (
    <div className="relative h-full isolate" style={{ colorScheme: "normal" }}>
      {/* Image Selection Mode Indicator */}
      {imageSelectMode && loadingState === "ready" && (
        <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="mx-auto max-w-md mt-4">
            <div className="pointer-events-auto bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg shadow-2xl border border-orange-400/50 backdrop-blur-sm">
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Image Selection Mode</p>
                  <p className="text-xs text-white/90 mt-0.5">
                    Click any image in the preview to select it for replacement
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="h-2 w-2 rounded-full bg-white animate-ping" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Text Edit Mode Indicator */}
      {textEditMode && !imageSelectMode && loadingState === "ready" && (
        <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="mx-auto max-w-md mt-4">
            <div className="pointer-events-auto bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-2xl border border-blue-400/50 backdrop-blur-sm">
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Text Edit Mode</p>
                  <p className="text-xs text-white/90 mt-0.5">
                    Click any text to edit it directly
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="h-2 w-2 rounded-full bg-white animate-ping" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link Selection Mode Indicator */}
      {linkSelectMode &&
        !textEditMode &&
        !imageSelectMode &&
        loadingState === "ready" && (
          <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="mx-auto max-w-md mt-4">
              <div className="pointer-events-auto bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg shadow-2xl border border-cyan-400/50 backdrop-blur-sm">
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
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
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">Link Selection Mode</p>
                    <p className="text-xs text-white/90 mt-0.5">
                      Click a button or link in preview to assign a URL
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-white animate-ping" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
              {loadingState === "connecting" && "Connecting to cloud sandbox..."}
              {loadingState === "installing" && "Installing dependencies..."}
              {loadingState === "starting" && "Starting dev server..."}
            </p>
            <p className="text-xs text-text-muted">
              {loadingState === "connecting" &&
                "Reconnecting to your E2B sandbox"}
              {loadingState === "installing" &&
                "Installing packages and starting the server"}
              {loadingState === "starting" &&
                "Waiting for Next.js to start"}
            </p>
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
              Cloud Preview Failed
            </h3>
            <p className="text-sm text-text-tertiary mb-4">
              {error ||
                "There was an issue connecting to the cloud sandbox. Try refreshing the page or regenerating the project."}
            </p>
          </div>
        </div>
      )}

      {/* Iframe preview — credentialless allows loading under parent COEP header */}
      {previewUrl && (
        <iframe
          key={`e2b-preview:${iframeKey}`}
          ref={iframeRef}
          src={previewUrl}
          className="w-full h-full border-0"
          style={{ colorScheme: "normal", backgroundColor: "transparent" }}
          title="Next.js Preview (Cloud)"
          // @ts-expect-error -- credentialless is a valid HTML attribute (Chrome 110+) but not in React's types
          credentialless=""
        />
      )}
    </div>
  );
}
