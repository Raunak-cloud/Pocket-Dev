"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";

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

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  isNewUser: boolean;
  clearNewUser: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function createOrUpdateUser(user: User): Promise<{ data: UserData; isNew: boolean }> {
  if (!db) {
    throw new Error("Firebase Firestore is not initialized");
  }
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // Create new user
    const newUserData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      projectCount: 0,
      appTokens: 4,
      integrationTokens: 10,
    };
    await setDoc(userRef, newUserData);
    return {
      data: {
        ...newUserData,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      },
      isNew: true,
    };
  } else {
    // Update last login
    await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
    const data = userSnap.data();
    return {
      data: {
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL,
        createdAt: data.createdAt?.toDate() || null,
        lastLoginAt: new Date(),
        projectCount: data.projectCount || 0,
        appTokens: data.appTokens || 0,
        integrationTokens: data.integrationTokens || 0,
      },
      isNew: false,
    };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    // Check if auth is available (it may be null during SSR)
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const result = await createOrUpdateUser(user);
          setUserData(result.data);
          if (result.isNew) {
            setIsNewUser(true);
          }
        } catch (error) {
          console.error("Error creating/updating user:", error);
        }
      } else {
        setUserData(null);
        setIsNewUser(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!auth) {
      throw new Error("Firebase auth is not initialized");
    }
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      const userResult = await createOrUpdateUser(result.user);
      setUserData(userResult.data);
      if (userResult.isNew) {
        setIsNewUser(true);
      }
    }
  };

  const signOut = async () => {
    if (!auth) {
      throw new Error("Firebase auth is not initialized");
    }
    await firebaseSignOut(auth);
    setUserData(null);
    setIsNewUser(false);
  };

  const clearNewUser = useCallback(() => {
    setIsNewUser(false);
  }, []);

  const refreshUserData = useCallback(async () => {
    if (!user || !db) return;
    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        setUserData({
          uid: data.uid,
          email: data.email,
          displayName: data.displayName,
          photoURL: data.photoURL,
          createdAt: data.createdAt?.toDate() || null,
          lastLoginAt: data.lastLoginAt?.toDate() || null,
          projectCount: data.projectCount || 0,
          appTokens: data.appTokens || 0,
          integrationTokens: data.integrationTokens || 0,
        });
      }
    } catch (error) {
      console.error("Error refreshing user data:", error);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, userData, loading, isNewUser, clearNewUser, signInWithGoogle, signOut, refreshUserData }}>
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
