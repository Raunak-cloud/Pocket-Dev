import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/lib/supabase-auth/server";
import { prisma } from "@/lib/prisma";

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
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userEmail, quantity } = body;

    if (!quantity) {
      return NextResponse.json(
        { error: "Missing required field: quantity" },
        { status: 400 }
      );
    }

    if (typeof quantity !== "number" || quantity < 1 || quantity > 1000) {
      return NextResponse.json(
        { error: "Quantity must be between 1 and 1000" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { authUserId },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // App tokens: 1 AUD = 1 token
    const tokensToCredit = quantity;
    const unitAmountCents = quantity * 100; // AUD in cents

    const productName = `${tokensToCredit} App Token${tokensToCredit > 1 ? "s" : ""}`;
    const productDescription =
      "App tokens for project generation, editing, authentication, and database setup";

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
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?token_payment=success&session_id={CHECKOUT_SESSION_ID}&tokenType=app&amount=${tokensToCredit}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}?token_payment=cancelled`,
      client_reference_id: user.id,
      customer_email: user.email || userEmail || undefined,
      metadata: {
        type: "token_purchase",
        userId: user.id,
        authUserId,
        tokenType: "app",
        tokensToCredit: String(tokensToCredit),
      },
    });

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("[create-token-checkout] Error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}


