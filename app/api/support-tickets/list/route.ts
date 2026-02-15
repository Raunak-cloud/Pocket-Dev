import { auth } from '@/lib/supabase-auth/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
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

    const tickets = await prisma.supportTicket.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    // Parse messages and calculate unread count
    const processedTickets = tickets.map((ticket) => {
      const messages = (ticket.messages as any[]) || [];
      const lastReadByUserAt = ticket.lastReadByUserAt || new Date(0);
      const unreadAdminMessageCount = messages.filter(
        (m: any) => m.sender === 'admin' && new Date(m.timestamp) > lastReadByUserAt
      ).length;

      return {
        ...ticket,
        unreadAdminMessageCount,
      };
    });

    return NextResponse.json(processedTickets);
  } catch (error) {
    console.error('[GET /api/support-tickets/list] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


