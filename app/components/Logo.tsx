"use client";

import Image from "next/image";

interface LogoProps {
  size?: number;
  animate?: boolean;
  className?: string;
}

export default function Logo({
  size = 48,
  animate = false,
  className = "",
}: LogoProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-xl overflow-hidden flex-shrink-0 ${animate ? "logo-animate" : ""} ${className}`}
    >
      <Image
        src="/danphe-logo.png"
        alt="Danphe"
        width={size * 3}
        height={size * 3}
        className="object-cover w-full h-full"
        style={{ objectPosition: "55% 30%", transform: "scale(2)", transformOrigin: "55% 35%" }}
      />
    </div>
  );
}
