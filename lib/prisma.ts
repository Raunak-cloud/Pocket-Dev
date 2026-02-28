import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

function isRetryableError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  // Cached plan errors (column type changes)
  if (/cached plan must not change result type/i.test(msg)) return true;
  // Connection errors (stale pool after network change, timeouts, etc.)
  if (/Can't reach database server/i.test(msg)) return true;
  if (/Connection refused/i.test(msg)) return true;
  if (/Connection reset/i.test(msg)) return true;
  if (/ECONNRESET/i.test(msg)) return true;
  if (/ECONNREFUSED/i.test(msg)) return true;
  if (/ETIMEDOUT/i.test(msg)) return true;
  if (/socket hang up/i.test(msg)) return true;
  if (/connection closed/i.test(msg)) return true;
  if (/prepared statement .* does not exist/i.test(msg)) return true;
  // Prisma engine errors
  const code = (error as { code?: string }).code;
  if (code === 'P1001' || code === 'P1002' || code === 'P1008' || code === 'P1017') return true;
  return false;
}

export async function withPrismaRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isRetryableError(error)) {
      throw error;
    }

    // Reset pooled Prisma connection and retry once.
    console.warn('[Prisma] Retryable error, reconnecting:', (error as Error).message);
    await prisma.$disconnect();
    return await fn();
  }
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
