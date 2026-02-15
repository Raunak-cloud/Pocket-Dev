'use server';

import { Sandbox } from '@e2b/code-interpreter';
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
      css.replace(/@apply\s+([^;]+);/g, (_match, utilityGroup: string) => {
        const utilities = utilityGroup
          .split(/\s+/)
          .map((u) => u.trim())
          .filter(Boolean);
        const filtered = utilities.filter((u) => !u.startsWith("selection:"));

        if (filtered.length === 0) {
          return "";
        }

        return `@apply ${filtered.join(" ")};`;
      });

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
  }
}

export default function PocketTextEditBridge() {
  const selectedRef = useRef<HTMLElement | null>(null);
  const originalTextRef = useRef<string>("");
  const previousRootCursorRef = useRef<string>("");
  const previousBodyCursorRef = useRef<string>("");

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

    const setModeCursor = (enabled: boolean) => {
      if (enabled) {
        previousRootCursorRef.current = document.documentElement.style.cursor;
        previousBodyCursorRef.current = document.body.style.cursor;
        document.documentElement.style.cursor = "text";
        document.body.style.cursor = "text";
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

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "pocket:set-text-edit-mode") {
        window.__pocketTextEditMode = Boolean(data.enabled);
        setModeCursor(window.__pocketTextEditMode);
        if (!window.__pocketTextEditMode) {
          commitEdit(false);
        }
      }
    };

    const onClick = (event: MouseEvent) => {
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
        // Prefer breaking out of iframe in the same tab.
        window.top!.location.href = href;
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
      apiKey: process.env.E2B_API_KEY!,
      timeoutMs: 60 * 60 * 1000, // 60 min auto-cleanup
    });
    appendSandboxStartupLog(jobId, `Sandbox created: ${sandbox.sandboxId}`);

  // Upload all files at once
  const fileEntries = Object.entries(patchedFiles).map(([path, content]) => ({
    path: `/home/user/${path}`,
    data: content,
  }));
  await sandbox.files.write(fileEntries);
  appendSandboxStartupLog(jobId, `Uploaded ${fileEntries.length} files`);

  // Install dependencies with a deterministic strategy and non-interactive flags.
  console.log('[Sandbox] Installing dependencies...');
  setSandboxStartupPhase(jobId, "installing");
  appendSandboxStartupLog(jobId, "Installing dependencies...");
  try {
    const hasPackageLock = typeof patchedFiles["package-lock.json"] === "string";
    const primaryInstallCmd = hasPackageLock
      ? "npm ci --include=dev --no-audit --no-fund --progress=false"
      : "npm install --include=dev --no-audit --no-fund --progress=false";

    let installResult = await sandbox.commands.run(primaryInstallCmd, {
      cwd: '/home/user',
      timeoutMs: 12 * 60 * 1000, // 12 minutes timeout for dependency install
      envs: {
        CI: "true",
        npm_config_update_notifier: "false",
      },
      onStdout: (data: string) => appendSandboxStartupLog(jobId, data),
      onStderr: (data: string) => appendSandboxStartupLog(jobId, `[npm] ${data}`),
    });

    // If lockfile-based install fails, fallback to npm install for resilience.
    if (installResult.exitCode !== 0 && hasPackageLock) {
      console.warn("[Sandbox] npm ci failed, retrying with npm install...");
      appendSandboxStartupLog(jobId, "npm ci failed, retrying with npm install...");
      installResult = await sandbox.commands.run(
        "npm install --include=dev --no-audit --no-fund --progress=false",
        {
          cwd: "/home/user",
          timeoutMs: 12 * 60 * 1000,
          envs: {
            CI: "true",
            npm_config_update_notifier: "false",
          },
          onStdout: (data: string) => appendSandboxStartupLog(jobId, data),
          onStderr: (data: string) =>
            appendSandboxStartupLog(jobId, `[npm] ${data}`),
        }
      );
    }

    if (installResult.exitCode !== 0) {
      const errorOutput = installResult.stderr || installResult.stdout || "Unknown install error";
      console.error('[Sandbox] dependency install failed:', errorOutput);
      throw new Error(`Dependency install failed with exit code ${installResult.exitCode}: ${errorOutput}`);
    }
    console.log('[Sandbox] Dependencies installed successfully');
    appendSandboxStartupLog(jobId, "Dependencies installed successfully");

    // Verify Tailwind resolution and self-heal if missing.
    const tailwindCheck = await sandbox.commands.run(
      "node -e \"require.resolve('tailwindcss/package.json'); console.log('tailwindcss-ok')\"",
      {
        cwd: "/home/user",
        timeoutMs: 30_000,
      }
    );

    if (tailwindCheck.exitCode !== 0) {
      appendSandboxStartupLog(
        jobId,
        "Tailwind not found after install. Running dependency self-heal..."
      );

      const heal = await sandbox.commands.run(
        "npm install --include=dev tailwindcss@^3 postcss autoprefixer --no-audit --no-fund --progress=false",
        {
          cwd: "/home/user",
          timeoutMs: 4 * 60 * 1000,
          envs: {
            CI: "true",
            npm_config_update_notifier: "false",
          },
          onStdout: (data: string) => appendSandboxStartupLog(jobId, data),
          onStderr: (data: string) =>
            appendSandboxStartupLog(jobId, `[heal] ${data}`),
        }
      );

      if (heal.exitCode !== 0) {
        const healError = heal.stderr || heal.stdout || "Dependency self-heal failed";
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
  const devProcess = await sandbox.commands.run('npm run dev', {
    cwd: '/home/user',
    background: true,
    envs: {
      CI: "true",
      NEXT_TELEMETRY_DISABLED: "1",
      PORT: "3000",
      HOSTNAME: "0.0.0.0",
      ...authPreviewEnvs,
    },
    onStdout: (data: string) => appendSandboxStartupLog(jobId, data),
    onStderr: (data: string) => appendSandboxStartupLog(jobId, `[dev] ${data}`),
  });
  appendSandboxStartupLog(jobId, `Dev server PID: ${devProcess.pid}`);

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
    .then((result) => {
      devState.result = result as {
        exitCode?: number;
        stdout?: string;
        stderr?: string;
      };
    })
    .catch((err) => {
      devState.error = err;
    });

  // Get URL and wait for server to be ready
  const url = sandbox.getHost(3000);

  // Poll URL until responding (increased to 5 minutes)
  let ready = false;
  const maxAttempts = 420; // 7 minutes

  console.log(`[Sandbox] Waiting for dev server at https://${url}...`);

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

      const res = await fetch(`https://${url}`, {
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
    // Try to get logs from the sandbox for debugging
    try {
      const logsResult = await sandbox.commands.run('tail -n 50 ~/.npm/_logs/npm-debug.log', {
        timeoutMs: 5000,
      });
      console.error('[Sandbox] npm debug logs:', logsResult.stdout || logsResult.stderr);
    } catch {
      console.error('[Sandbox] Could not fetch debug logs');
    }
    const timeoutError = `Dev server timeout after ${maxAttempts} seconds. Check sandbox logs for errors.`;
    failSandboxStartupStatus(jobId, timeoutError);
    throw new Error(timeoutError);
  }

  const finalUrl = `https://${url}`;
  completeSandboxStartupStatus(jobId, {
    sandboxId: sandbox.sandboxId,
    url: finalUrl,
  });

    return { sandboxId: sandbox.sandboxId, url: finalUrl };
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
  const sandbox = await Sandbox.connect(sandboxId, {
    apiKey: process.env.E2B_API_KEY!,
  });

  if (filesToWrite.length > 0) {
    await sandbox.files.write(
      filesToWrite.map(f => ({
        path: `/home/user/${f.path}`,
        data: f.data
      }))
    );
  }

  for (const path of filesToDelete) {
    await sandbox.files.remove(`/home/user/${path}`);
  }
}

export async function keepAliveSandbox(sandboxId: string) {
  try {
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY!,
    });
    await sandbox.setTimeout(60 * 60 * 1000); // Reset to 60 min from now
  } catch (err) {
    console.error('Error extending sandbox timeout:', err);
  }
}

export async function ensureSandboxHealthy(
  sandboxId: string,
  options?: { projectId?: string },
) {
  try {
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY!,
    });

    await sandbox.setTimeout(60 * 60 * 1000);
    const host = sandbox.getHost(3000);
    const url = `https://${host}`;

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

    await sandbox.commands.run("pkill -f \"next dev\" || true", {
      cwd: "/home/user",
      timeoutMs: 10_000,
    });

    await sandbox.commands.run("npm run dev", {
      cwd: "/home/user",
      background: true,
      envs: {
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
    const sandbox = await Sandbox.connect(sandboxId, {
      apiKey: process.env.E2B_API_KEY!,
    });
    await sandbox.kill();
  } catch (err) {
    // Sandbox might already be closed or timed out
    console.error('Error closing sandbox:', err);
  }
}

