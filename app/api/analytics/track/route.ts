import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// In-memory rate limiter: 100 events/min per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Periodically clean up stale rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 60_000);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function truncate(str: string | null | undefined, max: number): string | null {
  if (!str) return null;
  return str.slice(0, max);
}

function deriveDevice(screenWidth: number | null | undefined): string | null {
  if (screenWidth == null) return null;
  if (screenWidth < 768) return "mobile";
  if (screenWidth < 1024) return "tablet";
  return "desktop";
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Rate limited" },
        { status: 429, headers: corsHeaders() },
      );
    }

    const body = await request.json();
    const { projectId, event, pathname, referrer, screenWidth, language, browser, sessionId } = body;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "Missing projectId" },
        { status: 400, headers: corsHeaders() },
      );
    }
    if (!pathname || typeof pathname !== "string") {
      return NextResponse.json(
        { error: "Missing pathname" },
        { status: 400, headers: corsHeaders() },
      );
    }

    // Validate project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404, headers: corsHeaders() },
      );
    }

    const country = request.headers.get("x-vercel-ip-country") || null;

    const fallbackSessionId = truncate(
      `${ip}:${request.headers.get("user-agent") || "unknown"}`,
      100,
    );
    const normalizedSessionId =
      truncate(sessionId, 100) || fallbackSessionId;

    await prisma.analyticsEvent.create({
      data: {
        projectId,
        event: truncate(event || "pageview", 50) || "pageview",
        pathname: truncate(pathname, 500)!,
        referrer: truncate(referrer, 1000),
        country: truncate(country, 10),
        device: deriveDevice(typeof screenWidth === "number" ? screenWidth : null),
        browser: truncate(browser, 50),
        screenWidth: typeof screenWidth === "number" ? Math.min(screenWidth, 10000) : null,
        language: truncate(language, 20),
        sessionId: normalizedSessionId,
      },
    });

    return NextResponse.json({ ok: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error("[analytics/track] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders() },
    );
  }
}
