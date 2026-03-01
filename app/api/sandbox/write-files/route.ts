import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { sandboxId, files } = await request.json();

  if (!sandboxId || !process.env.E2B_API_KEY) {
    return NextResponse.json(
      { error: "Missing sandboxId or E2B_API_KEY" },
      { status: 400 },
    );
  }

  try {
    const { Sandbox } = await import("e2b");
    const sandbox = await Sandbox.connect(sandboxId);

    for (const { path, content } of files as { path: string; content: string }[]) {
      await sandbox.files.write(`/home/user/project/${path}`, content);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Sandbox Write] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to write files" },
      { status: 500 },
    );
  }
}
