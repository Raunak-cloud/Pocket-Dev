import type { ThemeConfig, TailwindColor, FontStyle } from "../types";

// ── Color scale mapping ──────────────────────────────────────────
// Maps Tailwind color names to their class prefixes for consistent usage

const COLOR_SCALES: Record<TailwindColor, { bg: Record<number, string>; text: Record<number, string>; border: Record<number, string>; ring: string }> = (() => {
  const colors: TailwindColor[] = [
    "slate", "gray", "zinc", "neutral", "stone",
    "red", "orange", "amber", "yellow", "lime",
    "green", "emerald", "teal", "cyan", "sky",
    "blue", "indigo", "violet", "purple", "fuchsia",
    "pink", "rose",
  ];
  const scales: any = {};
  for (const c of colors) {
    const bg: Record<number, string> = {};
    const text: Record<number, string> = {};
    const border: Record<number, string> = {};
    for (const s of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
      bg[s] = `bg-${c}-${s}`;
      text[s] = `text-${c}-${s}`;
      border[s] = `border-${c}-${s}`;
    }
    scales[c] = { bg, text, border, ring: `ring-${c}-500` };
  }
  return scales as any;
})();

// ── Theme class resolver ─────────────────────────────────────────

export interface ThemeClasses {
  // Primary CTA button
  btnPrimary: string;
  btnPrimaryHover: string;
  // Secondary / outline button
  btnSecondary: string;
  btnSecondaryHover: string;
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textAccent: string;
  textHeading: string;
  textBody: string;
  textMuted: string;
  // Backgrounds
  bgPage: string;
  bgCard: string;
  bgSection: string;
  bgSectionAlt: string;
  bgHero: string;
  bgNavbar: string;
  bgFooter: string;
  // Borders
  borderPrimary: string;
  borderLight: string;
  // Accent elements
  accentBg: string;
  accentText: string;
  // Gradients
  gradientPrimary: string;
  // Ring / focus
  ringPrimary: string;
  // Font
  fontClass: string;
}

export function resolveTheme(theme: ThemeConfig): ThemeClasses {
  const p = COLOR_SCALES[theme.primary];
  const s = COLOR_SCALES[theme.secondary];
  const a = COLOR_SCALES[theme.accent];
  const isDark = theme.background === "dark";

  return {
    btnPrimary: `${p.bg[600]} text-white hover:${p.bg[700]} transition-colors`,
    btnPrimaryHover: `hover:${p.bg[700]}`,
    btnSecondary: isDark
      ? `border ${p.border[400]} ${p.text[400]} hover:${p.bg[400]} hover:text-white transition-colors`
      : `border ${p.border[600]} ${p.text[600]} hover:${p.bg[600]} hover:text-white transition-colors`,
    btnSecondaryHover: `hover:${p.bg[600]}`,
    textPrimary: isDark ? p.text[400] : p.text[600],
    textSecondary: isDark ? s.text[400] : s.text[600],
    textAccent: isDark ? a.text[400] : a.text[500],
    textHeading: isDark ? "text-white" : "text-gray-900",
    textBody: isDark ? "text-gray-300" : "text-gray-600",
    textMuted: isDark ? "text-gray-400" : "text-gray-500",
    bgPage: isDark ? "bg-gray-950" : "bg-white",
    bgCard: isDark ? "bg-gray-900" : "bg-white",
    bgSection: isDark ? "bg-gray-950" : "bg-white",
    bgSectionAlt: isDark ? "bg-gray-900" : "bg-gray-50",
    bgHero: isDark
      ? `bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950`
      : `bg-gradient-to-br from-white via-${theme.primary}-50 to-white`,
    bgNavbar: isDark ? "bg-gray-950/90 backdrop-blur-md" : "bg-white/90 backdrop-blur-md",
    bgFooter: isDark ? "bg-gray-900" : "bg-gray-950",
    borderPrimary: isDark ? p.border[700] : p.border[200],
    borderLight: isDark ? "border-gray-800" : "border-gray-200",
    accentBg: isDark ? a.bg[900] : a.bg[100],
    accentText: isDark ? a.text[400] : a.text[600],
    gradientPrimary: `bg-gradient-to-r from-${theme.primary}-600 to-${theme.secondary}-600`,
    ringPrimary: p.ring,
    fontClass: getFontClass(theme.fontStyle),
  };
}

// ── Font mapping ─────────────────────────────────────────────────

function getFontClass(style: FontStyle): string {
  switch (style) {
    case "modern":   return "font-sans";
    case "serif":    return "font-serif";
    case "playful":  return "font-sans";
    case "minimal":  return "font-sans";
  }
}

// ── Convenience: get raw Tailwind class for a color+shade ────────

export function colorClass(
  prefix: "bg" | "text" | "border" | "ring",
  color: TailwindColor,
  shade: number,
): string {
  if (prefix === "ring") return `ring-${color}-${shade}`;
  return `${prefix}-${color}-${shade}`;
}

// ── Google Fonts import URL ──────────────────────────────────────

export function getFontImport(style: FontStyle): string {
  return `@import url('${getFontUrl(style)}');`;
}

export function getFontUrl(style: FontStyle): string {
  switch (style) {
    case "modern":
      return "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap";
    case "serif":
      return "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap";
    case "playful":
      return "https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700;800&display=swap";
    case "minimal":
      return "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap";
  }
}

export function getFontFamily(style: FontStyle): string {
  switch (style) {
    case "modern":   return "'Inter', sans-serif";
    case "serif":    return "'Playfair Display', serif";
    case "playful":  return "'Nunito', sans-serif";
    case "minimal":  return "'DM Sans', sans-serif";
  }
}

export function getHeadingFontFamily(style: FontStyle): string {
  switch (style) {
    case "serif":    return "'Playfair Display', serif";
    default:         return getFontFamily(style);
  }
}

export function getBodyFontFamily(style: FontStyle): string {
  switch (style) {
    case "serif":    return "'Inter', sans-serif";
    default:         return getFontFamily(style);
  }
}
