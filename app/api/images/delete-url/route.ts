import { NextResponse } from "next/server";
import { auth } from "@/lib/supabase-auth/server";
import { deleteGeneratedStorageUrls } from "@/lib/server/image-storage-cleanup";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }

    // deleteGeneratedStorageUrls validates bucket + host — safe to call with any URL
    await deleteGeneratedStorageUrls([url]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/images/delete-url] Error:", error);
    // Non-fatal — callers use fire-and-forget
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 },
    );
  }
}
