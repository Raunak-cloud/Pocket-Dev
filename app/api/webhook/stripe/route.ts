import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { creditTokens } from "@/lib/db-utils";

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const stripe = new Stripe(stripeKey);
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata || {};

  try {
    if (metadata.type === "token_purchase") {
      const userId = metadata.userId;
      const clerkUserId = metadata.clerkUserId;
      const tokenType = metadata.tokenType as "app" | "integration";
      const tokensToCredit = Number.parseInt(metadata.tokensToCredit || "0", 10);

      if (!userId || !tokenType || !Number.isFinite(tokensToCredit) || tokensToCredit <= 0) {
        return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
      }
      if (tokenType !== "app" && tokenType !== "integration") {
        return NextResponse.json({ error: "Invalid token type" }, { status: 400 });
      }

      let targetUserId: string | null = null;

      const byId = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (byId) {
        targetUserId = byId.id;
      } else {
        const byClerkId = await prisma.user.findUnique({
          where: { clerkUserId: clerkUserId || userId },
          select: { id: true },
        });
        targetUserId = byClerkId?.id || null;
      }

      if (!targetUserId) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      await creditTokens(
        targetUserId,
        tokensToCredit,
        tokenType,
        `Purchased ${tokensToCredit} ${tokenType} tokens`,
        session.id,
      );
    }

    if (
      metadata.type === "premium_upgrade" ||
      (metadata.projectId && metadata.userId)
    ) {
      const projectId = metadata.projectId;
      if (projectId) {
        await prisma.project.update({
          where: { id: projectId },
          data: {
            tier: "premium",
            paidAt: new Date(),
          },
        });
      }
    }
  } catch (error) {
    console.error("[stripe webhook] Processing error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
