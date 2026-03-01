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
      select: { id: true, email: true, stripeConnectAccountId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const stripe = new Stripe(stripeKey);
    let accountId = user.stripeConnectAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeConnectAccountId: accountId,
          stripeConnectStatus: "pending",
        },
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pocket-dev-lac.vercel.app";
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      return_url: `${appUrl}?section=settings&stripe_onboarding=complete`,
      refresh_url: `${appUrl}?section=settings&stripe_refresh=true`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("[stripe-connect/create-account] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to create Stripe account";
    const stripeCode = (error as { code?: string })?.code;
    const stripeType = (error as { type?: string })?.type;
    return NextResponse.json(
      { error: message, ...(stripeCode && { code: stripeCode }), ...(stripeType && { type: stripeType }) },
      { status: 500 },
    );
  }
}
