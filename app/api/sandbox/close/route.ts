import { NextRequest, NextResponse } from "next/server";
import { closeSandbox } from "@/app/sandbox-actions";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sandboxId } = body;

    if (!sandboxId || typeof sandboxId !== "string") {
      return NextResponse.json(
        { error: "Invalid sandboxId" },
        { status: 400 }
      );
    }

    console.log(`[API] Closing sandbox ${sandboxId}`);
    await closeSandbox(sandboxId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error closing sandbox:", error);
    return NextResponse.json(
      { error: "Failed to close sandbox" },
      { status: 500 }
    );
  }
}
