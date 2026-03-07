import { NextRequest, NextResponse } from "next/server";
import { createProjectCache, deleteProjectCache } from "@/lib/gemini-cache";

/** POST /api/gemini-cache — create a cache for the given project files */
export async function POST(req: NextRequest) {
  try {
    const { files } = (await req.json()) as {
      files: Array<{ path: string; content: string }>;
    };

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "files required" }, { status: 400 });
    }

    const cacheName = await createProjectCache(files);
    return NextResponse.json({ cacheName }); // cacheName may be null if unsupported
  } catch (err) {
    console.error("[GeminiCache API] POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** DELETE /api/gemini-cache — delete an existing cache */
export async function DELETE(req: NextRequest) {
  try {
    const { cacheName } = (await req.json()) as { cacheName: string };

    if (!cacheName) {
      return NextResponse.json({ error: "cacheName required" }, { status: 400 });
    }

    await deleteProjectCache(cacheName);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[GeminiCache API] DELETE error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
