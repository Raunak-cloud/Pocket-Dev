import { auth } from '@/lib/supabase-auth/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  collectGeneratedStorageUrlsFromProjectData,
  deleteGeneratedStorageUrls,
  parseGeneratedFiles,
} from "@/lib/server/image-storage-cleanup";

export async function PUT(req: Request) {
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
    const { projectId, files, dependencies, lintReport, config, imageCache } = body;

    // Verify project ownership
    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (existingProject.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const previousFiles = parseGeneratedFiles(existingProject.files);
    const nextFiles = parseGeneratedFiles(files);
    const previousUrls = collectGeneratedStorageUrlsFromProjectData(
      previousFiles,
      existingProject.imageCache,
    );
    const nextUrls = collectGeneratedStorageUrlsFromProjectData(nextFiles, imageCache);

    const removedUrls: string[] = [];
    for (const url of previousUrls) {
      if (!nextUrls.has(url)) {
        removedUrls.push(url);
      }
    }

    if (removedUrls.length > 0) {
      await deleteGeneratedStorageUrls(removedUrls);
    }

    // Update project
    await prisma.project.update({
      where: { id: projectId },
      data: {
        files,
        dependencies,
        lintReport,
        config,
        imageCache,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PUT /api/projects/update] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
