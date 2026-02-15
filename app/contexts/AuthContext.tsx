"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useUser, useClerk } from "@clerk/nextjs";

export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Date | null;
  lastLoginAt: Date | null;
  projectCount: number;
  appTokens: number;
  integrationTokens: number;
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
  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { openSignIn, signOut: clerkSignOut } = useClerk();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  // Fetch user data from Prisma via API
  const fetchUserData = useCallback(async () => {
    if (!clerkUser || !isSignedIn) {
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
        console.error('Failed to fetch user data');
        setUserData(null);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserData(null);
    } finally {
      setLoading(false);
    }
  }, [clerkUser, isSignedIn]);

  // Fetch user data when Clerk user changes
  useEffect(() => {
    if (!clerkLoaded) {
      return;
    }

    if (isSignedIn && clerkUser) {
      fetchUserData();
    } else {
      setUserData(null);
      setIsNewUser(false);
      setLoading(false);
    }
  }, [clerkLoaded, isSignedIn, clerkUser, fetchUserData]);

  const signInWithGoogle = async () => {
    await openSignIn({
      redirectUrl: '/',
    });
  };

  const signOut = async () => {
    await clerkSignOut();
    setUserData(null);
    setIsNewUser(false);
  };

  const clearNewUser = useCallback(() => {
    setIsNewUser(false);
  }, []);

  const refreshUserData = useCallback(async () => {
    if (!clerkUser || !isSignedIn) return;

    try {
      const response = await fetch('/api/user/me');
      if (response.ok) {
        const data = await response.json();
        console.log(`[AuthContext] Refreshing user data. AppTokens: ${data.appTokens || 0}, IntegrationTokens: ${data.integrationTokens || 0}`);
        setUserData(data);
      } else {
        console.error('[AuthContext] Failed to refresh user data');
      }
    } catch (error) {
      console.error("Error refreshing user data:", error);
    }
  }, [clerkUser, isSignedIn]);

  // Create a compatible user object for components expecting Firebase user
  const compatibleUser: CompatibleUser | null = clerkUser ? {
    uid: clerkUser.id,
    email: clerkUser.emailAddresses[0]?.emailAddress || null,
    displayName: clerkUser.fullName || clerkUser.username || null,
    photoURL: clerkUser.imageUrl || null,
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
