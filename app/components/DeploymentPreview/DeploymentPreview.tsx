"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hasAuthentication } from "@/lib/project-files";
import type { ReactProject } from "@/app/types";

interface DeploymentPreviewProps {
  project: ReactProject | null;
  previewUrl: string | null;
  previewKey: number;
  textEditMode?: boolean;
  imageSelectMode?: boolean;
  isPublishing?: boolean;
  hasUnpublishedChanges?: boolean;
  onPublish?: () => unknown | Promise<unknown>;
  onTextEdited?: (originalText: string, updatedText: string) => void;
  onImageSelected?: (payload: {
    src: string;
    resolvedSrc?: string;
    alt: string;
    occurrence: number;
  }) => void;
}

export default function DeploymentPreview({
  project,
  previewUrl,
  previewKey,
  textEditMode = false,
  imageSelectMode = false,
  isPublishing = false,
  hasUnpublishedChanges = false,
  onPublish,
  onTextEdited,
  onImageSelected,
}: DeploymentPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const frameKey = `${previewUrl ?? "none"}:${previewKey}`;
  const [loadedFrameKey, setLoadedFrameKey] = useState("");
  const iframeLoaded = loadedFrameKey === frameKey;
  const hasAuthPreviewHint = useMemo(
    () => (project ? hasAuthentication(project) : false),
    [project],
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || !previewUrl || !iframeLoaded) return;
    iframe.contentWindow.postMessage(
      { type: "pocket:set-text-edit-mode", enabled: textEditMode },
      "*",
    );
  }, [textEditMode, previewUrl, iframeLoaded]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || !previewUrl || !iframeLoaded) return;
    iframe.contentWindow.postMessage(
      { type: "pocket:set-image-select-mode", enabled: imageSelectMode },
      "*",
    );
  }, [imageSelectMode, previewUrl, iframeLoaded]);

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
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onTextEdited, onImageSelected]);

  return (
    <div className="relative h-full isolate" style={{ colorScheme: "normal" }}>
      {!previewUrl && (
        <div className="absolute inset-0 bg-bg-secondary z-10 flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              No Live Preview Yet
            </h3>
            <p className="text-sm text-text-tertiary mb-4">
              Deploy this project to Vercel to render production-accurate preview.
            </p>
            {onPublish && (
              <button
                onClick={() => void onPublish()}
                disabled={isPublishing}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition disabled:opacity-50"
              >
                {isPublishing ? "Deploying..." : "Deploy Preview"}
              </button>
            )}
          </div>
        </div>
      )}

      {previewUrl && (
        <iframe
          key={frameKey}
          ref={iframeRef}
          src={`${previewUrl}${previewUrl.includes("?") ? "&" : "?"}pv=${previewKey}`}
          onLoad={() => setLoadedFrameKey(frameKey)}
          className="w-full h-full border-0"
          style={{ colorScheme: "normal", backgroundColor: "transparent" }}
          title="Vercel Preview"
        />
      )}

      {previewUrl && hasUnpublishedChanges && (
        <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-20">
          <div className="pointer-events-auto rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-200 backdrop-blur">
            Preview is out of date. Publish changes to refresh.
          </div>
        </div>
      )}

      {isPublishing && (
        <div className="absolute inset-0 bg-bg-secondary/70 backdrop-blur-sm z-20 flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-xl border border-border-primary bg-bg-secondary px-4 py-3 shadow-2xl">
            <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-sm text-text-secondary">
              Deploying latest preview to Vercel...
            </span>
          </div>
        </div>
      )}

      {previewUrl && iframeLoaded && hasAuthPreviewHint && (
        <div className="pointer-events-none absolute top-3 right-3 z-20 max-w-sm">
          <div className="pointer-events-auto rounded-xl border border-border-primary bg-bg-secondary/95 backdrop-blur-md p-3 shadow-xl">
            <h3 className="text-sm font-semibold text-text-primary mb-1">
              Auth Testing Tip
            </h3>
            <p className="text-xs text-text-tertiary mb-2 leading-relaxed">
              For OAuth redirects, open preview in a new tab.
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
