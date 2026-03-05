import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/supabase-auth/server";
import { prisma } from "@/lib/prisma";
import { encryptApiKey } from "@/lib/crypto";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** GET /api/user-apis?projectId=xxx — list APIs for a project (no apiKey in response) */
export async function GET(request: NextRequest) {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Verify ownership
    const user = await prisma.user.findUnique({ where: { authUserId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });
    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const apis = await prisma.customApi.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        slug: true,
        baseUrl: true,
        authType: true,
        authHeaderName: true,
        authParamName: true,
        description: true,
        createdAt: true,
        // apiKey intentionally omitted
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ apis });
  } catch (error) {
    console.error("[user-apis GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/user-apis — create a new custom API */
export async function POST(request: NextRequest) {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, name, baseUrl, authType, authHeaderName, authParamName, apiKey, description } = body;

    if (!projectId || !name || !baseUrl || !authType) {
      return NextResponse.json({ error: "projectId, name, baseUrl, and authType are required" }, { status: 400 });
    }

    const validAuthTypes = ["api_key_header", "bearer_token", "query_param", "none"];
    if (!validAuthTypes.includes(authType)) {
      return NextResponse.json({ error: "Invalid authType" }, { status: 400 });
    }

    try { new URL(baseUrl); } catch {
      return NextResponse.json({ error: "Invalid baseUrl" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { authUserId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });
    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Auto-generate unique slug
    let slug = toSlug(name) || "api";
    const existing = await prisma.customApi.findMany({
      where: { projectId },
      select: { slug: true },
    });
    const existingSlugs = new Set(existing.map((a) => a.slug));
    if (existingSlugs.has(slug)) {
      let i = 2;
      while (existingSlugs.has(`${slug}-${i}`)) i++;
      slug = `${slug}-${i}`;
    }

    const encryptedKey = apiKey && authType !== "none" ? encryptApiKey(apiKey) : null;

    const api = await prisma.customApi.create({
      data: {
        projectId,
        name,
        slug,
        baseUrl,
        authType,
        authHeaderName: authHeaderName || null,
        authParamName: authParamName || null,
        apiKey: encryptedKey,
        description: description || null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        baseUrl: true,
        authType: true,
        authHeaderName: true,
        authParamName: true,
        description: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ api }, { status: 201 });
  } catch (error) {
    console.error("[user-apis POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE /api/user-apis?id=xxx&projectId=xxx */
export async function DELETE(request: NextRequest) {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id");
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!id || !projectId) {
      return NextResponse.json({ error: "id and projectId are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { authUserId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });
    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await prisma.customApi.deleteMany({ where: { id, projectId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[user-apis DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
