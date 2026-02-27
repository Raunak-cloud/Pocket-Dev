/**
 * GET /api/projects/backend-info?projectId=<id>
 *
 * Returns the Supabase backend credentials and existing schema SQL for a project.
 */
import { auth } from "@/lib/supabase-auth/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthConfigForBindingKey } from "@/lib/supabase-project-pool";

export async function GET(req: Request) {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { authUserId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify the requesting user owns the project.
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id, deleted: false },
      select: { id: true, files: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const authConfig = await getAuthConfigForBindingKey(project.id);
    if (!authConfig) {
      return NextResponse.json(
        { error: "This project does not have a managed backend" },
        { status: 404 }
      );
    }

    // Extract the existing schema SQL from the project's files.
    const files = project.files as Array<{ path: string; content: string }>;
    const schemaFile = files.find(
      (f) => f.path.replace(/\\/g, "/").toLowerCase() === "supabase/schema.sql"
    );

    return NextResponse.json({
      projectRef: authConfig.projectRef,
      supabaseUrl: authConfig.supabaseUrl,
      anonKey: authConfig.anonKey,
      schemaSQL: schemaFile?.content ?? null,
    });
  } catch (error) {
    console.error("[GET /api/projects/backend-info] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
