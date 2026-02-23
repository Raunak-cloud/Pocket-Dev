import { NextRequest, NextResponse } from "next/server";
import { INNGEST_APP_ID } from "@/lib/inngest-client";

type CancelRequestBody = {
  projectId?: string;
  reason?: string;
};

function parseCancelBody(raw: string): CancelRequestBody {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as CancelRequestBody)
      : {};
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const body = parseCancelBody(rawBody);
  const projectId = String(body.projectId || "").trim();

  if (!projectId) {
    return NextResponse.json(
      { success: false, error: "projectId is required" },
      { status: 400 },
    );
  }

  let localCancelled = false;
  let remoteCancelled = false;

  // Local cancellation for in-memory poll state
  try {
    const localCancelUrl = new URL("/api/inngest/status", request.url).toString();
    const response = await fetch(localCancelUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, cancel: true }),
      cache: "no-store",
    });
    localCancelled = response.ok;
  } catch (error) {
    console.error("[Inngest Cancel API] Local cancellation failed:", error);
  }

  // Official Inngest cancellation API
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
          "[Inngest Cancel API] Remote cancellation failed:",
          await cancellationResponse.text(),
        );
      }
    } catch (error) {
      console.error("[Inngest Cancel API] Remote cancellation error:", error);
    }
  } else {
    console.warn(
      "[Inngest Cancel API] INNGEST_SIGNING_KEY is not set; remote cancellation skipped.",
    );
  }

  return NextResponse.json({
    success: localCancelled || remoteCancelled,
    localCancelled,
    remoteCancelled,
    projectId,
    reason: body.reason || null,
  });
}

