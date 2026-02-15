import { NextResponse } from "next/server";
import { auth } from "@/lib/supabase-auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "uploads";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const files = formData.getAll("files").filter((f) => f instanceof File) as File[];
    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const uploaded: Array<{ name: string; url: string; size: number }> = [];

    for (const file of files) {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext ? `.${ext}` : ""}`;
      const bytes = Buffer.from(await file.arrayBuffer());

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, {
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });

      if (error) {
        throw new Error(error.message);
      }

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      uploaded.push({
        name: file.name,
        url: pub.publicUrl,
        size: file.size,
      });
    }

    return NextResponse.json({ files: uploaded });
  } catch (error) {
    console.error("[POST /api/uploads] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}

