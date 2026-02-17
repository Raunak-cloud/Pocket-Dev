/**
 * Inngest Server Actions
 *
 * Server-side actions for triggering Inngest workflows
 */

"use server";

import { inngest } from "@/lib/inngest-client";

/**
 * Trigger AI code generation workflow
 */
export async function triggerCodeGeneration(
  prompt: string,
  userId: string,
  projectId: string
) {
  await inngest.send({
    name: "app/generate.code",
    data: {
      prompt,
      userId,
      projectId,
    },
  });

  return { success: true, projectId };
}

/**
 * Trigger sandbox creation workflow
 */
export async function triggerSandboxCreation(
  files: Record<string, string>,
  userId: string,
  projectId: string
) {
  await inngest.send({
    name: "app/sandbox.create",
    data: {
      files,
      userId,
      projectId,
    },
  });

  return { success: true, projectId };
}

/**
 * Trigger image processing workflow
 */
export async function triggerImageProcessing(
  files: Array<{ path: string; content: string }>,
  userId: string,
  projectId: string
) {
  await inngest.send({
    name: "app/images.process",
    data: {
      files,
      userId,
      projectId,
    },
  });

  return { success: true, projectId };
}

/**
 * Cancel a running generation job
 */
export async function cancelGenerationJob(projectId: string) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/inngest/status`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      cancel: true,
    }),
  });

  if (!response.ok) {
    console.error("Failed to cancel job:", await response.text());
    return { success: false };
  }

  return { success: true };
}
