import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/supabase-auth/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { createUser } from "@/lib/db-utils";

function parseRange(range: string | null): number {
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return 7;
}

export async function GET(request: NextRequest) {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const range = parseRange(request.nextUrl.searchParams.get("range"));
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

      const projectIds = publishedProjects.map((p) => p.id);

      // Get analytics events for all projects
      const events = projectIds.length > 0
        ? await prisma.analyticsEvent.findMany({
            where: { projectId: { in: projectIds }, createdAt: { gte: since } },
            select: {
              projectId: true,
              sessionId: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          })
        : [];

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

      const projects = publishedProjects.map((p) => {
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

      return {
        totalPageviews,
        totalVisitors,
        publishedProjects: publishedProjects.length,
        projects,
        daily,
        tokenUsage,
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
