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
  const rawOriginalRef = useRef("");
  const selectedTextOccurrenceRef = useRef(1);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const EDITABLE_SELECTOR = "h1,h2,h3,h4,h5,h6,p,span,li,a,button,label,td,th,dt,dd,figcaption,blockquote,caption,summary,legend,small,strong,em,b,i,u,sub,sup,mark,del,ins,code,pre,time,abbr,cite,q,dfn,var,samp,kbd";
    const BLOCK_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,td,th,dt,dd,figcaption,blockquote,caption,summary,legend,pre";

    // Inject rotating border animation styles
    const styleEl = document.createElement("style");
    styleEl.textContent = [
      "@property --pocket-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }",
      "@keyframes pocketSpin { to { --pocket-angle: 360deg; } }",
      "@keyframes pocketShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }",
      ".pocket-img-overlay {",
      "  position: fixed; pointer-events: none; z-index: 99999; border-radius: 10px; padding: 3px;",
      "  background: conic-gradient(from var(--pocket-angle), #f97316, #ec4899, #8b5cf6, #3b82f6, #10b981, #f97316);",
      "  animation: pocketSpin 2s linear infinite;",
      "  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);",
      "  -webkit-mask-composite: xor; mask-composite: exclude;",
      "}",
    ].join("\\n");
    document.head.appendChild(styleEl);

    const clearTextSelection = () => {
      const el = selectedTextRef.current;
      if (!el) return;
      selectedTextRef.current = null;
      originalTextRef.current = "";
      rawOriginalRef.current = "";
      selectedTextOccurrenceRef.current = 1;
      el.contentEditable = "false";
      el.style.outline = "";
      el.style.outlineOffset = "";
    };

    const removeOverlay = () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      if (overlayRef.current) { overlayRef.current.remove(); overlayRef.current = null; }
    };

    const syncOverlay = () => {
      const img = selectedImageRef.current;
      const el = overlayRef.current;
      if (!img || !el) { removeOverlay(); return; }
      const r = img.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) { removeOverlay(); return; }
      el.style.top = (r.top - 3) + "px";
      el.style.left = (r.left - 3) + "px";
      el.style.width = (r.width + 6) + "px";
      el.style.height = (r.height + 6) + "px";
      rafRef.current = requestAnimationFrame(syncOverlay);
    };

    const showOverlay = (img: HTMLImageElement) => {
      removeOverlay();
      const el = document.createElement("div");
      el.className = "pocket-img-overlay";
      document.body.appendChild(el);
      overlayRef.current = el;
      rafRef.current = requestAnimationFrame(syncOverlay);
    };

    const clearImageSelection = () => {
      const image = selectedImageRef.current;
      if (!image) return;
      selectedImageRef.current = null;
      removeOverlay();
    };

    const commitTextEdit = (cancel: boolean) => {
      const el = selectedTextRef.current;
      if (!el) return;
      const updated = (el.textContent || "").trim();
      const original = originalTextRef.current;
      const occurrence = selectedTextOccurrenceRef.current;

      if (cancel) {
        el.textContent = rawOriginalRef.current;
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
          occurrence,
          tag: el.tagName.toLowerCase(),
        },
        "*",
      );
    };

    const resolveOriginalImageSrc = (rawSrc: string): string => {
      try {
        const parsed = new URL(rawSrc, window.location.origin);
        if (parsed.pathname === "/api/image-proxy") {
          const original = parsed.searchParams.get("url");
          if (original) return decodeURIComponent(original);
        }
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
      const images = Array.from(document.querySelectorAll("img"));
      let count = 1;
      for (const img of images) {
        if (img === target) break;
        const src = img.getAttribute("src") || (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || "";
        if (src === rawSrc) count += 1;
      }
      return count;
    };

    const extractBgUrl = (el: HTMLElement): string | null => {
      const bg = getComputedStyle(el).backgroundImage;
      if (!bg || bg === "none") return null;
      const m = bg.match(/url\\(["']?([^"')]+)["']?\\)/);
      return m ? m[1] : null;
    };

    const findBgImageElement = (start: HTMLElement): { element: HTMLElement; url: string } | null => {
      let el: HTMLElement | null = start;
      while (el && el !== document.body) {
        const url = extractBgUrl(el);
        if (url) return { element: el, url };
        el = el.parentElement;
      }
      return null;
    };

    const bgOccurrence = (target: HTMLElement, url: string): number => {
      const all = Array.from(document.querySelectorAll("*")) as HTMLElement[];
      let count = 1;
      for (const el of all) {
        if (el === target) break;
        if (extractBgUrl(el) === url) count += 1;
      }
      return count;
    };

    const textOccurrence = (target: HTMLElement, text: string): number => {
      const nodes = Array.from(
        document.querySelectorAll(EDITABLE_SELECTOR),
      );
      const normalized = text.trim();
      let count = 1;
      for (const node of nodes) {
        if (node === target) break;
        // Skip nodes that are descendants of the target (avoids double-counting
        // e.g. a <span> inside an <h1> that has the same textContent)
        if (target.contains(node)) continue;
        // Skip nodes that contain the target (parent with same text)
        if (node.contains(target)) continue;
        if ((node.textContent || "").trim() === normalized) {
          count += 1;
        }
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

    // Prevent link navigation in text edit / image select modes.
    // Intercept mousedown and pointerdown to block framework routers
    // (e.g. Next.js Link) that may navigate before our click handler fires.
    const onPointerOrMouseDown = (event: Event) => {
      if (!window.__pocketTextEditMode && !window.__pocketImageSelectMode) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const link = target.closest("a");
      if (link) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const resolveEditable = (target: HTMLElement): HTMLElement | null => {
      let editable = target.closest(EDITABLE_SELECTOR) as HTMLElement | null;
      if (!editable) return null;

      // If we landed on an <a> tag that contains a simpler text child, prefer
      // the child so contentEditable doesn't affect the entire link (icons etc.)
      if (editable.tagName === "A") {
        const textChild = editable.querySelector("span,p,h1,h2,h3,h4,h5,h6,label,strong,em,b,i") as HTMLElement | null;
        if (textChild && textChild.textContent?.trim()) {
          editable = textChild;
        }
      }

      // Prefer block-level parent over inline child elements.
      // This ensures clicking a <span> inside an <h1> selects the whole <h1>,
      // and clicking a <strong> inside a <p> selects the whole <p>.
      const blockParent = editable.parentElement?.closest(BLOCK_SELECTOR) as HTMLElement | null;
      if (blockParent) editable = blockParent;

      return editable;
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (window.__pocketImageSelectMode) {
        // Find image: try closest <img>, then check wrappers, then background images
        let image = target.closest("img") as HTMLImageElement | null;
        if (!image) {
          const wrapper = target.closest("picture, [data-nimg], span, div, figure") as HTMLElement | null;
          if (wrapper) {
            image = wrapper.querySelector("img") as HTMLImageElement | null;
          }
        }
        if (!image) {
          image = target.querySelector("img") as HTMLImageElement | null;
        }

        if (image) {
          event.preventDefault();
          event.stopPropagation();
          commitTextEdit(false);
          clearImageSelection();

          selectedImageRef.current = image;
          showOverlay(image);

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

        // Check for CSS background-image on clicked element or ancestors
        const bgEl = findBgImageElement(target);
        if (bgEl) {
          event.preventDefault();
          event.stopPropagation();
          commitTextEdit(false);
          clearImageSelection();

          // Store the element in selectedImageRef (cast — overlay sync uses
          // getBoundingClientRect which exists on all HTMLElements).
          selectedImageRef.current = bgEl.element as unknown as HTMLImageElement;
          showOverlay(bgEl.element as unknown as HTMLImageElement);

          window.parent.postMessage(
            {
              type: "pocket:image-selected",
              src: bgEl.url,
              resolvedSrc: resolveOriginalImageSrc(bgEl.url),
              alt: bgEl.element.getAttribute("aria-label") || "",
              occurrence: bgOccurrence(bgEl.element, bgEl.url),
            },
            "*",
          );
          return;
        }
        return;
      }

      if (!window.__pocketTextEditMode) return;

      const editable = resolveEditable(target);
      if (!editable) return;

      // If clicking on the element we're already editing, allow natural cursor
      // interaction without resetting the edit state.
      if (editable === selectedTextRef.current) {
        // Still prevent link navigation for <a> elements
        if (target.closest("a")) event.preventDefault();
        event.stopPropagation();
        return;
      }

      const text = (editable.textContent || "").trim();
      if (!text || text.length > 280) return;

      event.preventDefault();
      event.stopPropagation();

      // Commit any in-progress edit before starting a new one (don't discard)
      commitTextEdit(false);
      clearImageSelection();

      selectedTextRef.current = editable;
      rawOriginalRef.current = editable.textContent || "";
      originalTextRef.current = text;
      selectedTextOccurrenceRef.current = textOccurrence(editable, text);
      editable.contentEditable = "true";
      editable.style.outline = "2px dashed #3b82f6";
      editable.style.outlineOffset = "2px";
      editable.focus();

      // Place cursor at click position for better UX
      try {
        const range = document.caretRangeFromPoint(event.clientX, event.clientY);
        if (range) {
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      } catch {}
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
      // Only commit if the focus left the currently-selected element.
      // Use a microtask to avoid committing when focus moves to a child element.
      if (
        event.target === selectedTextRef.current ||
        selectedTextRef.current.contains(event.target as Node)
      ) {
        setTimeout(() => {
          if (
            selectedTextRef.current &&
            !selectedTextRef.current.contains(document.activeElement)
          ) {
            commitTextEdit(false);
          }
        }, 0);
      }
    };

    window.addEventListener("message", onMessage);
    document.addEventListener("pointerdown", onPointerOrMouseDown, true);
    document.addEventListener("mousedown", onPointerOrMouseDown, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusout", onFocusOut, true);

    // Signal parent that bridge is ready so it can re-send current modes
    // (needed after HMR or iframe remount resets window state).
    window.parent.postMessage({ type: "pocket:bridge-ready" }, "*");

    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("pointerdown", onPointerOrMouseDown, true);
      document.removeEventListener("mousedown", onPointerOrMouseDown, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusout", onFocusOut, true);
      commitTextEdit(false);
      clearImageSelection();
      styleEl.remove();
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

  if (!next.includes("<PocketTextEditBridge />")) {
    next = next.replace(
      /\{\s*children\s*\}/,
      "<PocketTextEditBridge />{children}",
    );
  }
  if (!next.includes("<PocketAuthPreviewBridge />")) {
    next = next.replace(
      /\{\s*children\s*\}/,
      "<PocketAuthPreviewBridge />{children}",
    );
  }

  return next;
}

function normalizeGlobalsCss(content: string): string {
  return content.replace(/^\s*@apply\s+[^;]+;\s*$/gm, "");
}

export function applyPreviewBridges(sourceFiles: FileMap): FileMap {
  const patchedFiles: FileMap = { ...sourceFiles };

  const globalsCssPath =
    typeof patchedFiles["app/globals.css"] === "string"
      ? "app/globals.css"
      : typeof patchedFiles["src/app/globals.css"] === "string"
        ? "src/app/globals.css"
        : null;

  if (globalsCssPath) {
    patchedFiles[globalsCssPath] = normalizeGlobalsCss(
      patchedFiles[globalsCssPath],
    );
  }

  const layoutPathCandidates = [
    "app/layout.tsx",
    "app/layout.jsx",
    "app/layout.ts",
    "app/layout.js",
    "src/app/layout.tsx",
    "src/app/layout.jsx",
    "src/app/layout.ts",
    "src/app/layout.js",
  ];
  const layoutPath = layoutPathCandidates.find(
    (path) => typeof patchedFiles[path] === "string",
  );

  if (layoutPath) {
    patchedFiles[layoutPath] = ensureBridgeInLayout(patchedFiles[layoutPath]);
  }

  patchedFiles["components/PocketTextEditBridge.tsx"] = TEXT_EDIT_BRIDGE;
  patchedFiles["components/PocketAuthPreviewBridge.tsx"] = AUTH_PREVIEW_BRIDGE;
  patchedFiles["src/components/PocketTextEditBridge.tsx"] = TEXT_EDIT_BRIDGE;
  patchedFiles["src/components/PocketAuthPreviewBridge.tsx"] =
    AUTH_PREVIEW_BRIDGE;

  return patchedFiles;
}
