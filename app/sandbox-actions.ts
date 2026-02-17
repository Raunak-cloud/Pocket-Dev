'use server';

import { Sandbox } from '@vercel/sandbox';
import {
  appendSandboxStartupLog,
  completeSandboxStartupStatus,
  failSandboxStartupStatus,
  initSandboxStartupStatus,
  setSandboxStartupPhase,
} from "@/lib/sandbox-startup-status";
import { ensureProviderGuardsForFileMap } from "@/lib/provider-guards";
import { getProjectAuthTenantSlug } from "@/lib/auth-tenant";
import { getSupabaseEnvBundle } from "@/lib/supabase/env";

function getVercelAuth(): Record<string, string> {
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (token && teamId && projectId) {
    return { token, teamId, projectId };
  }
  return {};
}

export async function createSandboxServer(
  files: Record<string, string>,
  startupId?: string,
  options?: { projectId?: string },
) {
  const ensureTextEditBridge = (layoutContent: string): string => {
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
        next = next.replace(
          "{children}",
          "<PocketAuthPreviewBridge />{children}",
        );
      }
    }

    return next;
  };

  const normalizeGlobalsCss = (content: string): string => {
    const stripUnsupportedApplyUtilities = (css: string): string =>
      // Compile safety: unknown @apply utilities can crash Tailwind build.
      css.replace(/^\s*@apply\s+[^;]+;\s*$/gm, "");

    const hasLayerBase = /@layer\s+base\b/.test(content);
    const hasLayerComponents = /@layer\s+components\b/.test(content);
    const hasLayerUtilities = /@layer\s+utilities\b/.test(content);

    const hasTailwindBase = /@tailwind\s+base\s*;/.test(content);
    const hasTailwindComponents = /@tailwind\s+components\s*;/.test(content);
    const hasTailwindUtilities = /@tailwind\s+utilities\s*;/.test(content);

    const missing: string[] = [];
    if (hasLayerBase && !hasTailwindBase) missing.push("@tailwind base;");
    if (hasLayerComponents && !hasTailwindComponents) {
      missing.push("@tailwind components;");
    }
    if (hasLayerUtilities && !hasTailwindUtilities) {
      missing.push("@tailwind utilities;");
    }

    const normalized =
      missing.length === 0 ? content : `${missing.join("\n")}\n\n${content}`;

    return stripUnsupportedApplyUtilities(normalized);
  };

  const patchedFiles: Record<string, string> = { ...files };
  const authPreviewEnvs: Record<string, string> = {
    ...getSupabaseEnvBundle(),
  };
  if (options?.projectId) {
    authPreviewEnvs.NEXT_PUBLIC_POCKET_APP_SLUG = getProjectAuthTenantSlug(
      options.projectId,
    );
  }

  // Normalize package manager inputs so preview always uses a stable Tailwind v3 toolchain.
  if (typeof patchedFiles["package.json"] === "string") {
    try {
      const pkg = JSON.parse(patchedFiles["package.json"]);
      const deps = { ...(pkg.dependencies || {}) };
      const devDeps = { ...(pkg.devDependencies || {}) };

      deps.tailwindcss = "3.4.17";
      deps.postcss = deps.postcss || "^8.4.31";
      deps.autoprefixer = deps.autoprefixer || "^10.4.16";

      // Prevent v4 plugin from forcing incompatible PostCSS behavior.
      delete deps["@tailwindcss/postcss"];
      delete devDeps["@tailwindcss/postcss"];

      pkg.dependencies = deps;
      pkg.devDependencies = devDeps;
      patchedFiles["package.json"] = JSON.stringify(pkg, null, 2);
    } catch {
      // Keep original package.json if parsing fails.
    }
  }

  // Ignore lockfiles from generated output to avoid stale v4 dependency graphs.
  delete patchedFiles["package-lock.json"];
  delete patchedFiles["pnpm-lock.yaml"];
  delete patchedFiles["yarn.lock"];

  if (typeof patchedFiles["app/globals.css"] === "string") {
    patchedFiles["app/globals.css"] = normalizeGlobalsCss(
      patchedFiles["app/globals.css"]
    );
  }
  patchedFiles["components/PocketTextEditBridge.tsx"] = `"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    __pocketTextEditMode?: boolean;
    __pocketImageSelectMode?: boolean;
  }
}

export default function PocketTextEditBridge() {
  const selectedRef = useRef<HTMLElement | null>(null);
  const selectedImageRef = useRef<HTMLImageElement | null>(null);
  const originalTextRef = useRef<string>("");
  const previousRootCursorRef = useRef<string>("");
  const previousBodyCursorRef = useRef<string>("");
  const modeOverlayRef = useRef<HTMLDivElement | null>(null);
  const styleElementRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    const clearSelectionStyles = () => {
      if (!selectedRef.current) return;
      selectedRef.current.style.outline = "";
      selectedRef.current.style.outlineOffset = "";
      selectedRef.current.style.cursor = "";
      selectedRef.current.contentEditable = "false";
      selectedRef.current = null;
      originalTextRef.current = "";
    };

    const clearImageSelectionStyles = () => {
      if (!selectedImageRef.current) return;
      selectedImageRef.current.style.outline = "";
      selectedImageRef.current.style.outlineOffset = "";
      selectedImageRef.current.style.cursor = "";
      selectedImageRef.current.style.transform = "";
      selectedImageRef.current.style.transition = "";
      selectedImageRef.current = null;
    };

    const createImageSelectOverlay = () => {
      if (modeOverlayRef.current) return;

      const overlay = document.createElement("div");
      overlay.id = "pocket-image-select-overlay";
      overlay.innerHTML = \`
        <div style="
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 999999;
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          color: white;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
          animation: slideDown 0.3s ease-out;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <span>Image Selection Mode Active</span>
          <span style="opacity: 0.9; font-size: 13px; font-weight: 400;">Click any image to replace it</span>
          <div style="
            margin-left: auto;
            background: rgba(255, 255, 255, 0.2);
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <kbd style="
              background: rgba(255, 255, 255, 0.3);
              padding: 2px 6px;
              border-radius: 3px;
              font-family: monospace;
              font-size: 11px;
            ">ESC</kbd>
            to cancel
          </div>
        </div>
      \`;

      const style = document.createElement("style");
      style.textContent = \`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes imageSelect {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(0.95); }
        }
        @keyframes borderPulse {
          0%, 100% {
            outline-color: #f97316;
            outline-width: 4px;
            box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.7);
          }
          50% {
            outline-color: #fb923c;
            outline-width: 5px;
            box-shadow: 0 0 0 8px rgba(249, 115, 22, 0);
          }
        }
      \`;
      document.head.appendChild(style);
      document.body.appendChild(overlay);
      modeOverlayRef.current = overlay;

      // Adjust body padding to prevent content jump
      document.body.style.paddingTop = "44px";
    };

    const removeImageSelectOverlay = () => {
      if (modeOverlayRef.current) {
        modeOverlayRef.current.remove();
        modeOverlayRef.current = null;
      }
      document.body.style.paddingTop = "";
    };

    const addImageHoverStyles = () => {
      if (styleElementRef.current) return;

      const style = document.createElement("style");
      style.id = "pocket-image-hover-styles";
      style.textContent = \`
        img {
          transition: all 0.2s ease !important;
        }
        img:hover {
          outline: 3px solid #f97316 !important;
          outline-offset: 3px !important;
          transform: scale(1.02) !important;
          box-shadow: 0 8px 24px rgba(249, 115, 22, 0.3) !important;
          cursor: crosshair !important;
          filter: brightness(1.05) !important;
        }
      \`;
      document.head.appendChild(style);
      styleElementRef.current = style;
    };

    const removeImageHoverStyles = () => {
      if (styleElementRef.current) {
        styleElementRef.current.remove();
        styleElementRef.current = null;
      }
    };

    const setModeCursor = (enabled: boolean) => {
      if (enabled) {
        previousRootCursorRef.current = document.documentElement.style.cursor;
        previousBodyCursorRef.current = document.body.style.cursor;
        const cursor = window.__pocketImageSelectMode ? "crosshair" : "text";
        document.documentElement.style.cursor = cursor;
        document.body.style.cursor = cursor;
        return;
      }
      document.documentElement.style.cursor = previousRootCursorRef.current || "";
      document.body.style.cursor = previousBodyCursorRef.current || "";
    };

    const commitEdit = (cancel: boolean) => {
      const el = selectedRef.current;
      if (!el) return;

      const original = originalTextRef.current;
      const updated = (el.textContent || "").trim();

      if (cancel) {
        el.textContent = original;
        clearSelectionStyles();
        return;
      }

      clearSelectionStyles();
      if (!original.trim() || !updated || original.trim() === updated) return;

      window.parent.postMessage(
        {
          type: "pocket:text-edited",
          originalText: original.trim(),
          updatedText: updated,
          tag: el.tagName?.toLowerCase() || "unknown",
        },
        "*"
      );
    };

    const findEditableTarget = (target: EventTarget | null): HTMLElement | null => {
      let el = target as HTMLElement | null;
      while (el && el !== document.body) {
        const tag = el.tagName?.toLowerCase();
        if (["script", "style", "noscript", "input", "textarea"].includes(tag)) {
          return null;
        }
        const text = el.textContent?.trim() || "";
        if (text.length > 0 && text.length < 300) return el;
        el = el.parentElement;
      }
      return null;
    };

    const findImageTarget = (target: EventTarget | null): HTMLImageElement | null => {
      let el = target as HTMLElement | null;
      while (el && el !== document.body) {
        if (el instanceof HTMLImageElement) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    };

    const getImageOccurrence = (target: HTMLImageElement, rawSrc: string): number => {
      const images = Array.from(document.querySelectorAll("img[src]"));
      let occurrence = 1;
      for (const img of images) {
        if (img === target) break;
        const siblingSrc = img.getAttribute("src") || (img as HTMLImageElement).src || "";
        if (siblingSrc === rawSrc) occurrence++;
      }
      return occurrence;
    };

    const resolveOriginalImageSrc = (rawSrc: string): string => {
      if (!rawSrc) return rawSrc;
      try {
        const parsed = new URL(rawSrc, window.location.origin);
        if (parsed.pathname === "/_next/image") {
          const encoded = parsed.searchParams.get("url");
          if (encoded) {
            return decodeURIComponent(encoded);
          }
        }
        return rawSrc;
      } catch {
        return rawSrc;
      }
    };

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "pocket:set-text-edit-mode") {
        window.__pocketTextEditMode = Boolean(data.enabled);
        setModeCursor(Boolean(window.__pocketTextEditMode || window.__pocketImageSelectMode));
        if (!window.__pocketTextEditMode) {
          commitEdit(false);
        }
      }
      if (data.type === "pocket:set-image-select-mode") {
        window.__pocketImageSelectMode = Boolean(data.enabled);
        setModeCursor(Boolean(window.__pocketTextEditMode || window.__pocketImageSelectMode));
        if (window.__pocketImageSelectMode) {
          createImageSelectOverlay();
          addImageHoverStyles();
        } else {
          removeImageSelectOverlay();
          removeImageHoverStyles();
          clearImageSelectionStyles();
        }
      }
    };

    const onClick = (event: MouseEvent) => {
      if (window.__pocketImageSelectMode) {
        const imageTarget = findImageTarget(event.target);
        if (!imageTarget) return;

        event.preventDefault();
        event.stopPropagation();

        clearSelectionStyles();
        clearImageSelectionStyles();

        selectedImageRef.current = imageTarget;

        // Add selection animation with pulsing border
        selectedImageRef.current.style.transition = "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";
        selectedImageRef.current.style.outline = "4px solid #f97316";
        selectedImageRef.current.style.outlineOffset = "4px";
        selectedImageRef.current.style.cursor = "pointer";
        selectedImageRef.current.style.transform = "scale(1.05)";
        selectedImageRef.current.style.boxShadow = "0 12px 32px rgba(249, 115, 22, 0.4)";
        selectedImageRef.current.style.filter = "brightness(1.1)";
        selectedImageRef.current.style.animation = "imageSelect 0.3s ease-out, borderPulse 2s ease-in-out infinite";

        const rawSrc =
          imageTarget.getAttribute("src") ||
          imageTarget.currentSrc ||
          imageTarget.src ||
          "";
        const resolvedSrc = resolveOriginalImageSrc(rawSrc);
        const alt = imageTarget.getAttribute("alt") || "";
        const occurrence = getImageOccurrence(imageTarget, rawSrc);

        // Show success feedback in overlay
        if (modeOverlayRef.current) {
          const overlay = modeOverlayRef.current.querySelector("div");
          if (overlay) {
            const originalHTML = overlay.innerHTML;
            overlay.innerHTML = \`
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>Image Selected!</span>
              <span style="opacity: 0.9; font-size: 13px; font-weight: 400;">Upload a new image to replace it</span>
            \`;
            setTimeout(() => {
              if (overlay) overlay.innerHTML = originalHTML;
            }, 2000);
          }
        }

        window.parent.postMessage(
          {
            type: "pocket:image-selected",
            src: rawSrc,
            resolvedSrc,
            alt,
            occurrence,
          },
          "*"
        );
        return;
      }

      if (!window.__pocketTextEditMode) return;
      const target = findEditableTarget(event.target);
      if (!target) return;

      if (selectedRef.current === target) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      clearSelectionStyles();
      selectedRef.current = target;
      originalTextRef.current = (target.textContent || "").trim();
      selectedRef.current.style.outline = "2px dashed #3b82f6";
      selectedRef.current.style.outlineOffset = "2px";
      selectedRef.current.style.cursor = "text";
      selectedRef.current.contentEditable = "true";
      selectedRef.current.focus();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (window.__pocketImageSelectMode) {
          clearImageSelectionStyles();
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      if (!window.__pocketTextEditMode || !selectedRef.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        commitEdit(true);
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        commitEdit(false);
      }
    };

    const onFocusOut = (event: FocusEvent) => {
      if (!selectedRef.current) return;
      if (event.target === selectedRef.current) {
        commitEdit(false);
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
      commitEdit(false);
      clearImageSelectionStyles();
      removeImageSelectOverlay();
      removeImageHoverStyles();
      setModeCursor(false);
    };
  }, []);

  return null;
}
`;
  patchedFiles["components/PocketAuthPreviewBridge.tsx"] = `"use client";

import { useEffect } from "react";

const SUPABASE_AUTH_HOST_FRAGMENT = ".accounts.dev";

export default function PocketAuthPreviewBridge() {
  useEffect(() => {
    if (window.top === window.self) return;

    const openOutsideFrame = (href: string) => {
      try {
        // Modify the auth redirect URL to point back to the parent page
        let modifiedHref = href;
        try {
          const url = new URL(href);
          const redirectTo = url.searchParams.get('redirect_to');
          if (redirectTo && window.top) {
            // Replace the iframe's callback URL with the parent page URL
            const parentOrigin = window.top.location.origin;
            const parentPath = window.top.location.pathname + window.top.location.search;
            url.searchParams.set('redirect_to', parentOrigin + parentPath);
            modifiedHref = url.toString();
          }
        } catch (e) {
          // If URL parsing fails, use original href
          console.warn('Failed to modify auth redirect URL:', e);
        }

        // Prefer breaking out of iframe in the same tab.
        window.top!.location.href = modifiedHref;
      } catch {
        window.open(href, "_blank", "noopener,noreferrer");
      }
    };

    const clickHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (!href.includes(SUPABASE_AUTH_HOST_FRAGMENT)) return;
      event.preventDefault();
      event.stopPropagation();
      openOutsideFrame(anchor.href);
    };

    // If app already redirected into a Supabase Auth hosted URL inside iframe, break out.
    if (window.location.hostname.includes(SUPABASE_AUTH_HOST_FRAGMENT)) {
      openOutsideFrame(window.location.href);
    }

    document.addEventListener("click", clickHandler, true);
    return () => {
      document.removeEventListener("click", clickHandler, true);
    };
  }, []);

  return null;
}
`;

  if (typeof patchedFiles["app/layout.tsx"] === "string") {
    patchedFiles["app/layout.tsx"] = ensureTextEditBridge(patchedFiles["app/layout.tsx"]);
  }

  Object.assign(patchedFiles, ensureProviderGuardsForFileMap(patchedFiles));
  patchedFiles["postcss.config.js"] = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`;

  const jobId =
    startupId ||
    `sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  initSandboxStartupStatus(jobId);

  try {
    const sandbox = await Sandbox.create({
      ...getVercelAuth(),
      runtime: "node22",
      timeout: 45 * 60 * 1000, // 45 min auto-cleanup
      ports: [3000],
    });
    appendSandboxStartupLog(jobId, `Sandbox created: ${sandbox.sandboxId}`);

  // Upload all files at once
  const fileEntries = Object.entries(patchedFiles).map(([path, content]) => ({
    path,
    content: Buffer.from(content),
  }));
  await sandbox.writeFiles(fileEntries);
  appendSandboxStartupLog(jobId, `Uploaded ${fileEntries.length} files`);

  // Install dependencies with a deterministic strategy and non-interactive flags.
  console.log('[Sandbox] Installing dependencies...');
  setSandboxStartupPhase(jobId, "installing");
  appendSandboxStartupLog(jobId, "Installing dependencies...");
  try {
    const hasPackageLock = typeof patchedFiles["package-lock.json"] === "string";
    const primaryInstallArgs = hasPackageLock
      ? ["ci", "--include=dev", "--no-audit", "--no-fund", "--progress=false"]
      : ["install", "--include=dev", "--no-audit", "--no-fund", "--progress=false"];

    let installResult = await sandbox.runCommand({
      cmd: "npm",
      args: primaryInstallArgs,
      cwd: "/vercel/sandbox",
      env: {
        CI: "true",
        npm_config_update_notifier: "false",
      },
      signal: AbortSignal.timeout(12 * 60 * 1000),
    });

    const installStdout = await installResult.stdout();
    const installStderr = await installResult.stderr();
    if (installStdout) appendSandboxStartupLog(jobId, installStdout);
    if (installStderr) appendSandboxStartupLog(jobId, `[npm] ${installStderr}`);

    // If lockfile-based install fails, fallback to npm install for resilience.
    if (installResult.exitCode !== 0 && hasPackageLock) {
      console.warn("[Sandbox] npm ci failed, retrying with npm install...");
      appendSandboxStartupLog(jobId, "npm ci failed, retrying with npm install...");
      installResult = await sandbox.runCommand({
        cmd: "npm",
        args: ["install", "--include=dev", "--no-audit", "--no-fund", "--progress=false"],
        cwd: "/vercel/sandbox",
        env: {
          CI: "true",
          npm_config_update_notifier: "false",
        },
        signal: AbortSignal.timeout(12 * 60 * 1000),
      });

      const retryStdout = await installResult.stdout();
      const retryStderr = await installResult.stderr();
      if (retryStdout) appendSandboxStartupLog(jobId, retryStdout);
      if (retryStderr) appendSandboxStartupLog(jobId, `[npm] ${retryStderr}`);
    }

    if (installResult.exitCode !== 0) {
      const errorOutput = (await installResult.stderr()) || (await installResult.stdout()) || "Unknown install error";
      console.error('[Sandbox] dependency install failed:', errorOutput);
      throw new Error(`Dependency install failed with exit code ${installResult.exitCode}: ${errorOutput}`);
    }
    console.log('[Sandbox] Dependencies installed successfully');
    appendSandboxStartupLog(jobId, "Dependencies installed successfully");

    // Verify Tailwind resolution and self-heal if missing.
    const tailwindCheck = await sandbox.runCommand({
      cmd: "node",
      args: ["-e", "require.resolve('tailwindcss/package.json'); console.log('tailwindcss-ok')"],
      cwd: "/vercel/sandbox",
      signal: AbortSignal.timeout(30_000),
    });

    if (tailwindCheck.exitCode !== 0) {
      appendSandboxStartupLog(
        jobId,
        "Tailwind not found after install. Running dependency self-heal..."
      );

      const heal = await sandbox.runCommand({
        cmd: "npm",
        args: ["install", "--include=dev", "tailwindcss@^3", "postcss", "autoprefixer", "--no-audit", "--no-fund", "--progress=false"],
        cwd: "/vercel/sandbox",
        env: {
          CI: "true",
          npm_config_update_notifier: "false",
        },
        signal: AbortSignal.timeout(4 * 60 * 1000),
      });

      if (heal.exitCode !== 0) {
        const healError = (await heal.stderr()) || (await heal.stdout()) || "Dependency self-heal failed";
        throw new Error(`Tailwind self-heal failed: ${healError}`);
      }

      appendSandboxStartupLog(jobId, "Dependency self-heal completed");
    }
  } catch (err) {
    console.error('[Sandbox] dependency install error:', err);
    failSandboxStartupStatus(
      jobId,
      err instanceof Error ? err.message : "Dependency installation failed"
    );
    throw err;
  }

  // Start dev server in background
  console.log('[Sandbox] Starting Next.js dev server...');
  setSandboxStartupPhase(jobId, "starting");
  appendSandboxStartupLog(jobId, "Starting development server...");
  const devProcess = await sandbox.runCommand({
    cmd: "npm",
    args: ["run", "dev"],
    cwd: "/vercel/sandbox",
    env: {
      CI: "true",
      NEXT_TELEMETRY_DISABLED: "1",
      PORT: "3000",
      HOSTNAME: "0.0.0.0",
      ...authPreviewEnvs,
    },
    detached: true,
  });
  appendSandboxStartupLog(jobId, `Dev server started (cmd: ${devProcess.cmdId})`);

  // Track early process exit so we can surface startup/build errors quickly.
  const devState: {
    result: { exitCode?: number; stdout?: string; stderr?: string } | null;
    error: unknown;
  } = {
    result: null,
    error: null,
  };
  void devProcess
    .wait()
    .then(async (result) => {
      devState.result = {
        exitCode: result.exitCode ?? undefined,
        stdout: await result.stdout().catch(() => ""),
        stderr: await result.stderr().catch(() => ""),
      };
    })
    .catch((err) => {
      devState.error = err;
    });

  // Get URL and wait for server to be ready
  const url = sandbox.domain(3000);

  // Poll URL until responding (increased to 5 minutes)
  let ready = false;
  const maxAttempts = 420; // 7 minutes

  console.log(`[Sandbox] Waiting for dev server at ${url}...`);

  for (let i = 0; i < maxAttempts; i++) {
    // If the dev process already exited, fail fast with useful logs.
    if (devState.result) {
      const exitCode = devState.result.exitCode ?? -1;
      const stderr = (devState.result.stderr || "").trim();
      const stdout = (devState.result.stdout || "").trim();
      const details = stderr || stdout || "No output captured";
      const msg = `Dev server exited early with code ${exitCode}: ${details}`;
      appendSandboxStartupLog(jobId, msg);
      failSandboxStartupStatus(jobId, msg);
      throw new Error(msg);
    }

    if (devState.error) {
      const detail =
        devState.error instanceof Error ? devState.error.message : String(devState.error);
      const msg = `Dev server crashed during startup: ${detail}`;
      appendSandboxStartupLog(jobId, msg);
      failSandboxStartupStatus(jobId, msg);
      throw new Error(msg);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));
      // Any HTTP response means the server is up. A 5xx usually indicates
      // app-level errors (e.g. syntax/build issues), which should still open preview.
      if (res.status > 0) {
        ready = true;
        console.log(`[Sandbox] Dev server ready after ${i + 1} seconds (status: ${res.status})`);
        appendSandboxStartupLog(
          jobId,
          res.status >= 500
            ? `Dev server reachable but returning ${res.status} (likely app/build error). Opening preview.`
            : `Dev server ready (status ${res.status}) after ${i + 1}s`
        );
        break;
      }
    } catch (error) {
      // Log every 30 seconds to show progress
      if (i % 30 === 0 && i > 0) {
        console.log(`[Sandbox] Still waiting... (${i}s elapsed, ${maxAttempts - i}s remaining)`);
        appendSandboxStartupLog(
          jobId,
          `Waiting for server... ${i}s elapsed`
        );
      }
      // Log more details if error occurs at specific intervals
      if (i % 60 === 0 && i > 0) {
        console.log(`[Sandbox] Fetch error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!ready) {
    console.error(`[Sandbox] Dev server failed to start after ${maxAttempts} seconds`);

    // Try to get detailed error information
    let errorDetails = '';
    try {
      // Check if dev server is still running
      const psResult = await sandbox.runCommand("ps", ["aux"], { signal: AbortSignal.timeout(5000) });
      const psOut = await psResult.stdout();
      appendSandboxStartupLog(jobId, `Process check: ${psOut}`);

      // Try to get npm logs
      const logsResult = await sandbox.runCommand("bash", ["-c", 'tail -n 50 ~/.npm/_logs/*.log 2>/dev/null || echo "No npm logs found"'], { signal: AbortSignal.timeout(5000) });
      const logsOut = await logsResult.stdout();
      if (logsOut && logsOut.trim() !== "No npm logs found") {
        errorDetails += `\n\nNPM Logs:\n${logsOut}`;
        appendSandboxStartupLog(jobId, `NPM error logs: ${logsOut}`);
      }

      // Try to check if there's a Next.js build error log
      const nextLogsResult = await sandbox.runCommand("bash", ["-c", 'cat /vercel/sandbox/.next/trace 2>/dev/null || echo "No Next.js trace found"'], { signal: AbortSignal.timeout(5000) });
      const nextLogsOut = await nextLogsResult.stdout();
      if (nextLogsOut && nextLogsOut.trim() !== "No Next.js trace found") {
        errorDetails += `\n\nNext.js trace:\n${nextLogsOut.slice(0, 500)}`;
      }

      console.error('[Sandbox] Debug info:', errorDetails);
    } catch (debugErr) {
      console.error('[Sandbox] Could not fetch debug logs:', debugErr);
    }

    const timeoutError = `Dev server failed to start within ${maxAttempts} seconds. The generated code may have build errors or dependency issues. Please try regenerating with a simpler prompt.${errorDetails ? '\n\nError details: ' + errorDetails.slice(0, 500) : ''}`;
    appendSandboxStartupLog(jobId, timeoutError);
    failSandboxStartupStatus(jobId, timeoutError);
    throw new Error(timeoutError);
  }

  completeSandboxStartupStatus(jobId, {
    sandboxId: sandbox.sandboxId,
    url,
  });

    return { sandboxId: sandbox.sandboxId, url };
  } catch (err) {
    failSandboxStartupStatus(
      jobId,
      err instanceof Error ? err.message : "Sandbox startup failed"
    );
    throw err;
  }
}

export async function updateSandboxFiles(
  sandboxId: string,
  filesToWrite: Array<{ path: string; data: string }>,
  filesToDelete: string[]
) {
  const sandbox = await Sandbox.get({ sandboxId, ...getVercelAuth() });

  if (filesToWrite.length > 0) {
    await sandbox.writeFiles(
      filesToWrite.map(f => ({
        path: f.path,
        content: Buffer.from(f.data),
      }))
    );
  }

  for (const p of filesToDelete) {
    await sandbox.runCommand("rm", ["-rf", p]);
  }
}

export async function keepAliveSandbox(sandboxId: string) {
  // No longer extending timeout - let sandbox use its initial timeout
  // Health checks will handle recreation if sandbox expires
  return;
}

export async function ensureSandboxHealthy(
  sandboxId: string,
  options?: { projectId?: string },
) {
  try {
    const sandbox = await Sandbox.get({ sandboxId, ...getVercelAuth() });

    const url = sandbox.domain(3000);

    const isReachable = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);
        const res = await fetch(url, {
          method: "HEAD",
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));
        return res.status > 0;
      } catch {
        return false;
      }
    };

    if (await isReachable()) {
      return { ok: true, url };
    }

    await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", 'pkill -f "next dev" || true'],
      cwd: "/vercel/sandbox",
      signal: AbortSignal.timeout(10_000),
    });

    await sandbox.runCommand({
      cmd: "npm",
      args: ["run", "dev"],
      cwd: "/vercel/sandbox",
      env: {
        CI: "true",
        NEXT_TELEMETRY_DISABLED: "1",
        PORT: "3000",
        HOSTNAME: "0.0.0.0",
        ...getSupabaseEnvBundle(),
        ...(options?.projectId
          ? {
              NEXT_PUBLIC_POCKET_APP_SLUG: getProjectAuthTenantSlug(
                options.projectId,
              ),
            }
          : {}),
      },
      detached: true,
    });

    for (let i = 0; i < 60; i++) {
      if (await isReachable()) {
        return { ok: true, url, restarted: true };
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return { ok: false, url, reason: "port_closed_after_restart" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `sandbox_unavailable:${message}` };
  }
}

export async function closeSandbox(sandboxId: string) {
  try {
    const sandbox = await Sandbox.get({ sandboxId, ...getVercelAuth() });
    await sandbox.stop();
  } catch (err) {
    // Sandbox might already be closed or timed out
    console.error('Error closing sandbox:', err);
  }
}

/**
 * Check if a sandbox is still alive and healthy
 * Returns the sandbox URL if healthy, null otherwise
 */
export async function checkSandboxHealth(sandboxId: string): Promise<string | null> {
  try {
    const sandbox = await Sandbox.get({ sandboxId, ...getVercelAuth() });
    const url = sandbox.domain(3000);

    // Quick health check
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.status > 0) {
        console.log(`[Sandbox] Sandbox ${sandboxId} is healthy at ${url}`);
        return url;
      }
    } catch {
      clearTimeout(timeoutId);
    }

    return null;
  } catch (err) {
    console.error(`[Sandbox] Sandbox ${sandboxId} is not available:`, err);
    return null;
  }
}

