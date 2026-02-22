"use client";

import { useState, useRef, useEffect } from "react";
import { WebContainer } from "@webcontainer/api";
import {
  prepareSandboxFiles,
  computeFileDiff,
} from "@/lib/sandbox-utils";
import type { ReactProject } from "@/app/types";

type FileTreeEntry = {
  directory?: Record<string, FileTreeEntry>;
  file?: { contents: string };
};

interface WebContainerPreviewProps {
  project: ReactProject | null;
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

/**
 * Convert a flat file map (e.g. {"app/page.tsx": "..."})
 * into the nested tree structure WebContainer expects.
 */
function toFileTree(
  flat: Record<string, string>,
): Record<string, FileTreeEntry> {
  const tree: Record<string, FileTreeEntry> = {};

  for (const [filePath, contents] of Object.entries(flat)) {
    const parts = filePath.split("/");
    let current: Record<string, FileTreeEntry> = tree;

    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i];
      if (!current[dir]) {
        current[dir] = { directory: {} };
      }
      if (!current[dir].directory) {
        current[dir].directory = {};
      }
      current = current[dir].directory as Record<string, FileTreeEntry>;
    }

    const fileName = parts[parts.length - 1];
    current[fileName] = { file: { contents } };
  }

  return tree;
}

// Singleton WebContainer instance (only one per page is allowed)
let wcInstance: WebContainer | null = null;
let wcBootPromise: Promise<WebContainer> | null = null;

async function getWebContainer(): Promise<WebContainer> {
  if (wcInstance) return wcInstance;
  if (wcBootPromise) return wcBootPromise;

  wcBootPromise = WebContainer.boot().then((instance) => {
    wcInstance = instance;
    return instance;
  });

  return wcBootPromise;
}

export default function WebContainerPreview({
  project,
  previewKey,
  textEditMode = false,
  imageSelectMode = false,
  linkSelectMode = false,
  onTextEdited,
  onImageSelected,
  onButtonSelected,
  onSyncStateChange,
}: WebContainerPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [loadingState, setLoadingState] = useState<
    "creating" | "installing" | "starting" | "ready" | "error"
  >("creating");
  const [error, setError] = useState<string | null>(null);
  const [startupLogs, setStartupLogs] = useState<string[]>([]);
  const prevFilesRef = useRef<Record<string, string> | null>(null);
  const latestProjectRef = useRef<ReactProject | null>(project);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<WebContainer | null>(null);
  const serverProcessRef = useRef<{ kill: () => void } | null>(null);

  useEffect(() => {
    latestProjectRef.current = project;
  }, [project]);

  // Effect 1: Boot WebContainer and set up project
  useEffect(() => {
    const currentProject = latestProjectRef.current;
    if (!currentProject) return;

    let mounted = true;

    const init = async () => {
      try {
        setLoadingState("creating");
        setError(null);
        setStartupLogs([]);
        setPreviewUrl(null);

        const addLog = (msg: string) => {
          if (!mounted) return;
          setStartupLogs((prev) => [...prev.slice(-80), msg]);
        };

        addLog("Booting WebContainer...");
        const wc = await getWebContainer();
        containerRef.current = wc;

        if (!mounted) return;
        addLog("WebContainer ready");

        // Prepare and mount files
        const files = prepareSandboxFiles(currentProject);
        const fileTree = toFileTree(files);

        addLog(`Mounting ${Object.keys(files).length} files...`);
        await wc.mount(fileTree);
        prevFilesRef.current = files;

        if (!mounted) return;
        addLog("Files mounted");

        // Install dependencies
        setLoadingState("installing");
        addLog("Installing dependencies (npm install)...");

        const installProcess = await wc.spawn("npm", ["install", "--no-audit", "--no-fund", "--progress=false"]);

        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              if (!mounted) return;
              const lines = data.split("\n").filter((l: string) => l.trim());
              for (const line of lines) {
                addLog(line);
              }
            },
          }),
        ).catch(() => {});

        const installExitCode = await installProcess.exit;

        if (!mounted) return;

        if (installExitCode !== 0) {
          setLoadingState("error");
          setError(`npm install failed with exit code ${installExitCode}`);
          return;
        }
        addLog("Dependencies installed successfully");

        // Start dev server
        setLoadingState("starting");
        addLog("Starting development server...");

        const devProcess = await wc.spawn("npx", ["next", "dev", "--port", "3000"]);
        serverProcessRef.current = devProcess;

        devProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              if (!mounted) return;
              const lines = data.split("\n").filter((l: string) => l.trim());
              for (const line of lines) {
                addLog(line);
              }
            },
          }),
        ).catch(() => {});

        // Listen for server-ready event
        wc.on("server-ready", (_port, url) => {
          if (!mounted) return;
          addLog(`Dev server ready at ${url}`);
          setPreviewUrl(url);
          setPreviewVersion(0);
          setLoadingState("ready");
        });
      } catch (err) {
        if (!mounted) return;
        setLoadingState("error");
        setError(
          err instanceof Error ? err.message : "Failed to start WebContainer",
        );
      }
    };

    init();

    return () => {
      mounted = false;
      // Kill running server process
      if (serverProcessRef.current) {
        try {
          serverProcessRef.current.kill();
        } catch {}
        serverProcessRef.current = null;
      }
    };
  }, [previewKey]);

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

      // When the bridge (re)mounts after HMR or iframe remount, re-send
      // the current text-edit / image-select mode so it stays in sync.
      if (data.type === "pocket:bridge-ready") {
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

  // Effect: Update files when project changes (HMR-style sync)
  useEffect(() => {
    if (!containerRef.current || !prevFilesRef.current || !project) return;
    if (loadingState !== "ready") return;

    const update = async () => {
      const wc = containerRef.current!;
      try {
        const newFiles = prepareSandboxFiles(project);
        const { toWrite, toDelete } = computeFileDiff(
          prevFilesRef.current || {},
          newFiles,
        );

        if (toWrite.length === 0 && toDelete.length === 0) return;

        onSyncStateChange?.(true);

        for (const { path, data } of toWrite) {
          // Ensure parent directory exists
          const dir = path.split("/").slice(0, -1).join("/");
          if (dir) {
            await wc.fs.mkdir(dir, { recursive: true });
          }
          await wc.fs.writeFile(path, data);
        }

        for (const path of toDelete) {
          try {
            await wc.fs.rm(path);
          } catch {
            // File might not exist
          }
        }

        prevFilesRef.current = newFiles;

        // Force preview remount for changes HMR might miss
        setPreviewVersion((prev) => prev + 1);
        setTimeout(() => {
          setPreviewVersion((prev) => prev + 1);
        }, 1800);
      } catch (err) {
        console.error("Error updating WebContainer files:", err);
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
              {loadingState === "creating" && "Starting WebContainer..."}
              {loadingState === "installing" && "Installing dependencies..."}
              {loadingState === "starting" && "Starting dev server..."}
            </p>
            <p className="text-xs text-text-muted">
              {loadingState === "creating" && "Booting in-browser environment"}
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
                    <div
                      key={`${idx}-${line.slice(0, 20)}`}
                      className="whitespace-pre-wrap break-words"
                    >
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
              Preview Failed to Start
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
          key={`wc-preview:${previewVersion}`}
          ref={iframeRef}
          src={previewUrl}
          className="w-full h-full border-0"
          style={{ colorScheme: "normal", backgroundColor: "transparent" }}
          title="Next.js Preview"
        />
      )}
    </div>
  );
}
