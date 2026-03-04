import { NextRequest, NextResponse } from "next/server";
import { getServerAppBaseUrlDebug } from "@/lib/server/app-base-url";

function isAuthorized(request: NextRequest): boolean {
  const debugToken = process.env.APP_DEBUG_TOKEN;
  if (!debugToken) {
    return process.env.NODE_ENV !== "production";
  }

  const provided =
    request.headers.get("x-app-debug-token") ||
    request.nextUrl.searchParams.get("token");

  return provided === debugToken;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const debug = getServerAppBaseUrlDebug();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...debug,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
