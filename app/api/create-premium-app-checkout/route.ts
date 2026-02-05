import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const PRICE_AUD = 6500; // $65.00 AUD in cents ($5 base + $60 premium)

export async function POST(request: NextRequest) {
  console.log("[create-premium-app-checkout] Starting checkout session creation");

  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    console.log("[create-premium-app-checkout] Stripe key exists:", !!stripeKey);

    if (!stripeKey) {
      console.log("[create-premium-app-checkout] No Stripe key found");
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 500 }
      );
    }

    console.log("[create-premium-app-checkout] Initializing Stripe");
    const stripe = new Stripe(stripeKey);

    console.log("[create-premium-app-checkout] Parsing request body");
    const body = await request.json();
    console.log("[create-premium-app-checkout] Request body:", JSON.stringify(body));
    const { userId, userEmail, prompt } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create Stripe checkout session
    console.log("[create-premium-app-checkout] Creating Stripe session for user:", userId);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: {
              name: "Create Premium App",
              description: "Generate a new React app with AI - Premium tier with unlimited edits, backend functionalities, and priority support",
            },
            unit_amount: PRICE_AUD,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?app_payment=success&tier=premium&prompt=${encodeURIComponent(prompt || "")}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?app_payment=cancelled`,
      customer_email: userEmail,
      metadata: {
        userId,
        prompt: prompt || "",
        type: "premium_app_creation",
        tier: "premium",
      },
    });

    console.log("[create-premium-app-checkout] Session created successfully:", session.id);
    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("[create-premium-app-checkout] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create checkout session";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[create-premium-app-checkout] Error message:", errorMessage);
    console.error("[create-premium-app-checkout] Error stack:", errorStack);
    return NextResponse.json(
      { error: errorMessage, details: errorStack },
      { status: 500 }
    );
  }
}
