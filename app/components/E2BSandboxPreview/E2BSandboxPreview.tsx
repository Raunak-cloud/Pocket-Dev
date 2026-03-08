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
  onExpired?: () => void;
}

const SANDBOX_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const EXPIRY_WARNING_MS = 5 * 60 * 1000;   // warn at 5 min remaining

const SESSION_EXPIRED_MESSAGE =
  "Sandbox session expired. Please refresh to start a new session.";

const isSessionExpiredError = (message: string): boolean =>
  /expired|not found|does not exist|invalid sandbox|could not reconnect|terminated|failed to connect/i.test(
    message,
  );

const isCapacityError = (message: string): boolean =>
  /all sandbox slots|high traffic|try again in a few minutes|rate.?limit|quota|capacity|too many/i.test(message);

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
  onExpired,
}: E2BSandboxPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [loadingState, setLoadingState] = useState<
    "connecting" | "installing" | "starting" | "ready" | "error"
  >("connecting");
  const [error, setError] = useState<string | null>(null);
  const [isExpiredError, setIsExpiredError] = useState(false);
  const [isCapacity, setIsCapacity] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const sandboxStartedAtRef = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const prevFilesRef = useRef<Record<string, string> | null>(null);
  const latestProjectRef = useRef<ReactProject | null>(project);
  const sandboxIdRef = useRef(sandboxId);
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

    const startSandbox = async (
      id: string | null,
      files: Record<string, string>,
    ) => {
      const response = await fetch("/api/sandbox/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId: id, files }),
        signal: abortController.signal,
      });

      if (abortController.signal.aborted) return null;

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = data.error || `Sandbox start failed (${response.status})`;
        if (response.status === 410 || isSessionExpiredError(message)) {
          throw new Error(SESSION_EXPIRED_MESSAGE);
        }
        throw new Error(message);
      }

      return response.json();
    };

    const init = async () => {
      try {
        setLoadingState("connecting");
        setError(null);
        setIsExpiredError(false);
        setIsCapacity(false);
        setSecondsLeft(null);
        setPreviewUrl(null);
        sandboxStartedAtRef.current = null;

        const files = prepareSandboxFiles(currentProject);

        setLoadingState("installing");

        const result = await startSandbox(sandboxId, files);

        if (!result || abortController.signal.aborted) return;

        const { previewUrl: url, sandboxId: activeSandboxId } = result;

        // Update the ref to the actual sandbox ID (may differ if a fresh one was created)
        if (activeSandboxId) {
          sandboxIdRef.current = activeSandboxId;
        }

        prevFilesRef.current = files;
        sandboxStartedAtRef.current = Date.now();

        // Server-side polling already ensures dev server is up before responding
        setPreviewUrl(url);
        setLoadingState("ready");
      } catch (err) {
        if (abortController.signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Failed to start cloud sandbox";
        setLoadingState("error");
        setError(msg);
        setIsExpiredError(isSessionExpiredError(msg));
        setIsCapacity(isCapacityError(msg));
      }
    };

    init();

    return () => {
      abortController.abort();
    };
  }, [previewKey, sandboxId]);

  // Effect: Kill sandbox on unmount or page unload
  useEffect(() => {
    const killSandbox = () => {
      const id = sandboxIdRef.current;
      if (!id) return;
      // sendBeacon is guaranteed to fire even during tab close / refresh.
      // Falls back to fetch for environments that don't support it.
      const body = JSON.stringify({ sandboxId: id });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/sandbox/kill",
          new Blob([body], { type: "application/json" }),
        );
      } else {
        fetch("/api/sandbox/kill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", killSandbox);
    return () => {
      window.removeEventListener("beforeunload", killSandbox);
      killSandbox();
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

  // Effect: Countdown timer — warns at 5 min remaining, auto-marks expired at 0
  useEffect(() => {
    if (loadingState !== "ready") return;

    const interval = setInterval(() => {
      const startedAt = sandboxStartedAtRef.current;
      if (!startedAt) return;
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, SANDBOX_TIMEOUT_MS - elapsed);
      const secs = Math.floor(remaining / 1000);

      if (remaining <= EXPIRY_WARNING_MS) {
        setSecondsLeft(secs);
      }

      if (remaining === 0) {
        clearInterval(interval);
        setLoadingState("error");
        setError(SESSION_EXPIRED_MESSAGE);
        setIsExpiredError(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [loadingState]);

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

        const response = await fetch("/api/sandbox/write-files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sandboxId: sandboxIdRef.current,
            files: filesToWrite,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          const message =
            data.error || `Failed to sync files (${response.status})`;
          if (response.status === 410 || isSessionExpiredError(message)) {
            setLoadingState("error");
            setError(SESSION_EXPIRED_MESSAGE);
            setIsExpiredError(true);
            return;
          }
          throw new Error(message);
        }

        prevFilesRef.current = newFiles;
      } catch (err) {
        console.error("[E2B Preview] Error updating files:", err);
        const message = err instanceof Error ? err.message : String(err);
        if (isSessionExpiredError(message)) {
          setLoadingState("error");
          setError(SESSION_EXPIRED_MESSAGE);
          setIsExpiredError(true);
        }
      } finally {
        onSyncStateChange?.(false);
      }
    };

    update();
  }, [project, loadingState, onSyncStateChange]);

  return (
    <div className="flex flex-col h-full isolate" style={{ colorScheme: "normal" }}>
      <style>{`@keyframes pocket-mode-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}`}</style>

      {/* Mode Banner — renders above the iframe, never blocks preview content */}
      {(imageSelectMode || textEditMode || linkSelectMode) && loadingState === "ready" && (
        <div
          className="flex items-center gap-3 px-4 py-2 text-white text-sm shrink-0 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            backgroundImage: imageSelectMode
              ? "linear-gradient(90deg,#c2410c 0%,#f97316 30%,#fb923c 50%,#f97316 70%,#c2410c 100%)"
              : textEditMode
                ? "linear-gradient(90deg,#1d4ed8 0%,#3b82f6 30%,#60a5fa 50%,#3b82f6 70%,#1d4ed8 100%)"
                : "linear-gradient(90deg,#0e7490 0%,#06b6d4 30%,#22d3ee 50%,#06b6d4 70%,#0e7490 100%)",
            backgroundSize: "200% 100%",
            animation: "pocket-mode-shimmer 2.5s linear infinite",
          }}
        >
          <div className="h-2 w-2 rounded-full bg-white animate-ping shrink-0" />
          <span className="font-semibold shrink-0">
            {imageSelectMode ? "Image Selection Mode" : textEditMode ? "Text Edit Mode" : "Link Selection Mode"}
          </span>
          <span className="text-white/80 text-xs truncate">
            {imageSelectMode
              ? "Click any image in the preview to select it for replacement"
              : textEditMode
                ? "Click any text to edit it directly"
                : "Click a button or link in the preview to assign a URL"}
          </span>
        </div>
      )}

      {/* Preview area — fills remaining height */}
      <div className="relative flex-1 min-h-0">

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

      {/* Expiry countdown warning banner */}
      {loadingState === "ready" && secondsLeft !== null && secondsLeft > 0 && (
        <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
          <div className={`mx-4 mt-3 px-4 py-2.5 rounded-xl border flex items-center gap-3 shadow-lg pointer-events-auto ${
            secondsLeft <= 60
              ? "bg-red-50 border-red-300 dark:bg-red-500/10 dark:border-red-500/30"
              : "bg-amber-50 border-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30"
          }`}>
            <svg className={`w-4 h-4 shrink-0 ${secondsLeft <= 60 ? "text-red-500 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className={`text-xs font-medium flex-1 ${secondsLeft <= 60 ? "text-red-700 dark:text-red-300" : "text-amber-800 dark:text-amber-300"}`}>
              Preview session expires in{" "}
              <span className="font-bold tabular-nums">
                {secondsLeft >= 60
                  ? `${Math.floor(secondsLeft / 60)}m ${secondsLeft % 60}s`
                  : `${secondsLeft}s`}
              </span>
            </p>
            <button
              onClick={onExpired}
              className={`text-xs font-semibold px-3 py-1 rounded-lg transition shrink-0 ${
                secondsLeft <= 60
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-amber-500 hover:bg-amber-600 text-white"
              }`}
            >
              Restart now
            </button>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {loadingState === "error" && (
        <div className="absolute inset-0 bg-bg-secondary z-10 flex items-center justify-center p-4">
          <div className="text-center max-w-sm">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isExpiredError ? "bg-amber-500/10" : isCapacity ? "bg-orange-500/10" : "bg-red-500/10"}`}>
              {isExpiredError ? (
                <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : isCapacity ? (
                <svg className="w-8 h-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              {isExpiredError ? "Preview Session Expired" : isCapacity ? "Sandboxes Busy" : "Cloud Preview Failed"}
            </h3>
            <p className="text-sm text-text-tertiary mb-5">
              {isExpiredError
                ? "Your 30-minute preview session has ended. Restart to spin up a fresh sandbox with your current project."
                : isCapacity
                ? "All cloud preview slots are currently in use due to high traffic. Please wait a moment and try again."
                : (error || "There was an issue connecting to the cloud sandbox. Try refreshing the page.")}
            </p>
            {isExpiredError && onExpired && (
              <button
                onClick={onExpired}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-medium rounded-xl transition shadow-lg shadow-blue-500/20"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Restart Preview
              </button>
            )}
            {isCapacity && onExpired && (
              <button
                onClick={onExpired}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white text-sm font-medium rounded-xl transition shadow-lg shadow-orange-500/20"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Try Again
              </button>
            )}
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
      </div>{/* end preview area */}
    </div>
  );
}
