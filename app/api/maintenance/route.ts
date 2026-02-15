import { auth, currentUser } from "@/lib/supabase-auth/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";

export async function GET() {
  try {
    const row = await prisma.maintenance.findUnique({ where: { id: 1 } });
    if (!row) {
      return NextResponse.json({ enabled: false });
    }
    return NextResponse.json({
      enabled: row.enabled,
      message: row.message,
      lastUpdatedAt: row.updatedAt,
    });
  } catch (error) {
    console.error("[GET /api/maintenance] Error:", error);
    return NextResponse.json({ enabled: false });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authUser = await currentUser();
    const email = authUser?.email || "";
    if (email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const enabled = Boolean(body.enabled);
    const message =
      typeof body.message === "string" && body.message.trim()
        ? body.message.trim()
        : "System is currently under maintenance. Please check back soon.";

    await prisma.maintenance.upsert({
      where: { id: 1 },
      update: { enabled, message },
      create: { id: 1, enabled, message },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/maintenance] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}



