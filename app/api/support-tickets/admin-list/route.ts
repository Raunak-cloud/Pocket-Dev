import { auth, currentUser } from '@/lib/supabase-auth/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || '';

export async function GET() {
  try {
    const { userId: authUserId } = await auth();

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authUser = await currentUser();
    const userEmail = authUser?.email || '';

    if (userEmail !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tickets = await prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(tickets);
  } catch (error) {
    console.error('[GET /api/support-tickets/admin-list] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



