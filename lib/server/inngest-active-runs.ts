import { prisma, withPrismaRetry } from "@/lib/prisma";

const TABLE_NAME = "inngest_active_runs";
const ACTIVE_RUN_TTL_MS = 12 * 60 * 60 * 1000;

let initTablePromise: Promise<void> | null = null;

type ActiveRunRow = {
  auth_user_id: string;
  run_id: string;
  mode: string;
  prompt: string;
  backend_enabled: boolean;
  payments_enabled: boolean;
  source_project_id: string | null;
  started_at: Date;
  updated_at: Date;
  expires_at: Date;
};

export type ActiveRunMode = "generation" | "edit";

export type ActiveRunRecord = {
  authUserId: string;
  runId: string;
  mode: ActiveRunMode;
  prompt: string;
  backendEnabled: boolean;
  paymentsEnabled: boolean;
  sourceProjectId: string | null;
  startedAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

type UpsertActiveRunInput = {
  authUserId: string;
  runId: string;
  mode: ActiveRunMode;
  prompt: string;
  backendEnabled: boolean;
  paymentsEnabled: boolean;
  sourceProjectId?: string | null;
};

function toActiveRunRecord(row: ActiveRunRow): ActiveRunRecord {
  return {
    authUserId: row.auth_user_id,
    runId: row.run_id,
    mode: row.mode === "edit" ? "edit" : "generation",
    prompt: row.prompt,
    backendEnabled: !!row.backend_enabled,
    paymentsEnabled: !!row.payments_enabled,
    sourceProjectId: row.source_project_id ?? null,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}

async function ensureActiveRunsTable() {
  if (!initTablePromise) {
    initTablePromise = (async () => {
      await withPrismaRetry(() =>
        prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
            auth_user_id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL UNIQUE,
            mode TEXT NOT NULL CHECK (mode IN ('generation', 'edit')),
            prompt TEXT NOT NULL,
            backend_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            payments_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            source_project_id TEXT,
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL
          )
        `),
      );

      await withPrismaRetry(() =>
        prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_expires_at
          ON ${TABLE_NAME} (expires_at)
        `),
      );
    })().catch((error) => {
      initTablePromise = null;
      throw error;
    });
  }

  return initTablePromise;
}

async function cleanupExpiredActiveRuns() {
  await withPrismaRetry(() =>
    prisma.$executeRawUnsafe(`DELETE FROM ${TABLE_NAME} WHERE expires_at <= NOW()`),
  );
}

export async function upsertActiveRun(
  input: UpsertActiveRunInput,
): Promise<void> {
  const authUserId = input.authUserId.trim();
  const runId = input.runId.trim();
  if (!authUserId || !runId) return;

  await ensureActiveRunsTable();
  await cleanupExpiredActiveRuns();

  const expiresAt = new Date(Date.now() + ACTIVE_RUN_TTL_MS);
  const mode = input.mode === "edit" ? "edit" : "generation";
  const prompt = String(input.prompt || "");
  const sourceProjectId =
    typeof input.sourceProjectId === "string" && input.sourceProjectId.trim()
      ? input.sourceProjectId.trim()
      : null;

  await withPrismaRetry(() =>
    prisma.$executeRaw`
      INSERT INTO inngest_active_runs (
        auth_user_id,
        run_id,
        mode,
        prompt,
        backend_enabled,
        payments_enabled,
        source_project_id,
        started_at,
        updated_at,
        expires_at
      )
      VALUES (
        ${authUserId},
        ${runId},
        ${mode},
        ${prompt},
        ${input.backendEnabled === true},
        ${input.paymentsEnabled === true},
        ${sourceProjectId},
        NOW(),
        NOW(),
        ${expiresAt}
      )
      ON CONFLICT (auth_user_id) DO UPDATE SET
        run_id = EXCLUDED.run_id,
        mode = EXCLUDED.mode,
        prompt = EXCLUDED.prompt,
        backend_enabled = EXCLUDED.backend_enabled,
        payments_enabled = EXCLUDED.payments_enabled,
        source_project_id = EXCLUDED.source_project_id,
        started_at = NOW(),
        updated_at = NOW(),
        expires_at = EXCLUDED.expires_at
    `,
  );
}

export async function getActiveRunByAuthUserId(
  authUserId: string,
): Promise<ActiveRunRecord | null> {
  const safeAuthUserId = authUserId.trim();
  if (!safeAuthUserId) return null;

  await ensureActiveRunsTable();
  await cleanupExpiredActiveRuns();

  const rows = await withPrismaRetry(() =>
    prisma.$queryRaw<ActiveRunRow[]>`
      SELECT
        auth_user_id,
        run_id,
        mode,
        prompt,
        backend_enabled,
        payments_enabled,
        source_project_id,
        started_at,
        updated_at,
        expires_at
      FROM inngest_active_runs
      WHERE auth_user_id = ${safeAuthUserId}
      LIMIT 1
    `,
  );

  const row = rows[0];
  if (!row) return null;
  return toActiveRunRecord(row);
}

export async function clearActiveRunByAuthUserId(
  authUserId: string,
  runId?: string,
): Promise<void> {
  const safeAuthUserId = authUserId.trim();
  if (!safeAuthUserId) return;

  await ensureActiveRunsTable();

  if (runId && runId.trim()) {
    const safeRunId = runId.trim();
    await withPrismaRetry(() =>
      prisma.$executeRaw`
        DELETE FROM inngest_active_runs
        WHERE auth_user_id = ${safeAuthUserId}
          AND run_id = ${safeRunId}
      `,
    );
    return;
  }

  await withPrismaRetry(() =>
    prisma.$executeRaw`
      DELETE FROM inngest_active_runs
      WHERE auth_user_id = ${safeAuthUserId}
    `,
  );
}

export async function clearActiveRunByRunId(runId: string): Promise<void> {
  const safeRunId = runId.trim();
  if (!safeRunId) return;

  await ensureActiveRunsTable();

  await withPrismaRetry(() =>
    prisma.$executeRaw`
      DELETE FROM inngest_active_runs
      WHERE run_id = ${safeRunId}
    `,
  );
}
