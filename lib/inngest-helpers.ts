/**
 * Inngest Helper Functions
 *
 * Client-side utilities for triggering Inngest workflows and polling for results
 */

"use client";

import {
  triggerCodeGeneration as triggerCodeGenerationAction,
  triggerSandboxCreation as triggerSandboxCreationAction,
  triggerImageProcessing as triggerImageProcessingAction,
} from "@/app/inngest-actions";

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
  projectId?: string; // Include projectId for cancellation tracking
}

interface CreateSandboxResult {
  sandboxId: string;
  url: string;
}

const DEFAULT_GENERATE_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Poll for workflow completion
 */
async function pollForCompletion<T>(
  projectId: string,
  event: string,
  timeoutMs: number,
  onProgress?: (message: string) => void
): Promise<T> {
  const fetchStatus = async () => {
    const response = await fetch(
      `/api/inngest/status?projectId=${projectId}&event=${event}`
    );

    if (!response.ok) {
      return null;
    }

    return response.json();
  };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(async () => {
      clearInterval(interval);

      try {
        const data = await fetchStatus();
        if (data && data.completed !== false && !data.cancelled) {
          resolve(data as T);
          return;
        }
      } catch {
        // Fall through to timeout error.
      }

      reject(new Error(`Workflow timeout after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);

    let lastProgressCount = 0;
    let lastForwardedMessage = "";

    const interval = setInterval(async () => {
      try {
        const data = await fetchStatus();
        if (data) {
          console.log('[Inngest Poll]', { projectId, event, data });

          // Check if job was cancelled
          if (data.cancelled) {
            console.log('[Inngest Poll] Job cancelled by user');
            clearInterval(interval);
            clearTimeout(timeout);
            reject(new Error('Generation cancelled by user'));
            return;
          }

          // Handle progress updates
          if (data.progress && Array.isArray(data.progress)) {
            const newProgress = data.progress.slice(lastProgressCount);
            lastProgressCount = data.progress.length;

            // Send new progress messages to callback
            newProgress.forEach((msg: string) => {
              if (msg !== lastForwardedMessage) {
                onProgress?.(msg);
                lastForwardedMessage = msg;
              }
            });
          }

          // If we got data and it's not the "still waiting" response
          if (data && data.completed !== false) {
            console.log('[Inngest Poll] Workflow completed!', data);
            clearInterval(interval);
            clearTimeout(timeout);
            resolve(data as T);
          }
        }
      } catch (err) {
        console.error('[Inngest Poll] Error:', err);
      }
    }, 2000);
  });
}

/**
 * Trigger AI code generation workflow
 */
export async function generateCodeWithInngest(
  prompt: string,
  userId: string,
  onProgress?: (message: string) => void
): Promise<GenerateCodeResult> {
  const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  onProgress?.("[0/7] Queueing generation job...");

  // Trigger workflow
  await triggerCodeGenerationAction(prompt, userId, projectId);

  onProgress?.("[0/7] Generation started. Waiting for first update...");

  const configuredGenerateTimeout = Number(
    process.env.NEXT_PUBLIC_INNGEST_GENERATE_TIMEOUT_MS
  );
  const generateTimeoutMs =
    Number.isFinite(configuredGenerateTimeout) && configuredGenerateTimeout > 0
      ? configuredGenerateTimeout
      : DEFAULT_GENERATE_TIMEOUT_MS;

  // Poll for completion
  const result = await pollForCompletion<GenerateCodeResult>(
    projectId,
    "generate.completed",
    generateTimeoutMs,
    onProgress
  );

  onProgress?.("[7/7] Generation complete.");

  // Include projectId in result for tracking
  return { ...result, projectId };
}

/**
 * Trigger sandbox creation workflow
 */
export async function createSandboxWithInngest(
  files: Record<string, string>,
  userId: string,
  onProgress?: (message: string) => void
): Promise<CreateSandboxResult> {
  const projectId = `sandbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  onProgress?.("Creating sandbox...");

  // Trigger workflow
  await triggerSandboxCreationAction(files, userId, projectId);

  onProgress?.("Installing dependencies...");

  // Poll for completion
  const result = await pollForCompletion<CreateSandboxResult>(
    projectId,
    "sandbox.ready",
    3 * 60 * 1000, // 3 minutes
    onProgress
  );

  onProgress?.("Sandbox ready!");

  return result;
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
    2 * 60 * 1000, // 2 minutes
    onProgress
  );

  onProgress?.("Images processed!");

  return result;
}
