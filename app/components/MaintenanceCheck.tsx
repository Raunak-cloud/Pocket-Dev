'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { getMaintenanceStatus, isUserAdmin } from '@/lib/maintenance';

/**
 * Component that checks maintenance mode and redirects users if needed.
 * Place this in the root layout to check on every page.
 */
export default function MaintenanceCheck() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkMaintenance = async () => {
      // Don't check if already on maintenance page
      if (pathname === '/maintenance') {
        setChecking(false);
        return;
      }

      try {
        // Get maintenance status
        const status = await getMaintenanceStatus();

        if (status.enabled) {
          // Check if user is admin
          if (user) {
            const adminStatus = await isUserAdmin(user);
            if (adminStatus) {
              // Admin can bypass maintenance mode
              console.log('Admin user - bypassing maintenance mode');
              setChecking(false);
              return;
            }
          }

          // Redirect non-admin users to maintenance page
          console.log('Maintenance mode active - redirecting to maintenance page');
          router.push('/maintenance');
        }
      } catch (error) {
        console.error('Error checking maintenance status:', error);
        // On error, allow access (fail open)
      } finally {
        setChecking(false);
      }
    };

    // Wait for auth to load before checking
    if (!authLoading) {
      checkMaintenance();
    }
  }, [pathname, user, authLoading, router]);

  // Don't render anything - this is just a checker
  return null;
}
