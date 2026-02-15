import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createUser } from '@/lib/db-utils';

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database (auto-bootstrap if missing due race conditions)
    let user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      const clerk = await currentUser();
      if (!clerk) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      user = await createUser(clerk);
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
    const savedProjects = projects.map((project) => ({
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

    return NextResponse.json(savedProjects);
  } catch (error) {
    console.error('[GET /api/projects/list] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
