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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { userId } = await params;

    const projects = await withPrismaRetry(() =>
      prisma.project.findMany({
        where: { userId, deleted: false },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          prompt: true,
          files: true,
          dependencies: true,
          lintReport: true,
          config: true,
          createdAt: true,
          updatedAt: true,
          isPublished: true,
          publishedUrl: true,
          deploymentId: true,
          publishedAt: true,
          customDomain: true,
          tier: true,
          paidAt: true,
        },
      })
    );

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("[GET /api/admin/users/[userId]/projects]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
