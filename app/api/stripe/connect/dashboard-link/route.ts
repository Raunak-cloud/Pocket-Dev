import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/lib/supabase-auth/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
    }

    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { authUserId },
      select: { id: true, stripeConnectAccountId: true, stripeConnectStatus: true },
    });

    if (!user?.stripeConnectAccountId) {
      return NextResponse.json({ error: "No Stripe account found" }, { status: 404 });
    }

    if (user.stripeConnectStatus !== "active") {
      return NextResponse.json({ error: "Stripe account is not active. Complete onboarding first." }, { status: 400 });
    }

    const stripe = new Stripe(stripeKey);
    const loginLink = await stripe.accounts.createLoginLink(user.stripeConnectAccountId);

    return NextResponse.json({ url: loginLink.url });
  } catch (error) {
    console.error("[stripe-connect/dashboard-link] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to create dashboard link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
