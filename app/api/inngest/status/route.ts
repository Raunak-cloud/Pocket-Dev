/**
 * Inngest Status API
 *
 * Durable status store for Inngest workflow polling.
 *
 * NOTE:
 * In-memory maps are unreliable on serverless platforms (Vercel) because
 * POST/GET requests can hit different instances. This route persists state
 * in Postgres so completion/progress/cancel/failure are visible across
 * all instances and regions.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, withPrismaRetry } from "@/lib/prisma";

const COMPLETION_TTL_MS = 24 * 60 * 60 * 1000;
const PROGRESS_TTL_MS = 60 * 60 * 1000;
const CANCEL_TTL_MS = 60 * 60 * 1000;
const FAILURE_TTL_MS = 60 * 60 * 1000;

type StatusRow = {
  project_id: string;
  completions_json: unknown;
  progress_json: unknown;
  cancelled: boolean;
  failed: boolean;
  error: string | null;
  expires_at: Date;
};

type StatusState = {
  completions: Record<string, unknown>;
  progress: string[];
  cancelled: boolean;
  failed: boolean;
  error: string | null;
};

const TABLE_NAME = "inngest_status_events";
let initTablePromise: Promise<void> | null = null;

function parseCompletions(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function parseProgress(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string");
}

function toState(row: StatusRow | null): StatusState {
  if (!row) {
    return {
      completions: {},
      progress: [],
      cancelled: false,
      failed: false,
      error: null,
    };
  }

  return {
    completions: parseCompletions(row.completions_json),
    progress: parseProgress(row.progress_json),
    cancelled: !!row.cancelled,
    failed: !!row.failed,
    error: row.error ?? null,
  };
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

async function ensureStatusTable() {
  if (!initTablePromise) {
    initTablePromise = (async () => {
      await withPrismaRetry(() =>
        prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
            project_id TEXT PRIMARY KEY,
            completions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            progress_json JSONB NOT NULL DEFAULT '[]'::jsonb,
            cancelled BOOLEAN NOT NULL DEFAULT FALSE,
            failed BOOLEAN NOT NULL DEFAULT FALSE,
            error TEXT,
            expires_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `),
      );

      await withPrismaRetry(() =>
        prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_expires_at
          ON ${TABLE_NAME} (expires_at)
        `),
      );
    })().catch((err) => {
      initTablePromise = null;
      throw err;
    });
  }

  return initTablePromise;
}

async function cleanupExpired() {
  await withPrismaRetry(() =>
    prisma.$executeRawUnsafe(
      `DELETE FROM ${TABLE_NAME} WHERE expires_at <= NOW()`,
    ),
  );
}

async function getStatus(projectId: string): Promise<StatusRow | null> {
  const rows = await withPrismaRetry(() =>
    prisma.$queryRaw<StatusRow[]>`
      SELECT
        project_id,
        completions_json,
        progress_json,
        cancelled,
        failed,
        error,
        expires_at
      FROM inngest_status_events
      WHERE project_id = ${projectId}
      LIMIT 1
    `,
  );
  return rows[0] ?? null;
}

async function deleteStatus(projectId: string) {
  await withPrismaRetry(() =>
    prisma.$executeRaw`
      DELETE FROM inngest_status_events
      WHERE project_id = ${projectId}
    `,
  );
}

async function upsertStatus(
  projectId: string,
  state: StatusState,
  expiresAt: Date,
) {
  const completions = JSON.stringify(state.completions);
  const progress = JSON.stringify(state.progress);

  await withPrismaRetry(() =>
    prisma.$executeRaw`
      INSERT INTO inngest_status_events (
        project_id,
        completions_json,
        progress_json,
        cancelled,
        failed,
        error,
        expires_at,
        updated_at
      )
      VALUES (
        ${projectId},
        ${completions}::jsonb,
        ${progress}::jsonb,
        ${state.cancelled},
        ${state.failed},
        ${state.error},
        ${expiresAt},
        NOW()
      )
      ON CONFLICT (project_id) DO UPDATE SET
        completions_json = EXCLUDED.completions_json,
        progress_json = EXCLUDED.progress_json,
        cancelled = EXCLUDED.cancelled,
        failed = EXCLUDED.failed,
        error = EXCLUDED.error,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `,
  );
}

export async function GET(request: NextRequest) {
  try {
    await ensureStatusTable();
    await cleanupExpired();

    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get("projectId");
    const event = searchParams.get("event");

    if (!projectId || !event) {
      return NextResponse.json(
        { error: "Missing projectId or event" },
        { status: 400 },
      );
    }

    const row = await getStatus(projectId);
    if (!row) {
      return NextResponse.json({ completed: false }, { status: 202 });
    }

    if (row.expires_at.getTime() <= Date.now()) {
      await deleteStatus(projectId);
      return NextResponse.json({ completed: false }, { status: 202 });
    }

    const state = toState(row);

    if (state.cancelled) {
      return NextResponse.json({ cancelled: true }, { status: 200 });
    }

    if (state.failed) {
      return NextResponse.json(
        { failed: true, error: state.error ?? "Generation failed" },
        { status: 200 },
      );
    }

    if (hasOwn(state.completions, event)) {
      return NextResponse.json(state.completions[event]);
    }

    if (state.progress.length > 0) {
      return NextResponse.json(
        {
          completed: false,
          progress: state.progress,
        },
        { status: 202 },
      );
    }

    return NextResponse.json({ completed: false }, { status: 202 });
  } catch (error) {
    console.error("[GET /api/inngest/status] Error:", error);
    return NextResponse.json(
      { error: "Failed to read status" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureStatusTable();
    await cleanupExpired();

    const body = (await request.json()) as Record<string, unknown>;
    const rawProjectId = body.projectId;
    const projectId =
      typeof rawProjectId === "string" ? rawProjectId.trim() : "";
    const rawEvent = body.event;
    const event = typeof rawEvent === "string" ? rawEvent.trim() : "";

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const reset = body.reset === true;
    const cancel = body.cancel === true;
    const failed = body.failed === true;
    const progress =
      typeof body.progress === "string" ? body.progress : undefined;
    const failureError =
      typeof body.error === "string" && body.error.trim().length > 0
        ? body.error
        : "Generation failed";
    const hasData = hasOwn(body, "data");
    const completionData = body.data;

    if (reset) {
      await deleteStatus(projectId);
      return NextResponse.json({ success: true, reset: true });
    }

    const current = toState(await getStatus(projectId));

    if (cancel) {
      await upsertStatus(
        projectId,
        {
          completions: {},
          progress: [],
          cancelled: true,
          failed: false,
          error: null,
        },
        new Date(Date.now() + CANCEL_TTL_MS),
      );
      console.log(`[Inngest] Job cancelled: ${projectId}`);
      return NextResponse.json({ success: true, cancelled: true });
    }

    if (failed) {
      await upsertStatus(
        projectId,
        {
          completions: {},
          progress: current.progress,
          cancelled: false,
          failed: true,
          error: failureError,
        },
        new Date(Date.now() + FAILURE_TTL_MS),
      );
      console.log(`[Inngest] Job failed: ${projectId} — ${failureError}`);
      return NextResponse.json({ success: true, failed: true });
    }

    if (!event) {
      return NextResponse.json({ error: "Missing event" }, { status: 400 });
    }

    if (progress) {
      const nextProgress = [...current.progress, progress];
      await upsertStatus(
        projectId,
        {
          completions: current.completions,
          progress: nextProgress.slice(-400),
          cancelled: false,
          failed: false,
          error: null,
        },
        new Date(Date.now() + PROGRESS_TTL_MS),
      );
      return NextResponse.json({ success: true });
    }

    if (hasData) {
      const nextCompletions = { ...current.completions, [event]: completionData };
      await upsertStatus(
        projectId,
        {
          completions: nextCompletions,
          progress: current.progress,
          cancelled: false,
          failed: false,
          error: null,
        },
        new Date(Date.now() + COMPLETION_TTL_MS),
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Missing data or progress" },
      { status: 400 },
    );
  } catch (error) {
    console.error("[POST /api/inngest/status] Error:", error);
    return NextResponse.json(
      { error: "Failed to persist status" },
      { status: 500 },
    );
  }
}

// Deprecated helper kept for compatibility with older imports.
export function isJobCancelled(projectId: string): boolean {
  console.warn(
    `[Inngest] isJobCancelled("${projectId}") is deprecated in serverless mode; use /api/inngest/status GET checks instead.`,
  );
  return false;
}
