import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const PRICE_AUD = 500; // $5.00 AUD in cents

export async function POST(request: NextRequest) {
  console.log("[create-app-checkout] Starting checkout session creation");

  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    console.log("[create-app-checkout] Stripe key exists:", !!stripeKey);

    if (!stripeKey) {
      console.log("[create-app-checkout] No Stripe key found");
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 500 }
      );
    }

    console.log("[create-app-checkout] Initializing Stripe");
    const stripe = new Stripe(stripeKey);

    console.log("[create-app-checkout] Parsing request body");
    const body = await request.json();
    console.log("[create-app-checkout] Request body:", JSON.stringify(body));
    const { userId, userEmail, prompt } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create Stripe checkout session
    console.log("[create-app-checkout] Creating Stripe session for user:", userId);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: {
              name: "Create New App",
              description: "Generate a new React app with AI",
            },
            unit_amount: PRICE_AUD,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?app_payment=success&prompt=${encodeURIComponent(prompt || "")}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?app_payment=cancelled`,
      customer_email: userEmail,
      metadata: {
        userId,
        prompt: prompt || "",
        type: "app_creation",
      },
    });

    console.log("[create-app-checkout] Session created successfully:", session.id);
    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("[create-app-checkout] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create checkout session";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[create-app-checkout] Error message:", errorMessage);
    console.error("[create-app-checkout] Error stack:", errorStack);
    return NextResponse.json(
      { error: errorMessage, details: errorStack },
      { status: 500 }
    );
  }
}
