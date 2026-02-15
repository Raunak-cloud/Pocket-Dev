import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { clerkUserId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const tokenType = body.tokenType as "app" | "integration";
    const amount = Number(body.amount);
    const reason = String(body.reason || "Token adjustment");

    if (!["app", "integration"].includes(tokenType) || !Number.isFinite(amount)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const balanceField = tokenType === "app" ? "appTokens" : "integrationTokens";

    await prisma.$transaction(async (tx) => {
      const fresh = await tx.user.findUnique({ where: { id: user.id } });
      if (!fresh) throw new Error("User not found");

      const currentBalance = fresh[balanceField];
      const nextBalance = currentBalance + amount;
      if (nextBalance < 0) {
        throw new Error("Insufficient token balance");
      }

      await tx.user.update({
        where: { id: user.id },
        data: { [balanceField]: nextBalance },
      });

      await tx.tokenTransaction.create({
        data: {
          userId: user.id,
          type: amount >= 0 ? "credit" : "deduction",
          tokenType,
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
