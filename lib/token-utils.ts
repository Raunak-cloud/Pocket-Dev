import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function getAdminDb() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

export async function deductAppTokens(
  userId: string,
  amount: number,
  reason: string,
  projectId?: string
): Promise<{ success: boolean; error?: string }> {
  const adminDb = getAdminDb();
  const userRef = adminDb.collection("users").doc(userId);

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error("User not found");
      }

      const currentBalance = userDoc.data()?.appTokens || 0;
      if (currentBalance < amount) {
        throw new Error("Insufficient app tokens");
      }

      const newBalance = currentBalance - amount;
      transaction.update(userRef, { appTokens: newBalance });

      const txRef = adminDb.collection("tokenTransactions").doc();
      transaction.set(txRef, {
        userId,
        type: "deduction",
        tokenType: "app",
        amount: -amount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        reason,
        projectId: projectId || null,
        createdAt: FieldValue.serverTimestamp(),
      });

      return { success: true };
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to deduct app tokens";
    console.error("[token-utils] deductAppTokens error:", message);
    return { success: false, error: message };
  }
}

export async function deductIntegrationToken(
  userId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const adminDb = getAdminDb();
  const userRef = adminDb.collection("users").doc(userId);

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error("User not found");
      }

      const currentBalance = userDoc.data()?.integrationTokens || 0;
      if (currentBalance < 1) {
        throw new Error("Insufficient integration tokens");
      }

      const newBalance = currentBalance - 1;
      transaction.update(userRef, { integrationTokens: newBalance });

      const txRef = adminDb.collection("tokenTransactions").doc();
      transaction.set(txRef, {
        userId,
        type: "deduction",
        tokenType: "integration",
        amount: -1,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        reason,
        createdAt: FieldValue.serverTimestamp(),
      });

      return { success: true };
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to deduct integration token";
    console.error("[token-utils] deductIntegrationToken error:", message);
    return { success: false, error: message };
  }
}

export async function checkAppTokenBalance(
  userId: string,
  required: number
): Promise<{ sufficient: boolean; balance: number }> {
  const adminDb = getAdminDb();
  const userRef = adminDb.collection("users").doc(userId);

  try {
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return { sufficient: false, balance: 0 };
    }

    const balance = userDoc.data()?.appTokens || 0;
    return { sufficient: balance >= required, balance };
  } catch (error) {
    console.error("[token-utils] checkAppTokenBalance error:", error);
    return { sufficient: false, balance: 0 };
  }
}
