"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useSupabaseUser, useSupabaseAuth } from "@/lib/supabase-auth/client";

export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Date | null;
  lastLoginAt: Date | null;
  projectCount: number;
  appTokens: number;
}

export interface CompatibleUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: CompatibleUser | null;
  userData: UserData | null;
  loading: boolean;
  isNewUser: boolean;
  clearNewUser: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: authUser, isLoaded: authLoaded, isSignedIn } = useSupabaseUser();
  const { openSignIn, signOut: authSignOut } = useSupabaseAuth();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  // Fetch user data from Prisma via API
  const fetchUserData = useCallback(async () => {
    if (!authUser || !isSignedIn) {
      setUserData(null);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/user/me');
      if (response.ok) {
        const data = await response.json();
        setUserData(data);

        // Check if user was just created (based on createdAt being very recent)
        const createdAt = new Date(data.createdAt);
        const now = new Date();
        const diffInMinutes = (now.getTime() - createdAt.getTime()) / 1000 / 60;

        if (diffInMinutes < 1) {
          setIsNewUser(true);
        }
      } else {
        const data = await response.json().catch(() => ({}));
        console.error('Failed to fetch user data', data?.error || response.status);
        setUserData(null);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserData(null);
    } finally {
      setLoading(false);
    }
  }, [authUser, isSignedIn]);

  // Fetch user data when auth user changes
  useEffect(() => {
    if (!authLoaded) {
      return;
    }

    if (isSignedIn && authUser) {
      fetchUserData();
    } else {
      setUserData(null);
      setIsNewUser(false);
      setLoading(false);
    }
  }, [authLoaded, isSignedIn, authUser, fetchUserData]);

  const signInWithGoogle = async () => {
    // Preserve current URL for redirect after auth
    const currentUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
    await openSignIn({
      redirectUrl: currentUrl,
    });
  };

  const signOut = async () => {
    await authSignOut();
    setUserData(null);
    setIsNewUser(false);
  };

  const clearNewUser = useCallback(() => {
    setIsNewUser(false);
  }, []);

  const refreshUserData = useCallback(async () => {
    if (!authUser || !isSignedIn) return;

    try {
      const response = await fetch('/api/user/me');
      if (response.ok) {
        const data = await response.json();
        console.log(`[AuthContext] Refreshing user data. AppTokens: ${data.appTokens || 0}`);
        setUserData(data);
      } else {
        console.error('[AuthContext] Failed to refresh user data');
      }
    } catch (error) {
      console.error("Error refreshing user data:", error);
    }
  }, [authUser, isSignedIn]);

  // Create a compatible user object for components expecting Firebase user
  const compatibleUser: CompatibleUser | null = authUser ? {
    uid: authUser.id,
    email: authUser.email || null,
    displayName: authUser.fullName || authUser.username || null,
    photoURL: authUser.imageUrl || null,
  } : null;

  return (
    <AuthContext.Provider value={{
      user: compatibleUser,
      userData,
      loading,
      isNewUser,
      clearNewUser,
      signInWithGoogle,
      signOut,
      refreshUserData
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

