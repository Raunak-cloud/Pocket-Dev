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
      select: { id: true, stripeConnectAccountId: true },
    });

    if (!user?.stripeConnectAccountId) {
      return NextResponse.json({ error: "No Stripe account found" }, { status: 404 });
    }

    const stripe = new Stripe(stripeKey);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pocket-dev-lac.vercel.app";

    const accountLink = await stripe.accountLinks.create({
      account: user.stripeConnectAccountId,
      return_url: `${appUrl}?section=settings&stripe_onboarding=complete`,
      refresh_url: `${appUrl}?section=settings&stripe_refresh=true`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("[stripe-connect/refresh-link] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to create onboarding link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
