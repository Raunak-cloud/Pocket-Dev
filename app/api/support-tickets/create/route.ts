import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const clerkUser = await currentUser();
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
        userName: user.displayName || clerkUser?.emailAddresses[0]?.emailAddress || 'User',
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
