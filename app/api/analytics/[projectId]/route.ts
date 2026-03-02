import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/supabase-auth/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { createUser } from "@/lib/db-utils";

function parseRange(range: string | null): number {
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return 7; // default 7d
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const range = parseRange(request.nextUrl.searchParams.get("range"));
    const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000);

    const data = await withPrismaRetry(async () => {
      // Verify user owns this project
      let user = await prisma.user.findUnique({ where: { authUserId } });
      if (!user) {
        const authUser = await currentUser();
        if (!authUser) throw new Error("User not found");
        user = await createUser(authUser);
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { userId: true },
      });
      if (!project || project.userId !== user.id) {
        return null; // not found or not owner
      }

      // Fetch events in range
      const events = await prisma.analyticsEvent.findMany({
        where: { projectId, createdAt: { gte: since } },
        select: {
          pathname: true,
          referrer: true,
          device: true,
          browser: true,
          country: true,
          sessionId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });

      // Aggregate
      const totalPageviews = events.length;
      const uniqueSessions = new Set(events.map((e) => e.sessionId).filter(Boolean));
      const totalVisitors = uniqueSessions.size;

      // Daily aggregation
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

      // Top pages
      const pageMap = new Map<string, number>();
      for (const e of events) {
        pageMap.set(e.pathname, (pageMap.get(e.pathname) || 0) + 1);
      }
      const topPages = Array.from(pageMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([pathname, count]) => ({ pathname, count }));

      // Devices
      const deviceMap = new Map<string, number>();
      for (const e of events) {
        const d = e.device || "unknown";
        deviceMap.set(d, (deviceMap.get(d) || 0) + 1);
      }
      const devices = Array.from(deviceMap.entries()).map(([name, count]) => ({ name, count }));

      // Sources (referrers)
      const sourceMap = new Map<string, number>();
      for (const e of events) {
        let source = "Direct";
        if (e.referrer) {
          try {
            source = new URL(e.referrer).hostname;
          } catch {
            source = e.referrer.slice(0, 50);
          }
        }
        sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
      }
      const sources = Array.from(sourceMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

      // Browsers
      const browserMap = new Map<string, number>();
      for (const e of events) {
        const b = e.browser || "Unknown";
        browserMap.set(b, (browserMap.get(b) || 0) + 1);
      }
      const browsers = Array.from(browserMap.entries()).map(([name, count]) => ({ name, count }));

      // Countries
      const countryMap = new Map<string, number>();
      for (const e of events) {
        const c = e.country || "Unknown";
        countryMap.set(c, (countryMap.get(c) || 0) + 1);
      }
      const countries = Array.from(countryMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([name, count]) => ({ name, count }));

      return { totalPageviews, totalVisitors, daily, topPages, devices, sources, browsers, countries };
    });

    if (!data) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[analytics/project] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const isConnectionError = /ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up|Can't reach database/i.test(message);
    return NextResponse.json(
      { error: isConnectionError ? "Database connection error" : "Internal server error" },
      { status: isConnectionError ? 503 : 500 },
    );
  }
}
