import type { WebsiteConfig } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc, escAttr } from "../utils/helpers";

export function renderNavbar(config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const isDark = config.theme.background === "dark";
  const p = config.theme.primary;

  // ── Scroll-dependent class expressions ──────────────────────────

  const scrolledBg = isDark
    ? "bg-gray-950/90 backdrop-blur-xl border-gray-800 shadow-lg shadow-black/10"
    : "bg-white/90 backdrop-blur-xl border-gray-200 shadow-lg shadow-black/5";

  const unscrolledBg = "bg-transparent border-transparent";

  // ── Nav text colors ─────────────────────────────────────────────
  // When at top of page (not scrolled) text is lighter since it overlays the hero.
  // When scrolled, use normal contrast colors.

  const navTextScrolled = isDark
    ? "text-gray-300 hover:text-white"
    : "text-gray-600 hover:text-gray-900";

  const navTextUnscrolled = isDark
    ? "text-gray-200 hover:text-white"
    : "text-gray-200 hover:text-white";

  const logoTextScrolled = isDark ? "text-white" : "text-gray-900";
  const logoTextUnscrolled = "text-white";

  // ── Desktop nav items ───────────────────────────────────────────

  const navItems = config.nav.items
    .map(
      (item) =>
        `              <Link href="${escAttr(item.href)}" className="relative text-sm font-medium transition-colors group">
                <span className={\`\${scrolled ? "${navTextScrolled}" : "${navTextUnscrolled}"} transition-colors\`}>${esc(item.label)}</span>
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-${p}-500 group-hover:w-full transition-all duration-300"></span>
              </Link>`,
    )
    .join("\n");

  // ── Mobile nav items ────────────────────────────────────────────

  const mobileNavItems = config.nav.items
    .map(
      (item) =>
        `                <Link href="${escAttr(item.href)}" onClick={() => setOpen(false)} className="block px-3 py-2.5 text-base font-medium ${isDark ? "text-gray-300 hover:text-white hover:bg-gray-800/50" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"} rounded-lg transition-colors">${esc(item.label)}</Link>`,
    )
    .join("\n");

  // ── CTA buttons ─────────────────────────────────────────────────

  const ctaButton = config.nav.ctaButton
    ? `              <Link href="${escAttr(config.nav.ctaButton.href)}" className="inline-flex items-center px-5 py-2 text-sm font-semibold text-white bg-${p}-600 hover:bg-${p}-700 rounded-full transition-all shadow-md shadow-${p}-500/25 hover:shadow-lg hover:shadow-${p}-500/30 hover:-translate-y-0.5">${esc(config.nav.ctaButton.label)}</Link>`
    : "";

  const mobileCta = config.nav.ctaButton
    ? `                <Link href="${escAttr(config.nav.ctaButton.href)}" onClick={() => setOpen(false)} className="block w-full text-center px-5 py-2.5 text-sm font-semibold text-white bg-${p}-600 hover:bg-${p}-700 rounded-full transition-all shadow-md shadow-${p}-500/25">${esc(config.nav.ctaButton.label)}</Link>`
    : "";

  // ── Mobile menu hamburger colors ────────────────────────────────

  const hamburgerScrolled = isDark
    ? "text-gray-400 hover:text-white hover:bg-gray-800"
    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100";

  const hamburgerUnscrolled = "text-gray-200 hover:text-white hover:bg-white/10";

  // ── Border class for mobile menu ────────────────────────────────

  const borderClass = isDark ? "border-gray-800" : "border-gray-200";

  // ── Assemble component ──────────────────────────────────────────

  return `"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={\`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b \${scrolled ? "${scrolledBg}" : "${unscrolledBg}"}\`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
${config.business.logoUrl
  ? `            <img src="${escAttr(config.business.logoUrl)}" alt="${escAttr(config.business.name)}" className="h-9 md:h-10 w-auto max-w-[160px] object-contain" />`
  : `            <span className={\`text-xl font-bold transition-colors \${scrolled ? "${logoTextScrolled}" : "${logoTextUnscrolled}"}\`}>${esc(config.business.name)}</span>
            <span className="w-2 h-2 rounded-full bg-${p}-500 inline-block ml-1"></span>`}
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
${navItems}
${ctaButton}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setOpen(!open)}
            className={\`md:hidden p-2 rounded-lg transition-colors \${scrolled ? "${hamburgerScrolled}" : "${hamburgerUnscrolled}"}\`}
            aria-label="Toggle menu"
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={\`md:hidden overflow-hidden transition-all duration-300 \${open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}\`}>
        <div className={\`${isDark ? "bg-gray-950/95 backdrop-blur-xl" : "bg-white/95 backdrop-blur-xl"} border-t \${scrolled ? "${borderClass}" : "border-transparent"}\`}>
          <div className="px-4 py-3 space-y-1">
${mobileNavItems}
${mobileCta}
          </div>
        </div>
      </div>
    </nav>
  );
}
`;
}
