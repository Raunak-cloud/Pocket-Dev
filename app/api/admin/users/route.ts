import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/supabase-auth/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";

async function assertAdmin() {
  const { userId } = await auth();
  if (!userId) return false;
  const authUser = await currentUser();
  return authUser?.email === ADMIN_EMAIL;
}

export async function GET() {
  try {
    if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const users = await withPrismaRetry(() =>
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          authUserId: true,
          email: true,
          displayName: true,
          photoURL: true,
          createdAt: true,
          lastLoginAt: true,
          projectCount: true,
          appTokens: true,
          integrationTokens: true,
          banned: true,
          bannedAt: true,
          bannedReason: true,
          _count: { select: { projects: { where: { deleted: false } } } },
        },
      })
    );

    return NextResponse.json({ users });
  } catch (error) {
    console.error("[GET /api/admin/users]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
