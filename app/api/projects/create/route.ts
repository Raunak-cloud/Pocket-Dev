import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deductAppTokens, deductIntegrationToken } from '@/lib/db-utils';

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
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
      authIntegrationCost = 0,
    } = body;

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

      // Deduct integration tokens if auth integration was used
      if (authIntegrationCost > 0) {
        for (let i = 0; i < authIntegrationCost; i++) {
          const integrationResult = await deductIntegrationToken(
            user.id,
            `Auth integration for project: ${prompt.substring(0, 50)}...`,
          );

          if (!integrationResult.success) {
            throw new Error(integrationResult.error || 'Failed to deduct integration tokens');
          }
        }
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

    return NextResponse.json({ projectId: result.id });
  } catch (error) {
    console.error('[POST /api/projects/create] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
