import { NextRequest, NextResponse } from "next/server";
import { INNGEST_APP_ID, inngest } from "@/lib/inngest-client";

type CancelRequestBody = {
  projectId?: string;
  reason?: string;
};

type CancellationPayload = {
  if: string;
  app_id: string;
  started_after: string;
  started_before: string;
  function_id?: string;
};

type RemoteAttemptResult = {
  ok: boolean;
  payload: CancellationPayload;
  responseText: string;
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

async function requestRemoteCancellation(
  signingKey: string,
  payload: CancellationPayload,
): Promise<RemoteAttemptResult> {
  const response = await fetch("https://api.inngest.com/v1/cancellations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${signingKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  return {
    ok: response.ok,
    payload,
    responseText,
  };
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
  let eventCancelled = false;
  let remoteCancelled = false;
  const remoteAttempts: RemoteAttemptResult[] = [];

  // Local cancellation marker for client polling.
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

  // Official, deterministic cancellation path:
  // emit a cancellation event and rely on `cancelOn` in the target functions.
  try {
    const sendResult = await inngest.send({
      name: "app/generate.cancelled",
      data: {
        projectId,
        reason: body.reason || "manual",
      },
    });
    eventCancelled = Array.isArray(sendResult.ids) && sendResult.ids.length > 0;
  } catch (error) {
    console.error("[Inngest Cancel API] Failed to send cancellation event:", error);
  }

  // Official Inngest cancellation API
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
      // Try the most specific targets first, then broader fallback.
      const functionIds = [
        `${appId}-generate-code`,
        "generate-code",
        `${appId}-generate-images`,
        "generate-images",
      ];

      for (const functionId of functionIds) {
        const attempt = await requestRemoteCancellation(signingKey, {
          if: condition,
          app_id: appId,
          function_id: functionId,
          started_after: startedAfter,
          started_before: startedBefore,
        });
        remoteAttempts.push(attempt);
        if (attempt.ok) {
          remoteCancelled = true;
        }
      }

      // Broad fallback: no function_id filter, cancel any matching run in app.
      const broadAttempt = await requestRemoteCancellation(signingKey, {
        if: condition,
        app_id: appId,
        started_after: startedAfter,
        started_before: startedBefore,
      });
      remoteAttempts.push(broadAttempt);
      if (broadAttempt.ok) {
        remoteCancelled = true;
      }

      if (!remoteCancelled) {
        for (const attempt of remoteAttempts) {
          console.error(
            "[Inngest Cancel API] Remote cancellation failed:",
            {
              payload: attempt.payload,
              response: attempt.responseText,
            },
          );
        }
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
    success: localCancelled || eventCancelled || remoteCancelled,
    localCancelled,
    eventCancelled,
    remoteCancelled,
    remoteAttemptCount: remoteAttempts.length,
    projectId,
    reason: body.reason || null,
  });
}
