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

    // Retrieve the checkout session from Stripe to verify payment
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    const metadata = session.metadata || {};
    if (metadata.type !== "token_purchase") {
      return NextResponse.json({ error: "Not a token purchase session" }, { status: 400 });
    }

    const { userId, clerkUserId, tokenType, tokensToCredit } = metadata;
    if (!userId || !tokenType || !tokensToCredit) {
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const tokensAmount = parseInt(tokensToCredit, 10);
    if (!Number.isFinite(tokensAmount) || tokensAmount <= 0) {
      return NextResponse.json({ error: "Invalid token amount" }, { status: 400 });
    }
    if (tokenType !== "app" && tokenType !== "integration") {
      return NextResponse.json({ error: "Invalid token type" }, { status: 400 });
    }

    // Use Prisma transaction with idempotency check
    let alreadyCredited = false;
    let finalBalances = { appTokens: 0, integrationTokens: 0 };

    await prisma.$transaction(async (tx) => {
      // Check if this payment has already been processed (idempotency)
      const existingTx = await tx.tokenTransaction.findFirst({
        where: { stripePaymentIntentId: session.id },
      });

      if (existingTx) {
        alreadyCredited = true;
        // Fetch current user balances
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { appTokens: true, integrationTokens: true },
        });

        if (!user) {
          const byClerkId = await tx.user.findUnique({
            where: { clerkUserId: clerkUserId || userId },
            select: { appTokens: true, integrationTokens: true },
          });
          if (byClerkId) {
            finalBalances = {
              appTokens: byClerkId.appTokens,
              integrationTokens: byClerkId.integrationTokens,
            };
            return;
          }
        }

        if (user) {
          finalBalances = {
            appTokens: user.appTokens,
            integrationTokens: user.integrationTokens,
          };
        }
        return;
      }

      // Get user
      let user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, appTokens: true, integrationTokens: true },
      });

      if (!user) {
        user = await tx.user.findUnique({
          where: { clerkUserId: clerkUserId || userId },
          select: { id: true, appTokens: true, integrationTokens: true },
        });
      }

      if (!user) {
        throw new Error("User not found");
      }

      const currentBalance = tokenType === "app" ? user.appTokens : user.integrationTokens;
      const newBalance = currentBalance + tokensAmount;

      // Update user balance
      await tx.user.update({
        where: { id: user.id },
        data: {
          [tokenType === "app" ? "appTokens" : "integrationTokens"]: newBalance,
        },
      });

      // Record transaction
      await tx.tokenTransaction.create({
        data: {
          userId: user.id,
          type: "purchase",
          tokenType,
          amount: tokensAmount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          reason: `Purchased ${tokensAmount} ${tokenType} tokens`,
          stripePaymentIntentId: session.id,
        },
      });

      // Calculate final balances
      if (tokenType === "app") {
        finalBalances = {
          appTokens: newBalance,
          integrationTokens: user.integrationTokens,
        };
      } else {
        finalBalances = {
          appTokens: user.appTokens,
          integrationTokens: newBalance,
        };
      }
    });

    if (alreadyCredited) {
      console.log(`[verify-token-payment] Tokens already credited for session ${session.id}`);
    } else {
      console.log(`[verify-token-payment] Successfully credited ${tokensAmount} ${tokenType} tokens for session ${session.id}`);
    }

    return NextResponse.json({
      success: true,
      alreadyCredited,
      appTokens: finalBalances.appTokens,
      integrationTokens: finalBalances.integrationTokens,
    });
  } catch (error) {
    console.error("[verify-token-payment] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed" },
      { status: 500 }
    );
  }
}
