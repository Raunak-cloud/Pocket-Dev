import { prisma, withPrismaRetry } from "@/lib/prisma";

const TABLE_NAME = "inngest_completion_notices";
const NOTICE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let initTablePromise: Promise<void> | null = null;

type CompletionNoticeRow = {
  id: number;
  auth_user_id: string;
  run_id: string;
  mode: string;
  message: string;
  viewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
};

export type CompletionNoticeMode = "generation" | "edit";

export type CompletionNoticeRecord = {
  id: number;
  authUserId: string;
  runId: string;
  mode: CompletionNoticeMode;
  message: string;
  viewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

type UpsertCompletionNoticeInput = {
  authUserId: string;
  runId: string;
  mode: CompletionNoticeMode;
  message: string;
};

function toCompletionNoticeRecord(
  row: CompletionNoticeRow,
): CompletionNoticeRecord {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    runId: row.run_id,
    mode: row.mode === "edit" ? "edit" : "generation",
    message: row.message,
    viewedAt: row.viewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}

async function ensureCompletionNoticesTable() {
  if (!initTablePromise) {
    initTablePromise = (async () => {
      await withPrismaRetry(() =>
        prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
            id BIGSERIAL PRIMARY KEY,
            auth_user_id TEXT NOT NULL,
            run_id TEXT NOT NULL UNIQUE,
            mode TEXT NOT NULL CHECK (mode IN ('generation', 'edit')),
            message TEXT NOT NULL,
            viewed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL
          )
        `),
      );

      await withPrismaRetry(() =>
        prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_auth_user_unviewed
          ON ${TABLE_NAME} (auth_user_id, viewed_at, created_at DESC)
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

async function cleanupExpiredCompletionNotices() {
  await withPrismaRetry(() =>
    prisma.$executeRawUnsafe(`DELETE FROM ${TABLE_NAME} WHERE expires_at <= NOW()`),
  );
}

export async function upsertCompletionNotice(
  input: UpsertCompletionNoticeInput,
): Promise<void> {
  const authUserId = input.authUserId.trim();
  const runId = input.runId.trim();
  const message = String(input.message || "").trim();
  if (!authUserId || !runId || !message) return;

  await ensureCompletionNoticesTable();
  await cleanupExpiredCompletionNotices();

  const mode = input.mode === "edit" ? "edit" : "generation";
  const expiresAt = new Date(Date.now() + NOTICE_TTL_MS);

  await withPrismaRetry(() =>
    prisma.$executeRaw`
      INSERT INTO inngest_completion_notices (
        auth_user_id,
        run_id,
        mode,
        message,
        viewed_at,
        created_at,
        updated_at,
        expires_at
      )
      VALUES (
        ${authUserId},
        ${runId},
        ${mode},
        ${message},
        NULL,
        NOW(),
        NOW(),
        ${expiresAt}
      )
      ON CONFLICT (run_id) DO UPDATE SET
        auth_user_id = EXCLUDED.auth_user_id,
        mode = EXCLUDED.mode,
        message = EXCLUDED.message,
        viewed_at = NULL,
        updated_at = NOW(),
        expires_at = EXCLUDED.expires_at
    `,
  );
}

export async function consumeLatestCompletionNotice(
  authUserId: string,
): Promise<CompletionNoticeRecord | null> {
  const safeAuthUserId = authUserId.trim();
  if (!safeAuthUserId) return null;

  await ensureCompletionNoticesTable();
  await cleanupExpiredCompletionNotices();

  const rows = await withPrismaRetry(() =>
    prisma.$queryRaw<CompletionNoticeRow[]>`
      SELECT
        id,
        auth_user_id,
        run_id,
        mode,
        message,
        viewed_at,
        created_at,
        updated_at,
        expires_at
      FROM inngest_completion_notices
      WHERE auth_user_id = ${safeAuthUserId}
        AND viewed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `,
  );

  const row = rows[0];
  if (!row) return null;

  const updatedRows = await withPrismaRetry(() =>
    prisma.$queryRaw<CompletionNoticeRow[]>`
      UPDATE inngest_completion_notices
      SET viewed_at = NOW(), updated_at = NOW()
      WHERE id = ${row.id}
        AND viewed_at IS NULL
      RETURNING
        id,
        auth_user_id,
        run_id,
        mode,
        message,
        viewed_at,
        created_at,
        updated_at,
        expires_at
    `,
  );

  const updated = updatedRows[0];
  if (!updated) return null;
  return toCompletionNoticeRecord(updated);
}

export async function markCompletionNoticeViewed(
  authUserId: string,
  runId: string,
): Promise<void> {
  const safeAuthUserId = authUserId.trim();
  const safeRunId = runId.trim();
  if (!safeAuthUserId || !safeRunId) return;

  await ensureCompletionNoticesTable();

  await withPrismaRetry(() =>
    prisma.$executeRaw`
      UPDATE inngest_completion_notices
      SET viewed_at = NOW(), updated_at = NOW()
      WHERE auth_user_id = ${safeAuthUserId}
        AND run_id = ${safeRunId}
        AND viewed_at IS NULL
    `,
  );
}
