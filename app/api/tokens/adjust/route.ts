import { auth } from "@/lib/supabase-auth/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { authUserId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const amount = Number(body.amount);
    const reason = String(body.reason || "Token adjustment");

    if (!Number.isFinite(amount)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const fresh = await tx.user.findUnique({ where: { id: user.id } });
      if (!fresh) throw new Error("User not found");

      const currentBalance = fresh.appTokens;
      const nextBalance = currentBalance + amount;
      if (nextBalance < 0) {
        throw new Error("Insufficient token balance");
      }

      await tx.user.update({
        where: { id: user.id },
        data: { appTokens: nextBalance },
      });

      await tx.tokenTransaction.create({
        data: {
          userId: user.id,
          type: amount >= 0 ? "credit" : "deduction",
          tokenType: "app",
          amount,
          balanceBefore: currentBalance,
          balanceAfter: nextBalance,
          reason,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("Insufficient") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}


