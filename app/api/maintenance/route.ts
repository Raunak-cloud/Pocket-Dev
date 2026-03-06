import { auth, currentUser } from "@/lib/supabase-auth/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";

export async function GET() {
  try {
    const row = await prisma.maintenance.findUnique({ where: { id: 1 } });
    if (!row) {
      return NextResponse.json({ enabled: false, backendDisabled: false, paymentsDisabled: false, apisDisabled: false });
    }
    return NextResponse.json({
      enabled: row.enabled,
      message: row.message,
      lastUpdatedAt: row.updatedAt,
      backendDisabled: row.backendDisabled,
      paymentsDisabled: row.paymentsDisabled,
      apisDisabled: row.apisDisabled,
    });
  } catch (error) {
    console.error("[GET /api/maintenance] Error:", error);
    return NextResponse.json({ enabled: false, backendDisabled: false, paymentsDisabled: false, apisDisabled: false });
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

    const updateData: Record<string, unknown> = {};

    if ("enabled" in body) {
      updateData.enabled = Boolean(body.enabled);
      updateData.message =
        typeof body.message === "string" && body.message.trim()
          ? body.message.trim()
          : "System is currently under maintenance. Please check back soon.";
    }
    if ("backendDisabled" in body) updateData.backendDisabled = Boolean(body.backendDisabled);
    if ("paymentsDisabled" in body) updateData.paymentsDisabled = Boolean(body.paymentsDisabled);
    if ("apisDisabled" in body) updateData.apisDisabled = Boolean(body.apisDisabled);

    await prisma.maintenance.upsert({
      where: { id: 1 },
      update: updateData,
      create: { id: 1, enabled: false, backendDisabled: false, paymentsDisabled: false, apisDisabled: false, ...updateData },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/maintenance] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}



