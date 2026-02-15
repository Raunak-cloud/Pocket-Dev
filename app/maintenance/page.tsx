'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { isUserAdmin } from '@/lib/maintenance';
import { Settings, Clock, Wrench, LogOut } from 'lucide-react';

export default function MaintenancePage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    // Check if user is admin
    const checkAdminStatus = async () => {
      if (user) {
        const isAdminUser = await isUserAdmin(user);
        setIsAdmin(isAdminUser);

        // If admin, redirect to dashboard
        if (isAdminUser) {
          router.push('/dashboard');
        }
      }
      setChecking(false);
    };

    checkAdminStatus();
  }, [user, router]);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
      setSigningOut(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-4">
      {/* Sign Out Button - Top Right */}
      {user && (
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="fixed top-6 right-6 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-white font-medium transition-all duration-200 border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogOut className="w-4 h-4" />
          <span>{signingOut ? 'Signing out...' : 'Sign Out'}</span>
        </button>
      )}

      <div className="max-w-2xl w-full">
        {/* Animated maintenance icon */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-xl animate-pulse"></div>
            <div className="relative bg-gradient-to-br from-yellow-400 to-orange-500 p-6 rounded-full">
              <Wrench className="w-16 h-16 text-white animate-bounce" />
            </div>
          </div>
        </div>

        {/* Main message */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            We'll Be Right Back!
          </h1>
          <p className="text-xl text-gray-300 mb-6">
            Our system is currently undergoing scheduled maintenance to improve your experience.
          </p>
        </div>

        {/* Status card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-6 h-6 text-yellow-400 animate-spin" style={{ animationDuration: '3s' }} />
            <h2 className="text-2xl font-semibold text-white">Maintenance in Progress</h2>
          </div>

          <div className="space-y-4 text-gray-300">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-yellow-400 mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium text-white">Expected Duration</p>
                <p className="text-sm">We anticipate being back online shortly. Please check back soon.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Settings className="w-5 h-5 text-yellow-400 mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium text-white">What We're Doing</p>
                <p className="text-sm">Performing system updates and improvements to serve you better.</p>
              </div>
            </div>
          </div>

          {/* Progress bar animation */}
          <div className="mt-8">
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Additional info */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Thank you for your patience. We appreciate your understanding.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-white font-medium transition-all duration-200 border border-white/20"
          >
            Check Again
          </button>
        </div>
      </div>
    </div>
  );
}
