import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getUserByClerkId, createUser, updateUserLastLogin } from '@/lib/db-utils';
import type { UserData } from '@/app/contexts/AuthContext';

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try to get user from database
    let user = await getUserByClerkId(clerkUserId);

    // If user doesn't exist, create them
    if (!user) {
      const clerkUser = await currentUser();
      if (!clerkUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      user = await createUser(clerkUser);
    } else {
      // Update last login timestamp
      await updateUserLastLogin(clerkUserId);
    }

    // Transform to UserData interface for compatibility with existing code
    const userData: UserData = {
      uid: user.id, // Use Prisma user ID as uid
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      projectCount: user.projectCount,
      appTokens: user.appTokens,
      integrationTokens: user.integrationTokens,
    };

    return NextResponse.json(userData);
  } catch (error) {
    console.error('[GET /api/user/me] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
