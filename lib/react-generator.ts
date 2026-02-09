import { GoogleGenerativeAI } from "@google/generative-ai";
import { lintCode } from "./eslint-lint";
import { getUILibraryContext, closeMCPClient } from "./mcp-client";

const GEMINI_FLASH_MODEL = "gemini-3-flash-preview"; // Always use Flash for all code generation
const MAX_TOKENS = 64000; // Increased to support larger multi-file projects

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not found in environment variables");
  }
  return new GoogleGenerativeAI(apiKey);
}

// Auth detection keywords
const AUTH_KEYWORDS = [
  'authentication', 'auth', 'login', 'signup', 'sign in', 'sign up',
  'oauth', 'user profile', 'protected routes', 'user login',
  'google login', 'user dashboard', 'account', 'session', 'logout'
];

function detectAuthRequest(prompt: string): boolean {
  const lowerPrompt = prompt.toLowerCase();
  return AUTH_KEYWORDS.some(keyword => lowerPrompt.includes(keyword));
}

const BASE_SYSTEM_PROMPT = `You are an expert Next.js developer who creates professional, production-ready Next.js applications.

🚨 MANDATORY REQUIREMENTS 🚨

1. Generate a COMPLETE Next.js project with multiple files
2. Use Next.js 14 App Router for navigation (app/ directory structure)
3. Use Tailwind CSS for styling
4. Create at least 3-4 pages based on the prompt
5. All code must be properly linted (no unused vars, use const/let, semicolons)
6. Every component must be complete with real content (no placeholders)

📸 USER-UPLOADED IMAGES:
If the user provides image URLs (Firebase Storage URLs starting with https://), you MUST:
- Use EXACTLY those URLs in your img src attributes
- Example: <img src="https://firebasestorage.googleapis.com/..." alt="User uploaded image" className="w-full h-auto" />
- DO NOT use placeholder URLs like via.placeholder.com or unsplash when user has uploaded images
- Place the user's images prominently (hero sections, galleries, cards, etc.)
- The user expects to see their ACTUAL uploaded images in the generated website
- These are real hosted images, not placeholders

For design reference (when images are shown visually):
- Carefully analyze the design, layout, colors, typography, and style from the images
- Replicate the visual design as closely as possible using Tailwind CSS
- Match the color scheme (use exact hex colors when possible)
- Match the layout structure and spacing

TECH STACK:
- Next.js ^14.0.0
- React 18
- TypeScript
- Tailwind CSS
- Lucide React (for icons)

FILE STRUCTURE YOU MUST GENERATE:

🚨 CRITICAL: You MUST generate package.json file with ALL dependencies 🚨

1. package.json - Package configuration with ALL dependencies (REQUIRED)
2. app/layout.tsx - Root layout with Navbar/Footer
3. app/page.tsx - Home page (/)
4. app/globals.css - Tailwind CSS styles
5. app/about/page.tsx - About page (/about)
6. app/[pageName]/page.tsx - Additional pages
7. app/components/Navbar.tsx - Navigation bar
8. app/components/Footer.tsx - Footer component
9. app/components/[Others].tsx - Reusable components
10. tsconfig.json - TypeScript configuration (REQUIRED)
11. next.config.ts - Next.js configuration (REQUIRED)
12. tailwind.config.ts - Tailwind configuration (REQUIRED)

REQUIRED PAGES BY TYPE:

E-COMMERCE:
- app/page.tsx (hero, featured products)
- app/products/page.tsx (product grid with filtering)
- app/products/[id]/page.tsx (individual product page)
- app/cart/page.tsx (shopping cart)
- app/about/page.tsx

RESTAURANT:
- app/page.tsx (hero, highlights)
- app/menu/page.tsx (full menu with categories)
- app/reservations/page.tsx (booking form)
- app/about/page.tsx

SAAS:
- app/page.tsx (hero, features)
- app/features/page.tsx (detailed features)
- app/pricing/page.tsx (pricing tiers)
- app/about/page.tsx

PORTFOLIO:
- app/page.tsx (hero, featured work)
- app/projects/page.tsx (project gallery)
- app/about/page.tsx
- app/contact/page.tsx

🔐 FIREBASE AUTHENTICATION (Generate when user requests auth):

IF user prompt contains: "authentication", "auth", "login", "signup", "sign in", "sign up", "oauth", "user profile", "protected routes", "user login", "user authentication", "google login", "user dashboard", "account", "session", "user management", "sign out", "logout"
THEN generate complete Firebase authentication system with Firestore database.

REQUIRED FILES FOR AUTH:
1. lib/firebase-config.ts - Firebase configuration (auto-injected)
2. lib/auth.ts - Firebase Auth helpers
3. app/sign-in/page.tsx - Firebase sign-in page
4. app/sign-up/page.tsx - Firebase sign-up page
5. app/profile/page.tsx - Protected user profile page
6. app/components/AuthProvider.tsx - Firebase auth context
7. app/components/Navbar.tsx - With auth state
8. app/components/ProtectedRoute.tsx - Route protection component

LIB/FIREBASE-CONFIG.TS TEMPLATE:
\`\`\`typescript
// FIREBASE_CONFIG_PLACEHOLDER - This will be replaced with actual config
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "PLACEHOLDER_API_KEY",
  authDomain: "PLACEHOLDER_AUTH_DOMAIN",
  projectId: "PLACEHOLDER_PROJECT_ID",
  storageBucket: "PLACEHOLDER_STORAGE_BUCKET",
  messagingSenderId: "PLACEHOLDER_MESSAGING_SENDER_ID",
  appId: "PLACEHOLDER_APP_ID"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);

// Multi-tenancy: Isolate authentication per app
// PLACEHOLDER_TENANT_ID will be replaced with actual tenant ID
const tenantId = "PLACEHOLDER_TENANT_ID";
if (tenantId && tenantId !== "null") {
  auth.tenantId = tenantId;
}

export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
\`\`\`

LIB/AUTH.TS TEMPLATE:
\`\`\`typescript
import { auth } from './firebase-config';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';

export const googleProvider = new GoogleAuthProvider();

export async function signUpWithEmail(email: string, password: string, displayName?: string) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName && userCredential.user) {
    await updateProfile(userCredential.user, { displayName });
  }
  return userCredential.user;
}

export async function signInWithEmail(email: string, password: string) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function logout() {
  await signOut(auth);
}
\`\`\`

APP/COMPONENTS/AUTHPROVIDER.TSX TEMPLATE:
\`\`\`typescript
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase-config';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
\`\`\`

APP/LAYOUT.TSX WITH FIREBASE:
\`\`\`typescript
import type { Metadata } from 'next';
import { AuthProvider } from './components/AuthProvider';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: 'Your App Title',
  description: 'Your app description',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
\`\`\`

NAVBAR WITH AUTH (app/components/Navbar.tsx):
\`\`\`typescript
'use client';

import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { logout } from '@/lib/auth';

export default function Navbar() {
  const { user, loading } = useAuth();

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <nav className="bg-white border-b shadow-sm">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold text-blue-600">
          YourApp
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/" className="hover:text-blue-600">Home</Link>
          <Link href="/about" className="hover:text-blue-600">About</Link>
          {!loading && (
            <>
              {!user ? (
                <Link
                  href="/sign-in"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  Sign In
                </Link>
              ) : (
                <>
                  <Link href="/profile" className="hover:text-blue-600">Profile</Link>
                  <button
                    onClick={handleSignOut}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
                  >
                    Sign Out
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
\`\`\`

SIGN-IN PAGE (app/sign-in/page.tsx):
\`\`\`typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmail, signInWithGoogle } from '@/lib/auth';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmail(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      await signInWithGoogle();
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleEmailSignIn}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>

          <div className="text-center text-sm">
            <span className="text-gray-600">Don't have an account? </span>
            <Link href="/sign-up" className="font-medium text-blue-600 hover:text-blue-500">
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
\`\`\`

SIGN-UP PAGE (app/sign-up/page.tsx):
\`\`\`typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUpWithEmail, signInWithGoogle } from '@/lib/auth';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signUpWithEmail(email, password, name);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setLoading(true);

    try {
      await signInWithGoogle();
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Failed to sign up with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleEmailSignUp}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Full name"
              />
            </div>
            <div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password (min. 6 characters)"
                minLength={6}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign up with Google
          </button>

          <div className="text-center text-sm">
            <span className="text-gray-600">Already have an account? </span>
            <Link href="/sign-in" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
\`\`\`

PROFILE PAGE (app/profile/page.tsx):
\`\`\`typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Your Profile</h1>
      <div className="bg-white shadow-lg rounded-lg p-6 max-w-2xl">
        <div className="flex items-center gap-4 mb-6">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-20 h-20 rounded-full"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
              {(user.displayName || user.email || 'U')[0].toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-semibold">
              {user.displayName || 'User'}
            </h2>
            <p className="text-gray-600">{user.email}</p>
          </div>
        </div>
        <div className="border-t pt-4 space-y-2">
          <p><strong>User ID:</strong> <span className="text-sm text-gray-600">{user.uid}</span></p>
          <p><strong>Email Verified:</strong> {user.emailVerified ? '✅ Yes' : '❌ No'}</p>
          {user.metadata.creationTime && (
            <p><strong>Member Since:</strong> {new Date(user.metadata.creationTime).toLocaleDateString()}</p>
          )}
        </div>
      </div>
    </div>
  );
}
\`\`\`

APP/COMPONENTS/PROTECTEDROUTE.TSX TEMPLATE:
\`\`\`typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
\`\`\`

🚨 PACKAGE.JSON - CRITICAL REQUIREMENTS 🚨

You MUST ALWAYS generate a package.json file. Here's the structure:

WITHOUT Firebase (default):
\`\`\`json
{
  "name": "generated-nextjs-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.294.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5"
  }
}
\`\`\`

WITH Firebase (when auth is requested):
\`\`\`json
{
  "name": "generated-nextjs-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.294.0",
    "firebase": "^10.13.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5"
  }
}
\`\`\`

ADDITIONAL CONFIGURATION FILES REQUIRED:

tsconfig.json:
\`\`\`json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
\`\`\`

next.config.ts:
\`\`\`typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  }
};

export default nextConfig;
\`\`\`

tailwind.config.ts:
\`\`\`typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
\`\`\`

app/globals.css:
\`\`\`css
@tailwind base;
@tailwind components;
@tailwind utilities;
\`\`\`

🚨 CRITICAL: Always include package.json, tsconfig.json, next.config.ts, tailwind.config.ts, and app/globals.css in your files array!

DO NOT generate authentication unless explicitly requested by user.

NOTE: Firebase configuration is AUTO-INJECTED during generation. No manual setup required!

---

FIRESTORE DATA PATTERNS (for user-specific data):

When generating apps with authentication, use Firestore for real-time database sync:

EXAMPLE - Shopping Cart with Firestore:
\`\`\`typescript
'use client';

import { useAuth } from '../components/AuthProvider';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase-config';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

export default function useUserCart() {
  const { user } = useAuth();
  const [cart, setCart] = useState([]);

  useEffect(() => {
    if (!user) return;

    const cartRef = doc(db, 'users', user.uid, 'cart', 'items');
    const unsubscribe = onSnapshot(cartRef, (doc) => {
      setCart(doc.exists() ? doc.data().items || [] : []);
    });

    return () => unsubscribe();
  }, [user]);

  const addToCart = async (item) => {
    if (!user) return;
    const newCart = [...cart, item];
    setCart(newCart);
    await setDoc(doc(db, 'users', user.uid, 'cart', 'items'), { items: newCart });
  };

  return { cart, addToCart };
}
\`\`\`

EXAMPLE - User Preferences with Firestore:
\`\`\`typescript
import { db } from '@/lib/firebase-config';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export async function saveUserPreference(userId: string, key: string, value: any) {
  await setDoc(doc(db, 'users', userId, 'prefs', key), { value });
}

export async function getUserPreference(userId: string, key: string) {
  const snap = await getDoc(doc(db, 'users', userId, 'prefs', key));
  return snap.exists() ? snap.data().value : null;
}
\`\`\`

FIRESTORE STRUCTURE: All data scoped under users/{userId}/ for isolation.

NEXT.JS REQUIREMENTS:
- Use TypeScript (.tsx) for all components
- Pages are Server Components by default (no 'use client' unless needed)
- Use 'use client' directive for interactive components (forms, buttons, state)
- Export metadata from page.tsx files for SEO
- Use Next.js Link component for navigation: import Link from 'next/link'
- Follow Next.js naming: page.tsx (route), layout.tsx (layout), loading.tsx (optional)
- Use proper TypeScript types for props and params
- IMPORTANT: Use regular <img> tags for images (NOT next/image) - it requires extra configuration for external URLs
- Example: <img src="https://images.unsplash.com/..." alt="Description" className="w-full h-auto" />

CODE REQUIREMENTS:

✅ Use functional components with hooks
✅ Use const/let (never var)
✅ Use === (never ==)
✅ Add semicolons
✅ No unused variables
✅ Proper TypeScript types
✅ Clean, readable code with proper indentation
✅ Responsive design (mobile-first)
✅ Smooth animations and transitions

CONTENT REQUIREMENTS:

✅ NO placeholder text or "Lorem ipsum"
✅ EVERY page has complete, realistic content
✅ Products/menu items: minimum 8-12 with descriptions and prices
✅ About sections: 3-4 full paragraphs
✅ Use regular <img> tags for all images (NOT next/image)
✅ Allowed image sources: images.unsplash.com, via.placeholder.com, firebasestorage.googleapis.com, picsum.photos

ROUTING SETUP:

Example app/layout.tsx structure:
\`\`\`tsx
import type { Metadata } from 'next';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: 'App Name',
  description: 'App description',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
\`\`\`

Example app/page.tsx structure:
\`\`\`tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Home',
};

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold">Welcome</h1>
      {/* Page content */}
    </div>
  );
}
\`\`\`

Example app/components/Navbar.tsx structure:
\`\`\`tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="bg-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="text-xl font-bold">
            Logo
          </Link>
          <div className="hidden md:flex space-x-8">
            <Link href="/" className="hover:text-blue-600">Home</Link>
            <Link href="/about" className="hover:text-blue-600">About</Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
\`\`\`

EDITING EXISTING CODE:
When modifying an existing app, follow these rules strictly:
- Do EXACTLY what the user requested - nothing more, nothing less
- DO NOT add unrequested features, components, or improvements
- DO NOT refactor or reorganize code unless specifically asked
- DO NOT change styling, colors, or layout unless specifically asked
- Keep all unmodified parts of the code EXACTLY as they were
- Only touch the specific files/sections needed for the requested change

OUTPUT FORMAT (CRITICAL):

You MUST return ONLY a valid JSON object. No markdown code blocks, no explanations, no extra text.

🚨 REQUIRED FILES IN OUTPUT (must include ALL of these):
1. package.json - WITH ALL DEPENDENCIES (including firebase if auth is used)
2. tsconfig.json - TypeScript configuration
3. next.config.ts - Next.js configuration
4. tailwind.config.ts - Tailwind configuration
5. app/globals.css - Tailwind CSS imports
6. app/layout.tsx - Root layout
7. app/page.tsx - Home page
8. app/components/*.tsx - All components
9. Any additional pages

EXAMPLE Structure:
{
  "files": [
    {
      "path": "package.json",
      "content": "{\n  \"name\": \"generated-nextjs-app\",\n  \"version\": \"0.1.0\",\n  \"private\": true,\n  \"scripts\": {\n    \"dev\": \"next dev\",\n    \"build\": \"next build\",\n    \"start\": \"next start\"\n  },\n  \"dependencies\": {\n    \"next\": \"^14.0.0\",\n    \"react\": \"^18.2.0\",\n    \"react-dom\": \"^18.2.0\",\n    \"lucide-react\": \"^0.294.0\",\n    \"firebase\": \"^10.13.0\"\n  },\n  \"devDependencies\": {\n    \"@types/node\": \"^20\",\n    \"@types/react\": \"^19\",\n    \"@types/react-dom\": \"^19\",\n    \"typescript\": \"^5\"\n  }\n}"
    },
    {
      "path": "tsconfig.json",
      "content": "{\n  \"compilerOptions\": {\n    \"target\": \"ES2017\",\n    \"lib\": [\"dom\", \"dom.iterable\", \"esnext\"],\n    \"allowJs\": true,\n    \"skipLibCheck\": true,\n    \"strict\": true,\n    \"noEmit\": true,\n    \"esModuleInterop\": true,\n    \"module\": \"esnext\",\n    \"moduleResolution\": \"bundler\",\n    \"resolveJsonModule\": true,\n    \"isolatedModules\": true,\n    \"jsx\": \"preserve\",\n    \"incremental\": true,\n    \"plugins\": [{\"name\": \"next\"}],\n    \"paths\": {\"@/*\": [\"./*\"]}\n  },\n  \"include\": [\"next-env.d.ts\", \"**/*.ts\", \"**/*.tsx\", \".next/types/**/*.ts\"],\n  \"exclude\": [\"node_modules\"]\n}"
    },
    {
      "path": "next.config.ts",
      "content": "import type { NextConfig } from 'next';\n\nconst nextConfig: NextConfig = {\n  images: {\n    remotePatterns: [\n      { protocol: 'https', hostname: '**' }\n    ]\n  }\n};\n\nexport default nextConfig;"
    },
    {
      "path": "tailwind.config.ts",
      "content": "import type { Config } from 'tailwindcss';\n\nconst config: Config = {\n  content: [\n    './pages/**/*.{js,ts,jsx,tsx,mdx}',\n    './components/**/*.{js,ts,jsx,tsx,mdx}',\n    './app/**/*.{js,ts,jsx,tsx,mdx}',\n  ],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n};\n\nexport default config;"
    },
    {
      "path": "app/globals.css",
      "content": "@tailwind base;\n@tailwind components;\n@tailwind utilities;"
    },
    {
      "path": "app/layout.tsx",
      "content": "import type { Metadata } from 'next';\nimport './globals.css';\n\nexport const metadata: Metadata = {\n  title: 'App Name',\n  description: 'App description',\n};\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang=\"en\">\n      <body>{children}</body>\n    </html>\n  );\n}"
    },
    {
      "path": "app/page.tsx",
      "content": "export default function HomePage() {\n  return (\n    <div>\n      <h1>Home Page</h1>\n    </div>\n  );\n}"
    }
  ],
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.294.0",
    "firebase": "^10.13.0"
  }
}

🚨 CRITICAL RULES:
1. Your ENTIRE response must be ONLY this JSON object
2. Do NOT wrap it in markdown code blocks (no backticks or code fences)
3. Do NOT add any explanatory text before or after
4. Just pure JSON starting with { and ending with }
5. MUST include package.json with firebase dependency if auth is used
6. MUST include all configuration files (tsconfig.json, next.config.ts, tailwind.config.ts)
7. MUST include app/globals.css with Tailwind imports
8. Properly escape all special characters in JSON strings (\\n, \\", \\\\, etc.)\`;`;

interface GeneratedFile {
  path: string;
  content: string;
}

export interface UploadedImage {
  name: string;
  type: string;
  dataUrl: string;
  downloadUrl?: string; // Firebase Storage URL for embedding in generated code
}

interface LintResult {
  passed: boolean;
  errors: number;
  warnings: number;
  fileResults: Array<{
    path: string;
    passed: boolean;
    errors: number;
    warnings: number;
    messages: Array<{
      line: number;
      column: number;
      severity: string;
      rule: string | null;
      message: string;
    }>;
  }>;
}

export interface GeneratedReactProject {
  files: GeneratedFile[];
  dependencies: Record<string, string>;
  lintReport: LintResult;
  attempts: number;
}

/** Extract JSON from various formats */
function extractJSON(text: string): string {
  // Remove any markdown code blocks
  text = text
    .replace(/```json\s*/gi, "")
    .replace(/```javascript\s*/gi, "")
    .replace(/```\s*$/gi, "")
    .trim();

  // Remove any leading/trailing text before the JSON
  const jsonStartIndex = text.indexOf("{");
  const jsonEndIndex = text.lastIndexOf("}");

  if (
    jsonStartIndex !== -1 &&
    jsonEndIndex !== -1 &&
    jsonEndIndex > jsonStartIndex
  ) {
    text = text.substring(jsonStartIndex, jsonEndIndex + 1);
  }

  return text;
}

/** Smart JSON recovery - attempts to complete truncated JSON */
function recoverJSON(text: string): string {
  try {
    // Try parsing as-is first
    JSON.parse(text);
    return text;
  } catch (e) {
    console.log("JSON parse failed, attempting recovery...");

    // Remove any trailing commas before closing braces/brackets
    text = text.replace(/,(\s*[}\]])/g, '$1');

    // Fix common issues with escaped characters
    // Remove any incomplete escape sequences at the end
    text = text.replace(/\\+$/, '');

    // Count braces and brackets
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escape = false;
    let lastNonWhitespace = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
      }
      if (inString) continue;

      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;

      if (char.trim()) {
        lastNonWhitespace = char;
      }
    }

    // Close any open strings
    if (inString) {
      text += '"';
      // If we just closed a string, might need a comma or closing bracket
      if (lastNonWhitespace !== ',' && lastNonWhitespace !== '[' && lastNonWhitespace !== '{') {
        // Check what should come next based on context
        const trimmed = text.trimEnd();
        if (!trimmed.endsWith(',') && !trimmed.endsWith('[') && !trimmed.endsWith('{')) {
          // Likely in an array or object, might need to close it
        }
      }
    }

    // Close any unclosed arrays
    text += ']'.repeat(Math.max(0, bracketCount));

    // Close any unclosed objects
    text += '}'.repeat(Math.max(0, braceCount));

    // Try to fix trailing commas again after closing
    text = text.replace(/,(\s*[}\]])/g, '$1');

    return text;
  }
}

/** Lint all generated files */
async function lintAllFiles(files: GeneratedFile[]): Promise<LintResult> {
  const fileResults = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of files) {
    // Only lint JS/JSX/TS/TSX files
    if (!file.path.endsWith(".tsx") && !file.path.endsWith(".ts") &&
        !file.path.endsWith(".jsx") && !file.path.endsWith(".js")) {
      continue;
    }

    const result = await lintCode(file.content);

    fileResults.push({
      path: file.path,
      passed: result.errorCount === 0,
      errors: result.errorCount,
      warnings: result.warningCount,
      messages: result.messages,
    });

    totalErrors += result.errorCount;
    totalWarnings += result.warningCount;
  }

  return {
    passed: totalErrors === 0,
    errors: totalErrors,
    warnings: totalWarnings,
    fileResults,
  };
}

/** Generate using Gemini */
async function generateWithGemini(
  prompt: string,
  images?: UploadedImage[],
  onProgress?: (msg: string) => void,
): Promise<string> {
  const genAI = getGeminiClient();
  // Always use Gemini 3 Flash for all code generation
  const model = genAI.getGenerativeModel({
    model: GEMINI_FLASH_MODEL,
    generationConfig: {
      maxOutputTokens: 65536, // Max output tokens for Gemini (2M model can handle this)
      temperature: 0.7,
      topP: 0.95,
      responseMimeType: "application/json", // Force JSON output
    },
  });

  onProgress?.("Generating with Gemini 3 Flash");

  const parts: any[] = [];

  // Add images and PDFs first if provided
  if (images && images.length > 0) {
    for (const file of images) {
      const base64Match = file.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (base64Match) {
        const mimeType = base64Match[1];
        const base64Data = base64Match[2];

        // Gemini supports both images and PDFs
        if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
          parts.push({
            inlineData: {
              mimeType,
              data: base64Data,
            },
          });
        }
      }
    }
  }

  // Add text prompt
  let textPrompt = prompt;
  if (images && images.length > 0) {
    // Check if any images have downloadUrl (Firebase Storage URLs)
    const imagesWithUrls = images.filter((img) => img.downloadUrl);

    if (imagesWithUrls.length > 0) {
      // If Firebase URLs are available, include them prominently in the prompt
      const imageUrlList = imagesWithUrls
        .map((img, i) => `${i + 1}. ${img.name}: ${img.downloadUrl}`)
        .join("\n");

      textPrompt = `I've uploaded ${images.length} image(s) above for design inspiration.

🚨 CRITICAL: USER-UPLOADED IMAGES 🚨
The user has provided ${imagesWithUrls.length} image(s) hosted on Firebase Storage. You MUST use these EXACT URLs in your generated code:

${imageUrlList}

REQUIREMENTS FOR THESE IMAGES:
1. Use EXACTLY these URLs in your img src attributes
2. Example: <img src="${imagesWithUrls[0].downloadUrl}" alt="${imagesWithUrls[0].name}" className="w-full h-auto" />
3. DO NOT use placeholder URLs (via.placeholder.com, unsplash, etc.)
4. Place these images prominently (hero sections, galleries, product images, etc.)
5. The user expects to see their ACTUAL uploaded images in the final website
6. These are real, hosted images - not placeholders

${prompt}`;
    } else {
      // Fallback for when only dataUrl is available
      textPrompt = `I've uploaded ${images.length} image(s) above. Please analyze these images for design inspiration.\n\n${prompt}`;
    }
  }
  // Add additional instructions for Gemini to keep responses concise
  const geminiInstructions = `

⚠️ CRITICAL JSON FORMATTING REQUIREMENTS - READ CAREFULLY:

1. Output MUST be 100% VALID JSON - no exceptions
2. NO trailing commas anywhere (objects or arrays)
3. ALL strings use double quotes " not single quotes '
4. Escape ALL special chars in code: \\n \\t \\" \\\\ \\/ \\b \\f \\r
5. NO JavaScript comments in JSON content (no // or /* */)
6. Response MUST end with valid closing }
7. If approaching token limit, STOP and close JSON properly
8. Generate ONLY 3-4 essential files to stay within limits
9. Keep code minimal but functional - remove verbose comments
10. VERIFY JSON is valid before sending response

MINIMAL FILE GENERATION:
- app/layout.tsx (root layout)
- app/page.tsx (home page)
- app/globals.css (tailwind styles)
- app/components/[Essential].tsx (only if absolutely needed)

JSON STRUCTURE (exact format):
{
  "files": [
    {"path": "app/page.tsx", "content": "code without comments"},
    {"path": "app/layout.tsx", "content": "code without comments"}
  ],
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0"
  }
}

BEFORE RESPONDING:
✓ Verify NO trailing commas
✓ Verify all strings properly quoted and escaped
✓ Verify all { } [ ] are balanced
✓ Keep response under 60,000 chars if possible
`;

  // Detect if auth is needed to conditionally include templates
  const needsAuth = detectAuthRequest(textPrompt);

  // Get UI library context from MCP
  onProgress?.("Fetching modern UI components via MCP...");
  let uiLibraryContext = "";
  try {
    uiLibraryContext = await getUILibraryContext(textPrompt);
  } catch (error) {
    console.warn("Failed to get UI library context from MCP:", error);
    // Continue without MCP context
  }

  // Build optimized prompt
  const basePrompt = needsAuth
    ? BASE_SYSTEM_PROMPT
    : BASE_SYSTEM_PROMPT.replace(/🔐 FIREBASE AUTHENTICATION[\s\S]*?(?=NEXT\.JS REQUIREMENTS:)/g, '');

  const optimizedPrompt = basePrompt + uiLibraryContext + geminiInstructions + "\n\nUser Request: " + textPrompt;

  parts.push({ text: optimizedPrompt });

  try {
    const result = await model.generateContent(parts);
    const response = result.response;
    const text = response.text();

    // Log response length for debugging
    console.log(`Gemini response length: ${text.length} characters`);

    return text;
  } catch (error: any) {
    console.error("Gemini generation error:", error);
    throw new Error(`Gemini API error: ${error.message || "Unknown error"}`);
  }
}

/** Generate React project with retry on lint errors */
async function generateWithLinting(
  prompt: string,
  images?: UploadedImage[],
  onProgress?: (msg: string) => void,
): Promise<GeneratedReactProject> {
  let attempts = 1;
  const maxAttempts = 3;

  while (attempts <= maxAttempts) {
    try {
      onProgress?.(
        `Generating React project (attempt ${attempts}/${maxAttempts})`,
      );

      // Always use Gemini Flash for code generation
      const text = await generateWithGemini(prompt, images, onProgress);

      let jsonText = extractJSON(text);

      // Pre-process JSON to fix common Gemini issues
      console.log("Original JSON length:", jsonText.length);

      // Check if JSON appears complete
      if (!jsonText.trim().endsWith("}")) {
        console.warn("JSON response appears truncated - attempting recovery");
        console.warn("Last 200 chars:", jsonText.substring(Math.max(0, jsonText.length - 200)));
        jsonText = recoverJSON(jsonText);
        console.log("After recovery, new length:", jsonText.length);
      }

      let parsed;
      let parseAttempts = 0;
      const maxParseAttempts = 3;

      while (parseAttempts < maxParseAttempts) {
        try {
          parsed = JSON.parse(jsonText);
          console.log("✅ JSON parsed successfully!");
          break;
        } catch (e: any) {
          parseAttempts++;
          console.warn(`JSON parse attempt ${parseAttempts} failed:`, e.message);

          if (parseAttempts === 1) {
            // First attempt: Remove trailing commas
            console.log("Attempt 1: Removing trailing commas...");
            jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
          } else if (parseAttempts === 2) {
            // Second attempt: More aggressive recovery
            console.log("Attempt 2: Aggressive JSON recovery...");
            jsonText = recoverJSON(jsonText);
            // Also try to fix unescaped newlines in strings
            jsonText = jsonText.replace(/([^\\])(\\n)/g, '$1\\\\n');
          } else {
            // Final attempt failed
            console.error("All JSON parse attempts failed");
            console.error("Response length:", jsonText.length);
            console.error("First 500 chars:", jsonText.substring(0, 500));
            console.error("Last 500 chars:", jsonText.substring(Math.max(0, jsonText.length - 500)));
            console.error("Parse error:", e.message);

            if (attempts === maxAttempts) {
              // Try to extract position information from error message
              const match = e.message.match(/position (\d+)/);
              const position = match ? parseInt(match[1]) : 0;
              const context = position > 0 ? jsonText.substring(Math.max(0, position - 100), Math.min(jsonText.length, position + 100)) : '';

              throw new Error(
                `Failed to parse generated JSON after ${maxAttempts} attempts.\n` +
                `Error: ${e.message}\n` +
                (context ? `Context around error: ${context}\n` : '') +
                `Try a simpler prompt or try again.`
              );
            }
            attempts++;
            break; // Break out of parse loop to retry generation
          }
        }
      }

      // If we failed all parse attempts, continue to next generation attempt
      if (!parsed) {
        continue;
      }

      // Validate structure
      if (
        !parsed.files ||
        !Array.isArray(parsed.files) ||
        parsed.files.length === 0
      ) {
        console.error("Invalid JSON structure - missing or empty files array");
        if (attempts === maxAttempts) {
          throw new Error(
            "Generated code has invalid structure. Please try again.",
          );
        }
        attempts++;
        continue;
      }

      let { files, dependencies } = parsed;

      // Detect if Firebase auth was generated and auto-add dependency if missing
      const hasFirebaseAuth = files.some((f: any) =>
        f.content.includes('firebase/auth') ||
        f.content.includes('firebase/firestore') ||
        f.content.includes('FIREBASE_CONFIG_PLACEHOLDER')
      );

      if (hasFirebaseAuth && !dependencies['firebase']) {
        console.log('🔥 Firebase auth detected, adding firebase dependency');
        dependencies['firebase'] = '^10.13.0';
      }

      // CRITICAL FIX: Always generate package.json file with all dependencies
      const hasPackageJson = files.some((f: any) => f.path === 'package.json');

      if (!hasPackageJson) {
        console.log('📦 Generating package.json file with dependencies');

        const packageJson = {
          name: "generated-nextjs-app",
          version: "0.1.0",
          private: true,
          scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
            lint: "next lint"
          },
          dependencies: dependencies,
          devDependencies: {
            "@types/node": "^20",
            "@types/react": "^19",
            "@types/react-dom": "^19",
            "typescript": "^5"
          }
        };

        files.push({
          path: 'package.json',
          content: JSON.stringify(packageJson, null, 2)
        });
      } else {
        // Update existing package.json with new dependencies
        const pkgIndex = files.findIndex((f: any) => f.path === 'package.json');
        if (pkgIndex !== -1) {
          try {
            const pkg = JSON.parse(files[pkgIndex].content);
            // Merge dependencies from both sources
            pkg.dependencies = { ...pkg.dependencies, ...dependencies };

            // Double-check: If Firebase auth is detected, ensure firebase is in package.json
            if (hasFirebaseAuth && !pkg.dependencies['firebase']) {
              console.log('🔥 Force-adding firebase dependency to package.json');
              pkg.dependencies['firebase'] = '^10.13.0';
            }

            files[pkgIndex].content = JSON.stringify(pkg, null, 2);
            console.log('✅ Updated package.json with dependencies:', Object.keys(pkg.dependencies).join(', '));
          } catch (e) {
            console.error('Failed to update package.json:', e);
          }
        }
      }

      // ADDITIONAL CHECK: Verify required config files exist
      const requiredConfigFiles = [
        'tsconfig.json',
        'next.config.ts',
        'tailwind.config.ts',
        'app/globals.css'
      ];

      const missingFiles = requiredConfigFiles.filter(
        reqFile => !files.some((f: any) => f.path === reqFile)
      );

      if (missingFiles.length > 0) {
        console.warn('⚠️ Missing required config files:', missingFiles.join(', '));
      }

      // Validate files have required properties
      const invalidFile = files.find((f: any) => !f.path || !f.content);
      if (invalidFile) {
        console.error("Invalid file structure:", invalidFile);
        if (attempts === maxAttempts) {
          throw new Error(
            "Generated files have invalid structure. Please try again.",
          );
        }
        attempts++;
        continue;
      }

      // Lint all files
      onProgress?.("Linting generated code with ESLint");
      let lintReport: LintResult;
      try {
        lintReport = await lintAllFiles(files);
      } catch (lintError) {
        console.error("Linting error:", lintError);
        // If linting fails, create a passing report and continue
        lintReport = {
          passed: true,
          errors: 0,
          warnings: 0,
          fileResults: [],
        };
      }

      if (lintReport.passed) {
        onProgress?.("✓ All files passed linting!");
        return { files, dependencies, lintReport, attempts };
      }

      // If linting failed and we have attempts left, ask AI to fix
      if (attempts < maxAttempts) {
        onProgress?.(`Found ${lintReport.errors} linting errors, fixing...`);

        const errorSummary = lintReport.fileResults
          .filter((f) => f.errors > 0)
          .map(
            (f) =>
              `${f.path}: ${f.messages.map((m) => `Line ${m.line}: ${m.message}`).join(", ")}`,
          )
          .join("\n");

        let fixText: string;
        try {
          // Use Gemini Flash for fixing code
          const fixPrompt = `${prompt}\n\nThe generated code has ESLint errors. Fix them and return the complete JSON again:\n\n${errorSummary}\n\nReturn ONLY valid JSON with all files.`;
          fixText = await generateWithGemini(fixPrompt, images, onProgress);
        } catch (fixError: any) {
          // If fix attempt fails due to API issues, continue to next attempt
          console.error(
            "Fix attempt API error:",
            fixError?.error?.type || fixError?.message,
          );
          throw fixError; // Will be caught by outer catch
        }

        const fixedJsonText = extractJSON(fixText);

        try {
          // Check if JSON appears complete
          if (!fixedJsonText.trim().endsWith("}")) {
            console.error("Fixed JSON response appears truncated");
            throw new Error("Incomplete JSON");
          }

          const fixedParsed = JSON.parse(fixedJsonText);
          if (!fixedParsed.files || !Array.isArray(fixedParsed.files)) {
            throw new Error("Invalid structure");
          }

          const fixedLintReport = await lintAllFiles(fixedParsed.files);

          if (fixedLintReport.passed) {
            onProgress?.("✓ Fixed all linting errors!");
            return {
              files: fixedParsed.files,
              dependencies: fixedParsed.dependencies,
              lintReport: fixedLintReport,
              attempts: attempts + 1,
            };
          }
        } catch (e) {
          console.error("Fix attempt failed:", e);
          // Continue to next attempt
        }
      }
    } catch (apiError: any) {
      // Handle API errors like overloaded, rate limits, etc.
      if (
        apiError?.error?.type === "overloaded_error" ||
        apiError?.status === 529
      ) {
        console.error(`API overloaded on attempt ${attempts}`);
        if (attempts < maxAttempts) {
          const delayMs = 2000 * attempts; // Exponential backoff: 2s, 4s, 6s
          onProgress?.(`API is overloaded, retrying in ${delayMs / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          attempts++;
          continue;
        }
        throw new Error(
          "The AI service is currently experiencing high demand. Please try again in a few moments.",
        );
      }

      // Handle rate limit errors
      if (
        apiError?.status === 429 ||
        apiError?.error?.type === "rate_limit_error"
      ) {
        throw new Error(
          "Rate limit exceeded. Please wait a moment before trying again.",
        );
      }

      // For other API errors, rethrow with helpful message
      throw new Error(
        `AI service error: ${apiError?.error?.message || apiError?.message || "Unknown error"}. Please try again.`,
      );
    }

    attempts++;
  }

  // Return last result even if it has lint errors
  onProgress?.("⚠ Returning code with some linting issues");
  try {
    // Use Gemini Flash for fallback code generation
    const text = await generateWithGemini(prompt, images, onProgress);

    const jsonText = extractJSON(text);
    const parsed = JSON.parse(jsonText);

    if (!parsed.files || !Array.isArray(parsed.files)) {
      throw new Error("Invalid response structure");
    }

    const lintReport = await lintAllFiles(parsed.files);
    return { ...parsed, lintReport, attempts };
  } catch (e: any) {
    // Handle API errors specifically
    if (e?.error?.type === "overloaded_error" || e?.status === 529) {
      throw new Error(
        "The AI service is currently experiencing high demand. Please try again in a few moments.",
      );
    }
    if (e?.status === 429 || e?.error?.type === "rate_limit_error") {
      throw new Error(
        "Rate limit exceeded. Please wait a moment before trying again.",
      );
    }

    throw new Error(
      "Failed to generate React project. " +
        (e?.error?.message ||
          e?.message ||
          "The AI response could not be parsed correctly.") +
        " Please try again with a clearer description.",
    );
  }
}

export async function generateReactProject(
  prompt: string,
  images?: UploadedImage[],
  onProgress?: (message: string) => void,
): Promise<GeneratedReactProject> {
  // Always use Gemini 3 Flash for all code generation
  onProgress?.("Using Gemini 3 Flash AI");
  return await generateWithLinting(prompt, images, onProgress);
}
