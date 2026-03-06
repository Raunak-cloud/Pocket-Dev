import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/supabase-auth/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";

async function assertAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  const authUser = await currentUser();
  return authUser?.email === ADMIN_EMAIL;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { userId } = await params;
    const body = await req.json();
    const { banned, bannedReason } = body;

    const updateData: Record<string, unknown> = {};

    if (typeof banned === "boolean") {
      updateData.banned = banned;
      updateData.bannedAt = banned ? new Date() : null;
      updateData.bannedReason = banned ? (bannedReason || null) : null;
    }

    const updated = await withPrismaRetry(() =>
      prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          banned: true,
          bannedAt: true,
          bannedReason: true,
        },
      })
    );

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error("[PATCH /api/admin/users/[userId]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
