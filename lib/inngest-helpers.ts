/**
 * Inngest Helper Functions
 *
 * Client-side utilities for triggering Inngest workflows and polling for results
 */

"use client";

import {
  triggerCodeGeneration as triggerCodeGenerationAction,
  triggerImageProcessing as triggerImageProcessingAction,
} from "@/app/inngest-actions";

import type { SiteTheme } from "@/app/types";

interface GeneratedFile {
  path: string;
  content: string;
}

interface GenerateCodeResult {
  files: GeneratedFile[];
  dependencies: Record<string, string>;
  lintReport: {
    passed: boolean;
    errors: number;
    warnings: number;
  };
  model: string;
  projectId?: string;
  originalPrompt?: string;
  detectedTheme?: SiteTheme;
  sandboxId?: string;
}

/**
 * Poll for workflow completion — no client-side timeout.
 * Resolves when Inngest completes, rejects only when Inngest fails or job is cancelled.
 */
async function pollForCompletion<T>(
  projectId: string,
  event: string,
  onProgress?: (message: string) => void
): Promise<T> {
  const fetchStatus = async () => {
    const response = await fetch(
      `/api/inngest/status?projectId=${projectId}&event=${event}`
    );
    if (!response.ok) return null;
    return response.json();
  };

  return new Promise((resolve, reject) => {
    let lastProgressCount = 0;
    let lastForwardedMessage = "";
    let consecutiveFetchErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 10;

    const interval = setInterval(async () => {
      try {
        const data = await fetchStatus();
        if (!data) {
          consecutiveFetchErrors++;
          if (consecutiveFetchErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.error(`[Inngest Poll] ${MAX_CONSECUTIVE_ERRORS} consecutive fetch failures — giving up`);
            clearInterval(interval);
            reject(new Error('Lost connection to generation server. Please try again.'));
          }
          return;
        }

        // Reset error counter on successful fetch
        consecutiveFetchErrors = 0;

        console.log('[Inngest Poll]', { projectId, event, data });

        // Job cancelled by user
        if (data.cancelled) {
          console.log('[Inngest Poll] Job cancelled by user');
          clearInterval(interval);
          reject(new Error('Generation cancelled by user'));
          return;
        }

        // Job failed in Inngest after all retries exhausted
        if (data.failed) {
          console.log('[Inngest Poll] Job failed:', data.error);
          clearInterval(interval);
          reject(new Error(data.error ?? 'Generation failed'));
          return;
        }

        // Forward progress messages
        if (Array.isArray(data.progress)) {
          const newProgress = data.progress.slice(lastProgressCount);
          lastProgressCount = data.progress.length;
          newProgress.forEach((msg: string) => {
            if (msg !== lastForwardedMessage) {
              onProgress?.(msg);
              lastForwardedMessage = msg;
            }
          });
        }

        // Completed
        if (data.completed !== false) {
          console.log('[Inngest Poll] Workflow completed!', data);
          clearInterval(interval);
          resolve(data as T);
        }
      } catch (err) {
        console.error('[Inngest Poll] Error:', err);
        consecutiveFetchErrors++;
        if (consecutiveFetchErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error(`[Inngest Poll] ${MAX_CONSECUTIVE_ERRORS} consecutive errors — giving up`);
          clearInterval(interval);
          reject(new Error('Lost connection to generation server. Please try again.'));
        }
      }
    }, 1000);
  });
}

/**
 * Trigger AI code generation workflow
 */
export async function generateCodeWithInngest(
  prompt: string,
  userId: string,
  onProgress?: (message: string) => void,
  onRunStart?: (projectId: string) => void,
  fixedProjectId?: string,
  integrationRequirements?: {
    requiresAuth?: boolean;
    requiresDatabase?: boolean;
    requiresGoogleOAuth?: boolean;
    requiresPasswordAuth?: boolean;
    requiresPayments?: boolean;
  },
  projectType?: "website" | "dashboard",
): Promise<GenerateCodeResult> {
  const projectId =
    fixedProjectId && fixedProjectId.trim().length > 0
      ? fixedProjectId.trim()
      : `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  onRunStart?.(projectId);

  onProgress?.("[0/7] Queueing generation job...");

  // Clear any stale completion/progress state for this project before triggering a new run.
  await fetch("/api/inngest/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      reset: true,
    }),
  }).catch(() => {
    // Best-effort cleanup; polling will still run even if reset request fails.
  });

  // Trigger workflow
  await triggerCodeGenerationAction(
    prompt,
    userId,
    projectId,
    integrationRequirements,
    projectType,
  );

  onProgress?.("[0/7] Generation started. Waiting for first update...");

  // Poll for completion — no timeout, fails only if Inngest fails
  const result = await pollForCompletion<GenerateCodeResult>(
    projectId,
    "generate.completed",
    onProgress
  );

  onProgress?.("[7/7] Generation complete.");

  // Include projectId in result for tracking
  return { ...result, projectId };
}

/**
 * Trigger image processing workflow
 */
export async function processImagesWithInngest(
  files: GeneratedFile[],
  userId: string,
  onProgress?: (message: string) => void
): Promise<{ files: GeneratedFile[] }> {
  const projectId = `images_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  onProgress?.("Processing images...");

  // Trigger workflow
  await triggerImageProcessingAction(files, userId, projectId);

  // Poll for completion
  const result = await pollForCompletion<{ files: GeneratedFile[] }>(
    projectId,
    "images.processed",
    onProgress
  );

  onProgress?.("Images processed!");

  return result;
}
