import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  console.log("[create-token-checkout] Starting checkout session creation");

  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    console.log("[create-token-checkout] Stripe key exists:", !!stripeKey);

    if (!stripeKey) {
      console.log("[create-token-checkout] No Stripe key found");
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 500 }
      );
    }

    console.log("[create-token-checkout] Initializing Stripe");
    const stripe = new Stripe(stripeKey);

    console.log("[create-token-checkout] Parsing request body");
    const body = await request.json();
    console.log("[create-token-checkout] Request body:", JSON.stringify(body));
    const { userId, userEmail, tokenType, quantity } = body;

    if (!userId || !tokenType || !quantity) {
      return NextResponse.json(
        { error: "Missing required fields: userId, tokenType, quantity" },
        { status: 400 }
      );
    }

    if (tokenType !== "app" && tokenType !== "integration") {
      return NextResponse.json(
        { error: "Invalid tokenType. Must be 'app' or 'integration'" },
        { status: 400 }
      );
    }

    if (quantity < 1) {
      return NextResponse.json(
        { error: "Quantity must be at least 1" },
        { status: 400 }
      );
    }

    // Calculate tokens to credit
    // App tokens: 1 AUD = 1 token
    // Integration tokens: 1 AUD = 10 tokens
    const tokensToCredit = tokenType === "app" ? quantity : quantity * 10;
    const unitAmountCents = quantity * 100; // AUD in cents

    const productName = tokenType === "app"
      ? `${tokensToCredit} App Token${tokensToCredit > 1 ? "s" : ""}`
      : `${tokensToCredit} Integration Token${tokensToCredit > 1 ? "s" : ""}`;

    const productDescription = tokenType === "app"
      ? "App tokens for creating new projects (2 tokens per project)"
      : "Integration tokens for AI edits and backend/API calls (1 token per action)";

    console.log("[create-token-checkout] Creating Stripe session for user:", userId, "tokenType:", tokenType, "quantity:", quantity, "tokensToCredit:", tokensToCredit);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: unitAmountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?token_payment=success&tokenType=${tokenType}&amount=${tokensToCredit}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?token_payment=cancelled`,
      customer_email: userEmail,
      metadata: {
        type: "token_purchase",
        userId,
        tokenType,
        tokensToCredit: String(tokensToCredit),
      },
    });

    console.log("[create-token-checkout] Session created successfully:", session.id);
    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("[create-token-checkout] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create checkout session";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[create-token-checkout] Error message:", errorMessage);
    console.error("[create-token-checkout] Error stack:", errorStack);
    return NextResponse.json(
      { error: errorMessage, details: errorStack },
      { status: 500 }
    );
  }
}
