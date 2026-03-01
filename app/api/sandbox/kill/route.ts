import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { sandboxId } = await request.json();

  if (!sandboxId || sandboxId === "create-new" || !process.env.E2B_API_KEY) {
    return NextResponse.json(
      { error: "Missing sandboxId or E2B_API_KEY" },
      { status: 400 },
    );
  }

  try {
    const { Sandbox } = await import("e2b");
    const sandbox = await Sandbox.connect(sandboxId);
    await sandbox.kill();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Sandbox Kill] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to kill sandbox" },
      { status: 500 },
    );
  }
}
