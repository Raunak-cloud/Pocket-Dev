import type { WebsiteConfig } from "../types";
import { getFontImport, getFontFamily, getHeadingFontFamily, getBodyFontFamily } from "../utils/theme";

export function renderGlobalsCss(config: WebsiteConfig): string {
  const fontImport = getFontImport(config.theme.fontStyle);
  const bodyFont = getBodyFontFamily(config.theme.fontStyle);
  const headingFont = getHeadingFontFamily(config.theme.fontStyle);
  const isDark = config.theme.background === "dark";

  return `@tailwind base;
@tailwind components;
@tailwind utilities;

${fontImport}

:root {
  --font-body: ${bodyFont};
  --font-heading: ${headingFont};
}

body {
  font-family: var(--font-body);
  ${isDark ? "background-color: #030712; color: #f9fafb;" : "background-color: #ffffff; color: #111827;"}
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: ${isDark ? "#1f2937" : "#f3f4f6"};
}

::-webkit-scrollbar-thumb {
  background: ${isDark ? "#4b5563" : "#9ca3af"};
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: ${isDark ? "#6b7280" : "#6b7280"};
}

/* Focus styles */
*:focus-visible {
  outline: 2px solid ${isDark ? "#60a5fa" : "#2563eb"};
  outline-offset: 2px;
}

/* Page transition */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

main > * {
  animation: fadeIn 0.3s ease-out;
}

/* Top loading bar */
@keyframes progressBar {
  0%   { width: 0%; }
  50%  { width: 70%; }
  100% { width: 100%; }
}

.loading-bar {
  animation: progressBar 1.2s ease-in-out infinite;
}

/* Scroll-reveal animation */
@keyframes slideUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-30px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideLeft {
  from { opacity: 0; transform: translateX(30px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes slideRight {
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

.animate-slide-up { animation: slideUp 0.6s ease-out forwards; }
.animate-slide-down { animation: slideDown 0.6s ease-out forwards; }
.animate-slide-left { animation: slideLeft 0.6s ease-out forwards; }
.animate-slide-right { animation: slideRight 0.6s ease-out forwards; }
.animate-scale-in { animation: scaleIn 0.5s ease-out forwards; }

/* Stagger delays for children */
.stagger-1 { animation-delay: 0.1s; }
.stagger-2 { animation-delay: 0.2s; }
.stagger-3 { animation-delay: 0.3s; }
.stagger-4 { animation-delay: 0.4s; }
.stagger-5 { animation-delay: 0.5s; }
.stagger-6 { animation-delay: 0.6s; }

/* Floating animation */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.animate-float { animation: float 3s ease-in-out infinite; }

/* Gradient text */
.gradient-text {
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Glassmorphism */
.glass {
  background: ${isDark ? "rgba(17, 24, 39, 0.7)" : "rgba(255, 255, 255, 0.7)"};
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"};
}

/* Shimmer effect */
@keyframes shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}

.animate-shimmer {
  background-size: 200% auto;
  animation: shimmer 3s linear infinite;
}

/* Pulse ring */
@keyframes pulseRing {
  0% { box-shadow: 0 0 0 0 currentColor; opacity: 0.4; }
  100% { box-shadow: 0 0 0 12px currentColor; opacity: 0; }
}

.animate-pulse-ring { animation: pulseRing 1.5s ease-out infinite; }

/* Animated gradient background */
@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.animate-gradient {
  background-size: 200% 200%;
  animation: gradientShift 6s ease infinite;
}

/* Marquee scroll */
@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.animate-marquee { animation: marquee 30s linear infinite; }

/* Counter glow */
@keyframes glow {
  0%, 100% { text-shadow: none; }
  50% { text-shadow: 0 0 20px currentColor; }
}

/* Scrollbar hide utility */
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

/* Line clamp utilities */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
`;
}
