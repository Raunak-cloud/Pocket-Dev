import { NextRequest, NextResponse } from "next/server";
import {
  ensureSupabasePoolCapacity,
  getSupabasePoolStats,
  upsertPreprovisionedPoolEntries,
} from "@/lib/supabase-project-pool";

function isAuthorized(request: NextRequest): boolean {
  const adminToken = process.env.SUPABASE_POOL_ADMIN_TOKEN;
  if (!adminToken) return true;

  const provided =
    request.headers.get("x-supabase-pool-admin-token") ||
    request.headers.get("x-admin-token");
  return provided === adminToken;
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stats = await getSupabasePoolStats();
    return NextResponse.json({ success: true, stats });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load pool stats",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      minReady?: number;
      syncPreprovisioned?: boolean;
    };

    if (body.syncPreprovisioned) {
      await upsertPreprovisionedPoolEntries();
    }

    const minReady =
      typeof body.minReady === "number" && Number.isFinite(body.minReady)
        ? Math.max(0, Math.floor(body.minReady))
        : null;
    if (minReady === null) {
      await ensureSupabasePoolCapacity();
    } else {
      await ensureSupabasePoolCapacity(minReady);
    }

    const stats = await getSupabasePoolStats();
    return NextResponse.json({ success: true, stats });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to refill pool",
      },
      { status: 500 },
    );
  }
}
