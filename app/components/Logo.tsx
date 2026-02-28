"use client";

interface LogoProps {
  size?: number;
  animate?: boolean;
  className?: string;
}

export default function Logo({ size = 48, animate = false, className = "" }: LogoProps) {
  const uid = `logo-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${animate ? "logo-animate" : ""} ${className}`}
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id={`${uid}-mark`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e0e7ff" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background pill */}
      <rect
        x="1"
        y="1"
        width="46"
        height="46"
        rx="15"
        fill={`url(#${uid}-bg)`}
        filter={animate ? `url(#${uid}-glow)` : undefined}
      />

      {/* Abstract mark — stacked forward-slashes forming an "M" silhouette */}
      <path
        d="M11 34L18 14L24 26L30 14L37 34"
        fill={`url(#${uid}-mark)`}
        fillOpacity="0.95"
      />

      {/* Negative-space cut to open the M legs */}
      <path
        d="M15.5 34L18 24.5L20.5 34Z"
        fill={`url(#${uid}-bg)`}
      />
      <path
        d="M27.5 34L30 24.5L32.5 34Z"
        fill={`url(#${uid}-bg)`}
      />
    </svg>
  );
}
