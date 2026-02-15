import { prisma } from './prisma';
import type { User } from '@clerk/nextjs/server';

/**
 * Get user data from Prisma database by Clerk user ID
 */
export async function getUserByClerkId(clerkUserId: string) {
  return await prisma.user.findUnique({
    where: { clerkUserId },
  });
}

/**
 * Create a new user in the database from Clerk user data
 */
export async function createUser(clerkUser: User) {
  const email = clerkUser.emailAddresses[0]?.emailAddress || null;
  const displayName = clerkUser.fullName || clerkUser.username || null;
  const photoURL = clerkUser.imageUrl || null;

  return await prisma.user.upsert({
    where: { clerkUserId: clerkUser.id },
    create: {
      clerkUserId: clerkUser.id,
      email,
      displayName,
      photoURL,
      lastLoginAt: new Date(),
      // Default token balances for new users
      appTokens: 4,
      integrationTokens: 10,
    },
    update: {
      email,
      displayName,
      photoURL,
      lastLoginAt: new Date(),
    },
  });
}

/**
 * Update user's last login timestamp
 */
export async function updateUserLastLogin(clerkUserId: string) {
  return await prisma.user.update({
    where: { clerkUserId },
    data: { lastLoginAt: new Date() },
  });
}

/**
 * Update user token balances
 */
export async function updateUserTokens(
  userId: string,
  appTokens: number,
  integrationTokens: number
) {
  return await prisma.user.update({
    where: { id: userId },
    data: {
      appTokens,
      integrationTokens,
    },
  });
}

/**
 * Atomically deduct app tokens with transaction logging
 */
export async function deductAppTokens(
  userId: string,
  amount: number,
  reason: string,
  projectId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      // Get current user data
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const currentBalance = user.appTokens;
      if (currentBalance < amount) {
        throw new Error('Insufficient app tokens');
      }

      const newBalance = currentBalance - amount;

      // Update user balance
      await tx.user.update({
        where: { id: userId },
        data: { appTokens: newBalance },
      });

      // Log transaction
      await tx.tokenTransaction.create({
        data: {
          userId,
          type: 'deduction',
          tokenType: 'app',
          amount: -amount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          reason,
          projectId: projectId || null,
        },
      });
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to deduct app tokens';
    console.error('[db-utils] deductAppTokens error:', message);
    return { success: false, error: message };
  }
}

/**
 * Atomically deduct integration token with transaction logging
 */
export async function deductIntegrationToken(
  userId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      // Get current user data
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const currentBalance = user.integrationTokens;
      if (currentBalance < 1) {
        throw new Error('Insufficient integration tokens');
      }

      const newBalance = currentBalance - 1;

      // Update user balance
      await tx.user.update({
        where: { id: userId },
        data: { integrationTokens: newBalance },
      });

      // Log transaction
      await tx.tokenTransaction.create({
        data: {
          userId,
          type: 'deduction',
          tokenType: 'integration',
          amount: -1,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          reason,
        },
      });
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to deduct integration token';
    console.error('[db-utils] deductIntegrationToken error:', message);
    return { success: false, error: message };
  }
}

/**
 * Credit tokens to user (for purchases, refunds, etc.)
 */
export async function creditTokens(
  userId: string,
  amount: number,
  tokenType: 'app' | 'integration',
  reason: string,
  stripePaymentIntentId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      // Check for duplicate transaction (idempotency)
      if (stripePaymentIntentId) {
        const existingTx = await tx.tokenTransaction.findUnique({
          where: { stripePaymentIntentId },
        });
        if (existingTx) {
          console.log(`[db-utils] Duplicate transaction detected: ${stripePaymentIntentId}`);
          return; // Already processed
        }
      }

      // Get current user data
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const currentBalance = tokenType === 'app' ? user.appTokens : user.integrationTokens;
      const newBalance = currentBalance + amount;

      // Update user balance
      await tx.user.update({
        where: { id: userId },
        data: {
          [tokenType === 'app' ? 'appTokens' : 'integrationTokens']: newBalance,
        },
      });

      // Log transaction
      await tx.tokenTransaction.create({
        data: {
          userId,
          type: 'credit',
          tokenType,
          amount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          reason,
          stripePaymentIntentId: stripePaymentIntentId || null,
        },
      });
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to credit tokens';
    console.error('[db-utils] creditTokens error:', message);
    return { success: false, error: message };
  }
}

/**
 * Check if user has sufficient app tokens
 */
export async function checkAppTokenBalance(
  userId: string,
  required: number
): Promise<{ sufficient: boolean; balance: number }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { appTokens: true },
    });

    if (!user) {
      return { sufficient: false, balance: 0 };
    }

    return {
      sufficient: user.appTokens >= required,
      balance: user.appTokens,
    };
  } catch (error) {
    console.error('[db-utils] checkAppTokenBalance error:', error);
    return { sufficient: false, balance: 0 };
  }
}
