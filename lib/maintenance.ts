import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const MAINTENANCE_DOC_PATH = 'system/maintenance';

export interface MaintenanceStatus {
  enabled: boolean;
  message?: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: Date;
}

/**
 * Get current maintenance mode status
 */
export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  try {
    // Check if db is available (may be null during SSR or if Firebase not initialized)
    if (!db) {
      console.warn('Firestore not initialized, maintenance mode disabled by default');
      return { enabled: false };
    }

    const docRef = doc(db, MAINTENANCE_DOC_PATH);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        enabled: data.enabled || false,
        message: data.message,
        lastUpdatedBy: data.lastUpdatedBy,
        lastUpdatedAt: data.lastUpdatedAt?.toDate(),
      };
    }

    // Default: maintenance mode is off
    return { enabled: false };
  } catch (error) {
    console.error('Error getting maintenance status:', error);
    // On error, assume maintenance mode is off to avoid blocking users
    return { enabled: false };
  }
}

/**
 * Set maintenance mode status (admin only)
 */
export async function setMaintenanceStatus(
  enabled: boolean,
  adminEmail: string,
  message?: string
): Promise<void> {
  try {
    if (!db) {
      throw new Error('Firestore is not initialized');
    }

    const docRef = doc(db, MAINTENANCE_DOC_PATH);
    await setDoc(docRef, {
      enabled,
      message: message || 'System is currently under maintenance. Please check back soon.',
      lastUpdatedBy: adminEmail,
      lastUpdatedAt: new Date(),
    });
  } catch (error) {
    console.error('Error setting maintenance status:', error);
    throw error;
  }
}

/**
 * Check if user is admin (checks both custom claim and email)
 */
export async function isUserAdmin(user: any): Promise<boolean> {
  if (!user) return false;

  try {
    // First check: Email-based admin (matches DashboardSidebar logic)
    if (user.email === 'raunak.vision@gmail.com') {
      return true;
    }

    // Second check: Firebase custom claim (if set up)
    const idTokenResult = await user.getIdTokenResult();
    return idTokenResult.claims.admin === true;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}
