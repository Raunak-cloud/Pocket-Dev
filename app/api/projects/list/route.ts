import { auth, currentUser } from '@/lib/supabase-auth/server';
import { NextResponse } from 'next/server';
import { prisma, withPrismaRetry } from '@/lib/prisma';
import { createUser } from '@/lib/db-utils';

export async function GET() {
  try {
    const { userId: authUserId } = await auth();

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const savedProjects = await withPrismaRetry(async () => {
      // Get user from database (auto-bootstrap if missing due race conditions)
      let user = await prisma.user.findUnique({
        where: { authUserId },
      });

      if (!user) {
        const authUser = await currentUser();
        if (!authUser) {
          throw new Error('User not found');
        }
        user = await createUser(authUser);
      }

      // Get all non-deleted projects for the user
      const projects = await prisma.project.findMany({
        where: {
          userId: user.id,
          deleted: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Transform to SavedProject format
      return projects.map((project) => ({
        id: project.id,
        userId: project.userId,
        prompt: project.prompt,
        files: project.files,
        dependencies: project.dependencies,
        lintReport: project.lintReport,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        isPublished: project.isPublished,
        publishedUrl: project.publishedUrl,
        deploymentId: project.deploymentId,
        publishedAt: project.publishedAt,
        customDomain: project.customDomain,
        tier: project.tier,
        paidAt: project.paidAt,
        config: project.config,
      }));
    });

    return NextResponse.json(savedProjects);
  } catch (error) {
    console.error('[GET /api/projects/list] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


