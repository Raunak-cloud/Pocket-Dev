import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/lib/supabase-auth/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
      select: { id: true, stripeConnectAccountId: true, stripeConnectStatus: true, stripeConnectOnboardingComplete: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.stripeConnectAccountId) {
      return NextResponse.json({ connected: false, status: null });
    }

    const stripe = new Stripe(stripeKey);
    const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);

    const status = account.charges_enabled
      ? "active"
      : account.details_submitted
        ? "restricted"
        : "pending";

    const onboardingComplete = account.details_submitted || false;

    if (status !== user.stripeConnectStatus || onboardingComplete !== user.stripeConnectOnboardingComplete) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeConnectStatus: status,
          stripeConnectOnboardingComplete: onboardingComplete,
        },
      });
    }

    return NextResponse.json({
      connected: true,
      status,
      onboardingComplete,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    });
  } catch (error) {
    console.error("[stripe-connect/status] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch Stripe status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
