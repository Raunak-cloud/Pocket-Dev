import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || '';

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clerkUser = await currentUser();
    const userEmail = clerkUser?.emailAddresses[0]?.emailAddress || '';

    if (userEmail !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { ticketId, response, status } = body;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const messages = (ticket.messages as any[]) || [];
    const newMessage = {
      sender: 'admin',
      text: response,
      timestamp: new Date(),
    };

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        adminResponse: response,
        status,
        respondedAt: new Date(),
        messages: [...messages, newMessage],
      },
    });

    // Send email notification
    try {
      const ticketUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}?section=support&ticket=${ticketId}`;
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/send-ticket-response-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          userEmail: ticket.userEmail,
          userName: ticket.userName,
          ticketSubject: ticket.subject,
          adminResponse: response,
          ticketUrl,
        }),
      });
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/support-tickets/respond] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
