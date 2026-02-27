import { auth } from '@/lib/supabase-auth/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rebindAuthConfigBindingKey } from '@/lib/supabase-project-pool';

export async function POST(req: Request) {
  try {
    const { userId: authUserId } = await auth();

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { authUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const {
      prompt,
      files,
      dependencies,
      lintReport,
      config,
      imageCache,
      generationRunId,
      linkedBackendProjectId,
    } = body;

    const generationRunBindingKey =
      typeof generationRunId === "string" && generationRunId.trim().length > 0
        ? generationRunId.trim()
        : null;

    const resolvedLinkedBackendId =
      typeof linkedBackendProjectId === "string" && linkedBackendProjectId.trim().length > 0
        ? linkedBackendProjectId.trim()
        : null;

    // Use Prisma transaction to create project and update user atomically
    const result = await prisma.$transaction(async (tx) => {
      // Create project
      const project = await tx.project.create({
        data: {
          userId: user.id,
          prompt,
          files,
          dependencies,
          lintReport,
          config,
          imageCache,
          linkedBackendProjectId: resolvedLinkedBackendId,
        },
      });

      // Update user's project count
      await tx.user.update({
        where: { id: user.id },
        data: { projectCount: { increment: 1 } },
      });

      return project;
    });

    // Only rebind the pool entry if this project has its OWN backend.
    // Linked projects borrow the source project's credentials — no new pool slot.
    if (generationRunBindingKey && !resolvedLinkedBackendId) {
      await rebindAuthConfigBindingKey(generationRunBindingKey, result.id);
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { appTokens: true },
    });

    return NextResponse.json({
      projectId: result.id,
      appTokens: updatedUser?.appTokens ?? user.appTokens,
    });
  } catch (error) {
    console.error('[POST /api/projects/create] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
