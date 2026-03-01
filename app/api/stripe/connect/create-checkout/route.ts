import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 500, headers: corsHeaders });
    }

    const body = await request.json();
    const { projectId, lineItems, successUrl, cancelUrl, customerEmail } = body;

    if (!projectId || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: projectId and lineItems" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!successUrl || !cancelUrl) {
      return NextResponse.json(
        { error: "Missing required fields: successUrl and cancelUrl" },
        { status: 400, headers: corsHeaders },
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404, headers: corsHeaders });
    }

    const owner = await prisma.user.findUnique({
      where: { id: project.userId },
      select: { stripeConnectAccountId: true, stripeConnectStatus: true },
    });

    if (!owner?.stripeConnectAccountId || owner.stripeConnectStatus !== "active") {
      return NextResponse.json(
        { error: "Payments are not configured for this project" },
        { status: 400, headers: corsHeaders },
      );
    }

    const feePercent = parseFloat(process.env.STRIPE_CONNECT_APPLICATION_FEE_PERCENT || "5");

    const stripe = new Stripe(stripeKey);

    const stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = lineItems.map(
      (item: { name: string; description?: string; amount: number; currency?: string; quantity?: number }) => ({
        price_data: {
          currency: item.currency || "usd",
          product_data: {
            name: item.name,
            ...(item.description && { description: item.description }),
          },
          unit_amount: item.amount,
        },
        quantity: item.quantity || 1,
      }),
    );

    const totalAmount = lineItems.reduce(
      (sum: number, item: { amount: number; quantity?: number }) => sum + item.amount * (item.quantity || 1),
      0,
    );
    const applicationFeeAmount = Math.round(totalAmount * (feePercent / 100));

    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ["card"],
        line_items: stripeLineItems,
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        ...(customerEmail && { customer_email: customerEmail }),
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount,
        },
        metadata: {
          projectId,
          type: "connect_checkout",
        },
      },
      {
        stripeAccount: owner.stripeConnectAccountId,
      },
    );

    return NextResponse.json({ url: session.url }, { headers: corsHeaders });
  } catch (error) {
    console.error("[stripe-connect/create-checkout] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
