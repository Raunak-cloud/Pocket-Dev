import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle the webhook
  const eventType = evt.type;

  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name, image_url, username } = evt.data;

    const email = email_addresses[0]?.email_address || null;
    const displayName = [first_name, last_name].filter(Boolean).join(' ') || username || null;

    try {
      await prisma.user.create({
        data: {
          clerkUserId: id,
          email,
          displayName,
          photoURL: image_url || null,
          lastLoginAt: new Date(),
          // Default token balances for new users
          appTokens: 4,
          integrationTokens: 10,
        },
      });

      console.log(`[Clerk Webhook] User created: ${id}`);
    } catch (error) {
      console.error('[Clerk Webhook] Error creating user:', error);
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
  }

  if (eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url, username } = evt.data;

    const email = email_addresses[0]?.email_address || null;
    const displayName = [first_name, last_name].filter(Boolean).join(' ') || username || null;

    try {
      await prisma.user.update({
        where: { clerkUserId: id },
        data: {
          email,
          displayName,
          photoURL: image_url || null,
        },
      });

      console.log(`[Clerk Webhook] User updated: ${id}`);
    } catch (error) {
      console.error('[Clerk Webhook] Error updating user:', error);
      // Don't return error - user might not exist yet
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data;

    try {
      // Soft delete by marking projects as deleted
      await prisma.user.update({
        where: { clerkUserId: id as string },
        data: {
          projects: {
            updateMany: {
              where: { deleted: false },
              data: { deleted: true },
            },
          },
        },
      });

      // Or hard delete if preferred (uncomment to use)
      // await prisma.user.delete({
      //   where: { clerkUserId: id as string },
      // });

      console.log(`[Clerk Webhook] User deleted: ${id}`);
    } catch (error) {
      console.error('[Clerk Webhook] Error deleting user:', error);
    }
  }

  return NextResponse.json({ message: 'Webhook processed' });
}
