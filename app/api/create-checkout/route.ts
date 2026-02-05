import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const PRICE_AUD = 6000; // $60.00 AUD in cents

export async function POST(request: NextRequest) {
  console.log("[create-checkout] Starting checkout session creation");

  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    console.log("[create-checkout] Stripe key exists:", !!stripeKey);

    if (!stripeKey) {
      console.log("[create-checkout] No Stripe key found");
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 500 }
      );
    }

    console.log("[create-checkout] Initializing Stripe");
    const stripe = new Stripe(stripeKey);

    console.log("[create-checkout] Parsing request body");
    const body = await request.json();
    console.log("[create-checkout] Request body:", JSON.stringify(body));
    const { projectId, userId, userEmail } = body;

    if (!projectId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create Stripe checkout session
    console.log("[create-checkout] Creating Stripe session for project:", projectId);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: {
              name: "Premium Project - Unlimited Edits",
              description: "Upgrade this project to premium for unlimited AI-powered edits",
            },
            unit_amount: PRICE_AUD,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?payment=success&projectId=${projectId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?payment=cancelled`,
      customer_email: userEmail,
      metadata: {
        projectId,
        userId,
      },
    });

    console.log("[create-checkout] Session created successfully:", session.id);
    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("[create-checkout] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create checkout session";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[create-checkout] Error message:", errorMessage);
    console.error("[create-checkout] Error stack:", errorStack);
    return NextResponse.json(
      { error: errorMessage, details: errorStack },
      { status: 500 }
    );
  }
}
