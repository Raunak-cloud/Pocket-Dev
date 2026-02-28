"use client";

import { useState, useEffect } from "react";
import Logo from "./Logo";

interface LaunchAnimationProps {
  prompt: string;
}

const LAUNCH_WORDS = [
  "Initializing",
  "Preparing workspace",
  "Launching generation",
];

export default function LaunchAnimation({ prompt }: LaunchAnimationProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 800);
    const t2 = setTimeout(() => setPhase(2), 1800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
      {/* Animated background rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="launch-ring launch-ring-1" />
        <div className="launch-ring launch-ring-2" />
        <div className="launch-ring launch-ring-3" />
      </div>

      {/* Particle burst */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="launch-particle"
            style={{
              "--angle": `${i * 30}deg`,
              "--delay": `${i * 0.08}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6">
        {/* Logo with glow pulse */}
        <div className="relative mb-8 launch-logo">
          <div className="absolute inset-0 blur-2xl bg-gradient-to-r from-blue-500 via-violet-500 to-blue-500 opacity-40 scale-[2] animate-pulse" />
          <div className="relative p-5 rounded-3xl bg-gradient-to-br from-bg-tertiary/90 to-bg-secondary/80 ring-1 ring-white/10 backdrop-blur-xl shadow-2xl shadow-blue-500/20">
            <Logo size={56} animate />
          </div>
        </div>

        {/* Animated text phases */}
        <div className="h-20 flex flex-col items-center justify-center">
          <p
            className={`text-2xl sm:text-3xl font-bold tracking-tight transition-all duration-700 ${
              phase >= 0
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-blue-400 bg-clip-text text-transparent bg-[length:200%_auto] launch-text-shimmer">
              {LAUNCH_WORDS[phase] || LAUNCH_WORDS[LAUNCH_WORDS.length - 1]}
            </span>
          </p>

          <p className="mt-3 text-sm text-text-tertiary max-w-sm line-clamp-2 launch-fade-in">
            {prompt}
          </p>
        </div>

        {/* Progress dots */}
        <div className="mt-8 flex items-center gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-500 ${
                i <= phase
                  ? "w-8 bg-gradient-to-r from-blue-500 to-violet-500"
                  : "w-2 bg-border-secondary/60"
              }`}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        .launch-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(99, 102, 241, 0.15);
          animation: expandRing 3s ease-out forwards;
        }
        .launch-ring-1 {
          width: 120px;
          height: 120px;
          animation-delay: 0s;
        }
        .launch-ring-2 {
          width: 120px;
          height: 120px;
          animation-delay: 0.4s;
          border-color: rgba(139, 92, 246, 0.12);
        }
        .launch-ring-3 {
          width: 120px;
          height: 120px;
          animation-delay: 0.8s;
          border-color: rgba(59, 130, 246, 0.1);
        }
        @keyframes expandRing {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          100% {
            transform: scale(8);
            opacity: 0;
          }
        }

        .launch-particle {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          animation: particleBurst 2s ease-out var(--delay) forwards;
          opacity: 0;
        }
        @keyframes particleBurst {
          0% {
            transform: rotate(var(--angle)) translateX(0);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          100% {
            transform: rotate(var(--angle)) translateX(180px);
            opacity: 0;
          }
        }

        .launch-logo {
          animation: logoEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes logoEntrance {
          0% {
            transform: scale(0.3) translateY(20px);
            opacity: 0;
          }
          100% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }

        .launch-text-shimmer {
          animation: textShimmer 2s linear infinite;
        }
        @keyframes textShimmer {
          0% {
            background-position: 0% center;
          }
          100% {
            background-position: 200% center;
          }
        }

        .launch-fade-in {
          animation: fadeInUp 0.6s ease-out 0.3s both;
        }
        @keyframes fadeInUp {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
