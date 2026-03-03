import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/supabase-auth/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { createUser } from "@/lib/db-utils";

function parseRange(range: string | null): number {
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return 7;
}

function parseYear(year: string | null): number | null {
  if (!year) return null;
  if (!/^\d{4}$/.test(year)) return null;
  const parsed = Number.parseInt(year, 10);
  const current = new Date().getFullYear() + 1;
  if (parsed < 2000 || parsed > current) return null;
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const range = parseRange(request.nextUrl.searchParams.get("range"));
    const requestedRevenueYear = parseYear(
      request.nextUrl.searchParams.get("year"),
    );
    const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000);

    const data = await withPrismaRetry(async () => {
      let user = await prisma.user.findUnique({ where: { authUserId } });
      if (!user) {
        const authUser = await currentUser();
        if (!authUser) throw new Error("User not found");
        user = await createUser(authUser);
      }

      // Get all published projects for this user
      const publishedProjects = await prisma.project.findMany({
        where: { userId: user.id, deleted: false, isPublished: true },
        select: { id: true, prompt: true, publishedUrl: true, publishedAt: true },
        orderBy: { publishedAt: "desc" },
      });

      const publishedIds = new Set(publishedProjects.map((p) => p.id));

      // Also find user projects that have analytics events but may not be
      // marked as isPublished (e.g. if the publish-state call failed).
      const allUserProjects = await prisma.project.findMany({
        where: { userId: user.id, deleted: false },
        select: { id: true, prompt: true, publishedUrl: true, publishedAt: true },
      });
      const allUserProjectIds = allUserProjects.map((p) => p.id);

      // Get analytics events for ALL user projects (not just published ones)
      const events = allUserProjectIds.length > 0
        ? await prisma.analyticsEvent.findMany({
            where: { projectId: { in: allUserProjectIds }, createdAt: { gte: since } },
            select: {
              projectId: true,
              sessionId: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          })
        : [];

      // Include unpublished projects that have events (tracking works but
      // isPublished flag was never set — e.g. Cloudflare publish-state failed)
      const projectsWithEvents = new Set(events.map((e) => e.projectId));
      const extraProjects = allUserProjects.filter(
        (p) => !publishedIds.has(p.id) && projectsWithEvents.has(p.id),
      );
      const effectiveProjects = [...publishedProjects, ...extraProjects];

      // Global aggregation
      const totalPageviews = events.length;
      const uniqueSessions = new Set(events.map((e) => e.sessionId).filter(Boolean));
      const totalVisitors = uniqueSessions.size;

      // Daily aggregation across all projects
      const dailyMap = new Map<string, { pageviews: number; sessions: Set<string> }>();
      for (const e of events) {
        const day = e.createdAt.toISOString().slice(0, 10);
        if (!dailyMap.has(day)) dailyMap.set(day, { pageviews: 0, sessions: new Set() });
        const d = dailyMap.get(day)!;
        d.pageviews++;
        if (e.sessionId) d.sessions.add(e.sessionId);
      }
      const daily = Array.from(dailyMap.entries()).map(([date, d]) => ({
        date,
        pageviews: d.pageviews,
        visitors: d.sessions.size,
      }));

      // Per-project summary
      const projectMap = new Map<string, { pageviews: number; sessions: Set<string> }>();
      for (const e of events) {
        if (!projectMap.has(e.projectId)) projectMap.set(e.projectId, { pageviews: 0, sessions: new Set() });
        const d = projectMap.get(e.projectId)!;
        d.pageviews++;
        if (e.sessionId) d.sessions.add(e.sessionId);
      }

      const projects = effectiveProjects.map((p) => {
        const stats = projectMap.get(p.id);
        return {
          id: p.id,
          prompt: p.prompt.slice(0, 100),
          publishedUrl: p.publishedUrl,
          publishedAt: p.publishedAt,
          pageviews: stats?.pageviews || 0,
          visitors: stats?.sessions.size || 0,
        };
      });

      // Token usage from TokenTransaction
      const tokenTxns = await prisma.tokenTransaction.findMany({
        where: { userId: user.id, createdAt: { gte: since } },
        select: { type: true, amount: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      const tokenDailyMap = new Map<string, { credits: number; deductions: number }>();
      for (const t of tokenTxns) {
        const day = t.createdAt.toISOString().slice(0, 10);
        if (!tokenDailyMap.has(day)) tokenDailyMap.set(day, { credits: 0, deductions: 0 });
        const d = tokenDailyMap.get(day)!;
        if (t.amount > 0) d.credits += t.amount;
        else d.deductions += Math.abs(t.amount);
      }
      const tokenUsage = Array.from(tokenDailyMap.entries()).map(([date, d]) => ({
        date,
        credits: d.credits,
        deductions: d.deductions,
      }));

      const tokenPurchases = await prisma.tokenTransaction.findMany({
        where: {
          userId: user.id,
          amount: { gt: 0 },
          stripePaymentIntentId: { not: null },
        },
        select: {
          amount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });

      const premiumPayments = await prisma.project.findMany({
        where: {
          userId: user.id,
          tier: "premium",
          paidAt: { not: null },
        },
        select: {
          paidAt: true,
        },
        orderBy: { paidAt: "asc" },
      });

      const revenueYears = new Set<number>();
      tokenPurchases.forEach((txn) =>
        revenueYears.add(txn.createdAt.getUTCFullYear()),
      );
      premiumPayments.forEach((payment) => {
        if (payment.paidAt) {
          revenueYears.add(payment.paidAt.getUTCFullYear());
        }
      });

      const currentYear = new Date().getUTCFullYear();
      const availableYears = Array.from(revenueYears).sort((a, b) => b - a);
      if (availableYears.length === 0) {
        availableYears.push(currentYear);
      }

      const selectedRevenueYear =
        requestedRevenueYear && availableYears.includes(requestedRevenueYear)
          ? requestedRevenueYear
          : availableYears[0];

      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      const monthlyRevenue = monthNames.map((label, index) => ({
        month: label,
        monthIndex: index,
        tokenRevenue: 0,
        premiumRevenue: 0,
        revenue: 0,
      }));

      for (const txn of tokenPurchases) {
        if (txn.createdAt.getUTCFullYear() !== selectedRevenueYear) continue;
        const monthIndex = txn.createdAt.getUTCMonth();
        monthlyRevenue[monthIndex].tokenRevenue += txn.amount;
        monthlyRevenue[monthIndex].revenue += txn.amount;
      }

      for (const payment of premiumPayments) {
        if (!payment.paidAt) continue;
        if (payment.paidAt.getUTCFullYear() !== selectedRevenueYear) continue;
        const monthIndex = payment.paidAt.getUTCMonth();
        // Premium checkout is currently AUD 35/month at initial purchase.
        monthlyRevenue[monthIndex].premiumRevenue += 35;
        monthlyRevenue[monthIndex].revenue += 35;
      }

      const yearlyRevenueTotal = monthlyRevenue.reduce(
        (sum, month) => sum + month.revenue,
        0,
      );
      const lifetimeRevenueTotal =
        tokenPurchases.reduce((sum, txn) => sum + txn.amount, 0) +
        premiumPayments.length * 35;

      return {
        totalPageviews,
        totalVisitors,
        publishedProjects: effectiveProjects.length,
        projects,
        daily,
        tokenUsage,
        revenue: {
          selectedYear: selectedRevenueYear,
          availableYears,
          yearlyTotal: Number(yearlyRevenueTotal.toFixed(2)),
          lifetimeTotal: Number(lifetimeRevenueTotal.toFixed(2)),
          monthly: monthlyRevenue.map((month) => ({
            month: month.month,
            tokenRevenue: Number(month.tokenRevenue.toFixed(2)),
            premiumRevenue: Number(month.premiumRevenue.toFixed(2)),
            revenue: Number(month.revenue.toFixed(2)),
          })),
        },
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("[analytics/overview] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const isConnectionError = /ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up|Can't reach database/i.test(message);
    return NextResponse.json(
      { error: isConnectionError ? "Database connection error" : "Internal server error" },
      { status: isConnectionError ? 503 : 500 },
    );
  }
}
