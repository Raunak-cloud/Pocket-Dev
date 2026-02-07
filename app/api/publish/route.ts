import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { files, sandboxId } = await request.json();

    if (!files || typeof files !== "object") {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Format files for CodeSandbox API
    const sandboxFiles: Record<string, { content: string }> = {};

    for (const [path, content] of Object.entries(files)) {
      sandboxFiles[path] = { content: content as string };
    }

    // Always create/update sandbox using CodeSandbox's define API
    // Note: If sandboxId exists, we're republishing with changes
    const response = await fetch(
      "https://codesandbox.io/api/v1/sandboxes/define?json=1",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          files: sandboxFiles,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("CodeSandbox API error:", response.status, errorText);
      throw new Error(`CodeSandbox API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.sandbox_id) {
      console.error("No sandbox_id in response:", data);
      throw new Error("No sandbox_id returned");
    }

    const newSandboxId = data.sandbox_id;
    const sandboxUrl = `https://codesandbox.io/s/${newSandboxId}`;
    const previewUrl = `https://${newSandboxId}.csb.app/`;

    return NextResponse.json({
      success: true,
      url: previewUrl,
      editorUrl: sandboxUrl,
      sandboxId: newSandboxId,
      isUpdate: !!sandboxId, // Let the client know if this was an update
    });
  } catch (error) {
    console.error("Publish error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish" },
      { status: 500 },
    );
  }
}
