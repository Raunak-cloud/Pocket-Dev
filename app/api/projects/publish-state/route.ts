import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { clerkUserId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      projectId,
      isPublished,
      publishedUrl,
      deploymentId,
      publishedAt,
      customDomain,
    } = body;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(typeof isPublished === "boolean" ? { isPublished } : {}),
        ...(publishedUrl !== undefined ? { publishedUrl } : {}),
        ...(deploymentId !== undefined ? { deploymentId } : {}),
        ...(publishedAt !== undefined
          ? { publishedAt: publishedAt ? new Date(publishedAt) : null }
          : {}),
        ...(customDomain !== undefined ? { customDomain } : {}),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUT /api/projects/publish-state] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
