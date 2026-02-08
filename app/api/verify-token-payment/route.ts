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

    const { userId, tokenType, tokensToCredit } = metadata;
    if (!userId || !tokenType || !tokensToCredit) {
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const tokensAmount = parseInt(tokensToCredit, 10);
    const tokenField = tokenType === "app" ? "appTokens" : "integrationTokens";

    // Use session ID as document ID so the idempotency check is inside the transaction
    let alreadyCredited = false;

    await adminDb.runTransaction(async (transaction) => {
      const txRef = adminDb.collection("tokenTransactions").doc(session.id);
      const txDoc = await transaction.get(txRef);

      if (txDoc.exists) {
        alreadyCredited = true;
        return;
      }

      const userRef = adminDb.collection("users").doc(userId);
      const userDoc = await transaction.get(userRef);

      const currentBalance = userDoc.exists ? (userDoc.data()?.[tokenField] || 0) : 0;
      const newBalance = currentBalance + tokensAmount;

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

    if (!alreadyCredited) {
      console.log(`[verify-token-payment] Credited ${tokensAmount} ${tokenType} tokens to user ${userId}`);
    }

    const userDoc = await adminDb.collection("users").doc(userId).get();
    return NextResponse.json({
      success: true,
      alreadyCredited,
      appTokens: userDoc.data()?.appTokens || 0,
      integrationTokens: userDoc.data()?.integrationTokens || 0,
    });
  } catch (error) {
    console.error("[verify-token-payment] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed" },
      { status: 500 }
    );
  }
}
