import { NextResponse } from "next/server";
import { auth } from "@/lib/supabase-auth/server";
import { getActiveRunByAuthUserId } from "@/lib/server/inngest-active-runs";

export async function GET() {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeRun = await getActiveRunByAuthUserId(authUserId);
    if (!activeRun) {
      return NextResponse.json({ activeRun: null });
    }

    return NextResponse.json({
      activeRun: {
        mode: activeRun.mode,
        runId: activeRun.runId,
        prompt: activeRun.prompt,
        userId: activeRun.authUserId,
        backendEnabled: activeRun.backendEnabled,
        paymentsEnabled: activeRun.paymentsEnabled,
        startedAt: activeRun.startedAt.getTime(),
        projectId: activeRun.sourceProjectId,
      },
    });
  } catch (error) {
    console.error("[GET /api/inngest/active-run] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch active run" },
      { status: 500 },
    );
  }
}
