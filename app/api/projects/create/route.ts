import { auth } from '@/lib/supabase-auth/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deductAppTokens } from '@/lib/db-utils';
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
    } = body;

    const generationRunBindingKey =
      typeof generationRunId === "string" && generationRunId.trim().length > 0
        ? generationRunId.trim()
        : null;

    // Use Prisma transaction to create project and update user atomically
    const result = await prisma.$transaction(async (tx) => {
      // Deduct 2 app tokens
      const tokenResult = await deductAppTokens(
        user.id,
        2,
        `Project creation: ${prompt.substring(0, 50)}...`,
      );

      if (!tokenResult.success) {
        throw new Error(tokenResult.error || 'Failed to deduct app tokens');
      }

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
        },
      });

      // Update user's project count
      await tx.user.update({
        where: { id: user.id },
        data: { projectCount: { increment: 1 } },
      });

      return project;
    });

    if (generationRunBindingKey) {
      await rebindAuthConfigBindingKey(generationRunBindingKey, result.id);
    }

    return NextResponse.json({ projectId: result.id });
  } catch (error) {
    console.error('[POST /api/projects/create] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
