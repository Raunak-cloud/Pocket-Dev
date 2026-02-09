import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeKey);
    const body = await request.json();
    const { userId, userEmail, projectId } = body;

    if (!userId || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields: userId, projectId" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: {
              name: "Premium Plan",
              description:
                "Human support, human code oversight, domain configuration, and premium support for your project.",
            },
            unit_amount: 3500, // $35 AUD in cents
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?premium_payment=success&session_id={CHECKOUT_SESSION_ID}&projectId=${projectId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?premium_payment=cancelled`,
      customer_email: userEmail,
      metadata: {
        type: "premium_upgrade",
        userId,
        projectId,
      },
    });

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("[create-premium-checkout] Error:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to create checkout session";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
