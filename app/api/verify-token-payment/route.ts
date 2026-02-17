import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const { sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    const metadata = session.metadata || {};
    if (metadata.type !== "token_purchase") {
      return NextResponse.json({ error: "Not a token purchase session" }, { status: 400 });
    }

    const { userId, authUserId, tokensToCredit } = metadata;
    if (!userId || !tokensToCredit) {
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const tokensAmount = Number.parseInt(tokensToCredit, 10);
    if (!Number.isFinite(tokensAmount) || tokensAmount <= 0) {
      return NextResponse.json({ error: "Invalid token amount" }, { status: 400 });
    }

    let alreadyCredited = false;
    let finalAppTokens = 0;

    await prisma.$transaction(async (tx) => {
      const existingTx = await tx.tokenTransaction.findFirst({
        where: { stripePaymentIntentId: session.id },
      });

      if (existingTx) {
        alreadyCredited = true;
        const existingUser =
          (await tx.user.findUnique({
            where: { id: userId },
            select: { appTokens: true },
          })) ||
          (await tx.user.findUnique({
            where: { authUserId: authUserId || userId },
            select: { appTokens: true },
          }));
        finalAppTokens = existingUser?.appTokens || 0;
        return;
      }

      const user =
        (await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, appTokens: true },
        })) ||
        (await tx.user.findUnique({
          where: { authUserId: authUserId || userId },
          select: { id: true, appTokens: true },
        }));

      if (!user) {
        throw new Error("User not found");
      }

      const newBalance = Math.round((user.appTokens + tokensAmount) * 100) / 100;

      await tx.user.update({
        where: { id: user.id },
        data: { appTokens: newBalance },
      });

      await tx.tokenTransaction.create({
        data: {
          userId: user.id,
          type: "credit",
          tokenType: "app",
          amount: tokensAmount,
          balanceBefore: user.appTokens,
          balanceAfter: newBalance,
          reason: `Purchased ${tokensAmount} app tokens`,
          stripePaymentIntentId: session.id,
        },
      });

      finalAppTokens = newBalance;
    });

    return NextResponse.json({
      success: true,
      alreadyCredited,
      appTokens: finalAppTokens,
    });
  } catch (error) {
    console.error("[verify-token-payment] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed" },
      { status: 500 },
    );
  }
}


