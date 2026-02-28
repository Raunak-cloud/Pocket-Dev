import { auth, currentUser } from '@/lib/supabase-auth/server';
import { NextResponse } from 'next/server';
import { getUserByAuthId, createUser, updateUserLastLogin } from '@/lib/db-utils';
import type { UserData } from '@/app/contexts/AuthContext';
import { prisma, withPrismaRetry } from '@/lib/prisma';

export async function GET() {
  try {
    const { userId: authUserId } = await auth();

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userData = await withPrismaRetry(async () => {
      // Try to get user from database
      let user = await getUserByAuthId(authUserId);

      // If user doesn't exist, create them
      if (!user) {
        const authUser = await currentUser();
        if (!authUser) {
          throw new Error('User not found');
        }

        user = await createUser(authUser);
      } else {
        // Update last login timestamp
        await updateUserLastLogin(authUserId);
      }

      const activeProjectCount = await prisma.project.count({
        where: {
          userId: user.id,
          deleted: false,
        },
      });

      if (user.projectCount !== activeProjectCount) {
        await prisma.user.update({
          where: { id: user.id },
          data: { projectCount: activeProjectCount },
        });
      }

      // Transform to UserData interface for compatibility with existing code
      const result: UserData = {
        uid: user.id, // Use Prisma user ID as uid
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        projectCount: activeProjectCount,
        appTokens: user.appTokens,
      };
      return result;
    });

    return NextResponse.json(userData);
  } catch (error) {
    console.error('[GET /api/user/me] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isConnectionError = /ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up|Can't reach database/i.test(message);
    return NextResponse.json(
      { error: isConnectionError ? 'Database connection error — please try again' : 'Internal server error' },
      { status: isConnectionError ? 503 : 500 }
    );
  }
}

