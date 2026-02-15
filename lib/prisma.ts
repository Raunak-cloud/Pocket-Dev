import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

function isCachedPlanError(error: unknown) {
  return (
    error instanceof Error &&
    /cached plan must not change result type/i.test(error.message)
  );
}

export async function withPrismaRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isCachedPlanError(error)) {
      throw error;
    }

    // Reset pooled Prisma connection and retry once for changed column types.
    await prisma.$disconnect();
    return await fn();
  }
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
