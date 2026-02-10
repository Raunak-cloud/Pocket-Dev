import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function getAdminDb() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

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
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  // Handle the event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};

    // Handle token purchase
    if (metadata.type === "token_purchase") {
      const { userId, tokenType, tokensToCredit } = metadata;

      if (!userId || !tokenType || !tokensToCredit) {
        console.error("[webhook] Missing token purchase metadata:", metadata);
        return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
      }

      try {
        const adminDb = getAdminDb();
        const tokensAmount = parseInt(tokensToCredit, 10);
        const tokenField = tokenType === "app" ? "appTokens" : "integrationTokens";

        // Idempotency check INSIDE the transaction using session ID as doc ID
        let alreadyCredited = false;

        await adminDb.runTransaction(async (transaction) => {
          const txRef = adminDb.collection("tokenTransactions").doc(session.id);
          const txDoc = await transaction.get(txRef);

          if (txDoc.exists) {
            alreadyCredited = true;
            console.log(`[webhook] Transaction already exists for session ${session.id}, skipping credit`);
            return;
          }

          const userRef = adminDb.collection("users").doc(userId);
          const userDoc = await transaction.get(userRef);

          const currentBalance = userDoc.exists ? (userDoc.data()?.[tokenField] || 0) : 0;
          const newBalance = currentBalance + tokensAmount;

          console.log(`[webhook] Crediting ${tokensAmount} ${tokenType} tokens to user ${userId}. Balance: ${currentBalance} -> ${newBalance}`);

          transaction.set(userRef, { [tokenField]: newBalance }, { merge: true });

          transaction.set(txRef, {
            userId,
            type: "purchase",
            tokenType,
            amount: tokensAmount,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            reason: `Purchased ${tokensAmount} ${tokenType} tokens`,
            stripeSessionId: session.id,
            createdAt: FieldValue.serverTimestamp(),
          });
        });

        if (alreadyCredited) {
          console.log(`[webhook] Token purchase already processed for session ${session.id}, no changes made`);
        } else {
          console.log(`[webhook] Successfully credited ${tokensAmount} ${tokenType} tokens to user ${userId}`);
        }
      } catch (error) {
        console.error("[webhook] Error crediting tokens:", error);
        return NextResponse.json(
          { error: "Failed to credit tokens" },
          { status: 500 }
        );
      }
    }

    // Handle premium plan upgrade
    if (metadata.type === "premium_upgrade") {
      const { projectId, userId } = metadata;

      if (!projectId || !userId) {
        console.error("[webhook] Missing premium upgrade metadata:", metadata);
        return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
      }

      try {
        const adminDb = getAdminDb();
        await adminDb.collection("projects").doc(projectId).update({
          tier: "premium",
          paidAt: new Date(),
          stripeSessionId: session.id,
          stripeSubscriptionId: session.subscription,
        });

        console.log(`[webhook] Project ${projectId} upgraded to premium for user ${userId}`);
      } catch (error) {
        console.error("[webhook] Error upgrading project to premium:", error);
        return NextResponse.json(
          { error: "Failed to upgrade project" },
          { status: 500 }
        );
      }
    }

    // Legacy: Handle project upgrade (kept for existing sessions)
    const { projectId, userId } = metadata;
    if (projectId && userId && metadata.type !== "token_purchase" && metadata.type !== "premium_upgrade") {
      try {
        const adminDb = getAdminDb();
        await adminDb.collection("projects").doc(projectId).update({
          tier: "premium",
          paidAt: new Date(),
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent,
        });

        console.log(`Project ${projectId} upgraded to premium`);
      } catch (error) {
        console.error("Error updating project tier:", error);
        return NextResponse.json(
          { error: "Failed to update project" },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
