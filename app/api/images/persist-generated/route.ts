import { NextResponse } from "next/server";
import { auth } from "@/lib/supabase-auth/server";
import { persistGeneratedImagesToStorage } from "@/lib/server/persist-generated-images";

interface GeneratedFile {
  path: string;
  content: string;
}

function isGeneratedFileArray(value: unknown): value is GeneratedFile[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as { path?: unknown }).path === "string" &&
      typeof (entry as { content?: unknown }).content === "string",
  );
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (!body || !isGeneratedFileArray((body as { files?: unknown }).files)) {
      return NextResponse.json(
        { error: "Invalid payload: files[] is required" },
        { status: 400 },
      );
    }

    const files = (body as { files: GeneratedFile[] }).files;
    const persistedFiles = await persistGeneratedImagesToStorage(files, userId);
    return NextResponse.json({ files: persistedFiles });
  } catch (error) {
    console.error("[POST /api/images/persist-generated] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to persist generated images",
      },
      { status: 500 },
    );
  }
}
