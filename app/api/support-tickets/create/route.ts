import { auth, currentUser } from '@/lib/supabase-auth/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { userId: authUserId } = await auth();

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { authUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const authUser = await currentUser();
    const body = await req.json();
    const { category, subject, description, projectId, projectName } = body;

    const initialMessage = {
      sender: 'user',
      text: description,
      timestamp: new Date(),
    };

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: user.id,
        userEmail: user.email || '',
        userName: user.displayName || authUser?.email || 'User',
        category,
        subject,
        description,
        projectId,
        projectName,
        status: 'open',
        messages: [initialMessage],
      },
    });

    return NextResponse.json({ ticketId: ticket.id });
  } catch (error) {
    console.error('[POST /api/support-tickets/create] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



