/**
 * Inngest Server Actions
 *
 * Server-side actions for triggering Inngest workflows
 */

"use server";

import { INNGEST_APP_ID, inngest } from "@/lib/inngest-client";
import { getInngestStatusApiUrl } from "@/lib/server/app-base-url";
import { prisma } from "@/lib/prisma";

/**
 * Trigger AI code generation workflow
 */
export async function triggerCodeGeneration(
  prompt: string,
  userId: string,
  projectId: string,
  integrationRequirements?: {
    requiresAuth?: boolean;
    requiresDatabase?: boolean;
    requiresGoogleOAuth?: boolean;
    requiresPasswordAuth?: boolean;
    requiresPayments?: boolean;
  },
  projectType?: "website" | "dashboard",
  imageOptions?: {
    preserveExistingImages?: boolean;
    previousImageUrls?: string[];
  },
  customApis?: Array<{ name: string; slug: string; baseUrl: string; description?: string | null }>,
  userInstruction?: string,
  pdfAttachments?: Array<{ name: string; url: string }>,
) {
  // Enforce per-user ban and system-level feature restrictions
  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";
  const [dbUser, systemConfig] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { banned: true, email: true },
    }),
    prisma.maintenance.findUnique({
      where: { id: 1 },
      select: { backendDisabled: true, paymentsDisabled: true, apisDisabled: true },
    }),
  ]);

  if (dbUser?.banned) {
    return { success: false, error: "Your account has been suspended. Please contact support.", projectId, eventIds: [] };
  }

  // Admin is exempt from all system-level feature restrictions
  const isAdmin = ADMIN_EMAIL && dbUser?.email === ADMIN_EMAIL;

  let effectiveIntegrations = integrationRequirements;
  if (!isAdmin && systemConfig?.backendDisabled && effectiveIntegrations) {
    effectiveIntegrations = {
      ...effectiveIntegrations,
      requiresAuth: false,
      requiresDatabase: false,
      requiresGoogleOAuth: false,
      requiresPasswordAuth: false,
    };
  }
  if (!isAdmin && systemConfig?.paymentsDisabled && effectiveIntegrations) {
    effectiveIntegrations = { ...effectiveIntegrations, requiresPayments: false };
  }
  const effectiveCustomApis = (!isAdmin && systemConfig?.apisDisabled) ? [] : customApis;

  const sendResult = await inngest.send({
    name: "app/generate.code",
    data: {
      prompt,
      userId,
      projectId,
      integrationRequirements: effectiveIntegrations,
      projectType,
      preserveExistingImages: imageOptions?.preserveExistingImages,
      previousImageUrls: imageOptions?.previousImageUrls,
      customApis: effectiveCustomApis,
      userInstruction,
      pdfAttachments,
    },
  });

  return { success: true, projectId, eventIds: sendResult.ids ?? [] };
}

/**
 * Cancel a running generation job
 */
export async function cancelGenerationJob(projectId: string) {
  let localCancelled = false;
  let eventCancelled = false;
  let remoteCancelled = false;

  try {
    const response = await fetch(getInngestStatusApiUrl(), {
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

  // Deterministic cancellation path using cancel event + function-level cancelOn.
  try {
    const sendResult = await inngest.send({
      name: "app/generate.cancelled",
      data: {
        projectId,
        reason: "manual",
      },
    });
    eventCancelled = Array.isArray(sendResult.ids) && sendResult.ids.length > 0;
  } catch (error) {
    console.error("Failed to send cancellation event:", error);
  }

  const signingKey = process.env.INNGEST_SIGNING_KEY;
  if (signingKey) {
    const escapedProjectId = projectId
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');
    const appId = process.env.INNGEST_APP_ID || INNGEST_APP_ID;

    const now = Date.now();
    const startedAfter = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const startedBefore = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    const condition = [
      `event.data.projectId == "${escapedProjectId}"`,
      `event.data.data.projectId == "${escapedProjectId}"`,
      `event.projectId == "${escapedProjectId}"`,
    ].join(" || ");

    try {
      const functionIds = [
        `${appId}-generate-code`,
        "generate-code",
        `${appId}-generate-images`,
        "generate-images",
      ];

      for (const functionId of functionIds) {
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
              if: condition,
              app_id: appId,
              function_id: functionId,
              started_after: startedAfter,
              started_before: startedBefore,
            }),
          },
        );

        if (cancellationResponse.ok) {
          remoteCancelled = true;
        } else {
          console.error(
            "Failed to cancel Inngest run (function filter):",
            functionId,
            await cancellationResponse.text(),
          );
        }
      }

      const broadResponse = await fetch(
        "https://api.inngest.com/v1/cancellations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${signingKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            if: condition,
            app_id: appId,
            started_after: startedAfter,
            started_before: startedBefore,
          }),
        },
      );

      if (broadResponse.ok) {
        remoteCancelled = true;
      } else {
        console.error(
          "Failed to cancel Inngest run (broad):",
          await broadResponse.text(),
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
    success: localCancelled || eventCancelled || remoteCancelled,
    localCancelled,
    eventCancelled,
    remoteCancelled,
  };
}
