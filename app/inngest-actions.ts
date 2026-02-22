/**
 * Inngest Server Actions
 *
 * Server-side actions for triggering Inngest workflows
 */

"use server";

import { INNGEST_APP_ID, inngest } from "@/lib/inngest-client";

/**
 * Trigger AI code generation workflow
 */
export async function triggerCodeGeneration(
  prompt: string,
  userId: string,
  projectId: string
) {
  const sendResult = await inngest.send({
    name: "app/generate.code",
    data: {
      prompt,
      userId,
      projectId,
    },
  });

  return { success: true, projectId, eventIds: sendResult.ids ?? [] };
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
  let localCancelled = false;
  let remoteCancelled = false;

  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/inngest/status`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        cancel: true,
      }),
    });

    if (response.ok) {
      localCancelled = true;
    } else {
      console.error(
        "Failed to mark local cancellation:",
        await response.text(),
      );
    }
  } catch (error) {
    console.error("Failed to call local cancellation endpoint:", error);
  }

  const signingKey = process.env.INNGEST_SIGNING_KEY;
  if (signingKey) {
    const escapedProjectId = projectId
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');

    const now = Date.now();
    const startedAfter = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const startedBefore = new Date(now + 24 * 60 * 60 * 1000).toISOString();

    try {
      const cancellationResponse = await fetch(
        "https://api.inngest.com/v1/cancellations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${signingKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            if: `event.data.projectId == "${escapedProjectId}"`,
            app_id: process.env.INNGEST_APP_ID || INNGEST_APP_ID,
            function_id: "generate-code",
            started_after: startedAfter,
            started_before: startedBefore,
          }),
        },
      );

      if (cancellationResponse.ok) {
        remoteCancelled = true;
      } else {
        console.error(
          "Failed to cancel Inngest run:",
          await cancellationResponse.text(),
        );
      }
    } catch (error) {
      console.error("Failed to call Inngest cancellations API:", error);
    }
  } else {
    console.warn(
      "INNGEST_SIGNING_KEY is not set; skipping remote Inngest cancellation API call.",
    );
  }

  return {
    success: localCancelled || remoteCancelled,
    localCancelled,
    remoteCancelled,
  };
}
