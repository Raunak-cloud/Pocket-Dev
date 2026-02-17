type FileMap = Record<string, string>;

const TEXT_EDIT_BRIDGE = `"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    __pocketTextEditMode?: boolean;
    __pocketImageSelectMode?: boolean;
  }
}

export default function PocketTextEditBridge() {
  const selectedTextRef = useRef<HTMLElement | null>(null);
  const selectedImageRef = useRef<HTMLImageElement | null>(null);
  const originalTextRef = useRef("");

  useEffect(() => {
    const clearTextSelection = () => {
      if (!selectedTextRef.current) return;
      selectedTextRef.current.contentEditable = "false";
      selectedTextRef.current.style.outline = "";
      selectedTextRef.current.style.outlineOffset = "";
      selectedTextRef.current = null;
      originalTextRef.current = "";
    };

    const clearImageSelection = () => {
      if (!selectedImageRef.current) return;
      selectedImageRef.current.style.outline = "";
      selectedImageRef.current.style.outlineOffset = "";
      selectedImageRef.current = null;
    };

    const commitTextEdit = (cancel: boolean) => {
      const el = selectedTextRef.current;
      if (!el) return;
      const updated = (el.textContent || "").trim();
      const original = originalTextRef.current.trim();

      if (cancel) {
        el.textContent = originalTextRef.current;
        clearTextSelection();
        return;
      }

      clearTextSelection();
      if (!original || !updated || original === updated) return;

      window.parent.postMessage(
        {
          type: "pocket:text-edited",
          originalText: original,
          updatedText: updated,
          tag: el.tagName.toLowerCase(),
        },
        "*",
      );
    };

    const resolveOriginalImageSrc = (rawSrc: string): string => {
      try {
        const parsed = new URL(rawSrc, window.location.origin);
        if (parsed.pathname === "/_next/image") {
          const encoded = parsed.searchParams.get("url");
          if (encoded) return decodeURIComponent(encoded);
        }
        return rawSrc;
      } catch {
        return rawSrc;
      }
    };

    const imageOccurrence = (target: HTMLImageElement, rawSrc: string): number => {
      const images = Array.from(document.querySelectorAll("img[src]"));
      let count = 1;
      for (const img of images) {
        if (img === target) break;
        const src = img.getAttribute("src") || (img as HTMLImageElement).src || "";
        if (src === rawSrc) count += 1;
      }
      return count;
    };

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "pocket:set-text-edit-mode") {
        window.__pocketTextEditMode = Boolean(data.enabled);
        if (!window.__pocketTextEditMode) {
          commitTextEdit(false);
        }
      }

      if (data.type === "pocket:set-image-select-mode") {
        window.__pocketImageSelectMode = Boolean(data.enabled);
        if (!window.__pocketImageSelectMode) {
          clearImageSelection();
        }
      }
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (window.__pocketImageSelectMode) {
        const image = target.closest("img[src]") as HTMLImageElement | null;
        if (!image) return;

        event.preventDefault();
        event.stopPropagation();
        clearTextSelection();
        clearImageSelection();

        selectedImageRef.current = image;
        image.style.outline = "3px solid #f97316";
        image.style.outlineOffset = "3px";

        const rawSrc =
          image.getAttribute("src") || image.currentSrc || image.src || "";
        window.parent.postMessage(
          {
            type: "pocket:image-selected",
            src: rawSrc,
            resolvedSrc: resolveOriginalImageSrc(rawSrc),
            alt: image.getAttribute("alt") || "",
            occurrence: imageOccurrence(image, rawSrc),
          },
          "*",
        );
        return;
      }

      if (!window.__pocketTextEditMode) return;
      const editable = target.closest("h1,h2,h3,h4,h5,h6,p,span,li,a,button,label") as HTMLElement | null;
      if (!editable) return;
      const text = (editable.textContent || "").trim();
      if (!text || text.length > 280) return;

      event.preventDefault();
      event.stopPropagation();

      clearImageSelection();
      clearTextSelection();
      selectedTextRef.current = editable;
      originalTextRef.current = editable.textContent || "";
      editable.contentEditable = "true";
      editable.style.outline = "2px dashed #3b82f6";
      editable.style.outlineOffset = "2px";
      editable.focus();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (window.__pocketImageSelectMode) {
          clearImageSelection();
        }
        if (window.__pocketTextEditMode) {
          commitTextEdit(true);
        }
      }
      if (
        window.__pocketTextEditMode &&
        selectedTextRef.current &&
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        commitTextEdit(false);
      }
    };

    const onFocusOut = (event: FocusEvent) => {
      if (!selectedTextRef.current) return;
      if (event.target === selectedTextRef.current) {
        commitTextEdit(false);
      }
    };

    window.addEventListener("message", onMessage);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusout", onFocusOut, true);

    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusout", onFocusOut, true);
      commitTextEdit(false);
      clearImageSelection();
    };
  }, []);

  return null;
}
`;

const AUTH_PREVIEW_BRIDGE = `"use client";

import { useEffect } from "react";

const SUPABASE_AUTH_HOST_FRAGMENT = ".accounts.dev";

export default function PocketAuthPreviewBridge() {
  useEffect(() => {
    if (window.top === window.self) return;

    const handleWindowOpen = () => {
      const original = window.open;
      window.open = function (...args) {
        const href = typeof args[0] === "string" ? args[0] : "";
        if (href.includes(SUPABASE_AUTH_HOST_FRAGMENT)) {
          return original.call(window, href, "_blank", "noopener,noreferrer");
        }
        return original.apply(window, args as any);
      };
      return () => {
        window.open = original;
      };
    };

    const restore = handleWindowOpen();
    return restore;
  }, []);

  return null;
}
`;

function ensureBridgeInLayout(layoutContent: string): string {
  const importsToEnsure = [
    `import PocketTextEditBridge from "@/components/PocketTextEditBridge";`,
    `import PocketAuthPreviewBridge from "@/components/PocketAuthPreviewBridge";`,
  ];

  let next = layoutContent;
  for (const importLine of importsToEnsure) {
    if (next.includes(importLine)) continue;
    const imports = next.match(/^import[^\n]*$/gm);
    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      const idx = next.lastIndexOf(lastImport);
      if (idx >= 0) {
        const insertAt = idx + lastImport.length;
        next = `${next.slice(0, insertAt)}\n${importLine}${next.slice(insertAt)}`;
      } else {
        next = `${importLine}\n${next}`;
      }
    } else {
      next = `${importLine}\n${next}`;
    }
  }

  if (next.includes("{children}")) {
    if (!next.includes("<PocketTextEditBridge />")) {
      next = next.replace("{children}", "<PocketTextEditBridge />{children}");
    }
    if (!next.includes("<PocketAuthPreviewBridge />")) {
      next = next.replace("{children}", "<PocketAuthPreviewBridge />{children}");
    }
  }

  return next;
}

function normalizeGlobalsCss(content: string): string {
  return content.replace(/^\s*@apply\s+[^;]+;\s*$/gm, "");
}

export function applyPreviewBridges(sourceFiles: FileMap): FileMap {
  const patchedFiles: FileMap = { ...sourceFiles };

  if (typeof patchedFiles["app/globals.css"] === "string") {
    patchedFiles["app/globals.css"] = normalizeGlobalsCss(
      patchedFiles["app/globals.css"],
    );
  }

  if (typeof patchedFiles["app/layout.tsx"] === "string") {
    patchedFiles["app/layout.tsx"] = ensureBridgeInLayout(
      patchedFiles["app/layout.tsx"],
    );
  }

  patchedFiles["components/PocketTextEditBridge.tsx"] = TEXT_EDIT_BRIDGE;
  patchedFiles["components/PocketAuthPreviewBridge.tsx"] = AUTH_PREVIEW_BRIDGE;

  return patchedFiles;
}
