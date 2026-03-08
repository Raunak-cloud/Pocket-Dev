import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/supabase-auth/server";
import {
  consumeLatestCompletionNotice,
  markCompletionNoticeViewed,
} from "@/lib/server/inngest-completion-notices";

export async function GET() {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notice = await consumeLatestCompletionNotice(authUserId);
    if (!notice) {
      return NextResponse.json({ notice: null });
    }

    return NextResponse.json({
      notice: {
        runId: notice.runId,
        mode: notice.mode,
        message: notice.message,
        createdAt: notice.createdAt.getTime(),
      },
    });
  } catch (error) {
    console.error("[GET /api/inngest/completion-notice] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch completion notice" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      runId?: string;
    };
    const runId =
      typeof body.runId === "string" ? body.runId.trim() : "";
    if (!runId) {
      return NextResponse.json({ error: "Missing runId" }, { status: 400 });
    }

    await markCompletionNoticeViewed(authUserId, runId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/inngest/completion-notice] Error:", error);
    return NextResponse.json(
      { error: "Failed to mark notice viewed" },
      { status: 500 },
    );
  }
}
