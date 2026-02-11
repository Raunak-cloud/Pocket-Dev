import type { WebsiteConfig } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc, escAttr, imgTag, isInternalHref } from "../utils/helpers";

// ── Helpers ─────────────────────────────────────────────────────

/** Emit <Link> for internal hrefs, <a> for external. */
function ctaTag(href: string, className: string, content: string, needsLinkImport: { value: boolean }): string {
  if (isInternalHref(href)) {
    needsLinkImport.value = true;
    return `<Link href="${escAttr(href)}" className="${className}">${content}</Link>`;
  }
  return `<a href="${escAttr(href)}" className="${className}">${content}</a>`;
}

/** Truncate tagline to a max of 40 characters for the pill badge. */
function pillText(config: WebsiteConfig): string {
  const raw = config.business.tagline || "";
  return esc(raw.length > 40 ? raw.slice(0, 40) + "..." : raw);
}

/** Decorative gradient orbs that appear behind every hero variant. */
function decorativeOrbs(p: string, s: string): string {
  return `      {/* Decorative gradient orbs */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-${p}-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-${s}-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />`;
}

// ── Switch ──────────────────────────────────────────────────────

export function renderHero(config: WebsiteConfig): string {
  switch (config.hero.variant) {
    case "centered":          return renderCenteredHero(config);
    case "split-left":        return renderSplitLeftHero(config);
    case "split-right":       return renderSplitRightHero(config);
    case "fullscreen":        return renderFullscreenHero(config);
    case "minimal":           return renderMinimalHero(config);
    case "gradient-animated":  return renderGradientAnimatedHero(config);
    case "video-bg":           return renderVideoBgHero(config);
  }
}

// ── Centered ────────────────────────────────────────────────────

function renderCenteredHero(config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";
  const heroImg = imgTag(config.hero.imageDescription, "w-full h-64 sm:h-80 md:h-96 object-cover rounded-2xl");
  const needsLink = { value: false };

  const primaryCta = ctaTag(
    config.hero.ctaHref,
    `inline-flex items-center px-8 py-3.5 text-base font-semibold text-white bg-${p}-600 hover:bg-${p}-700 rounded-xl shadow-lg shadow-${p}-500/25 hover:shadow-xl hover:shadow-${p}-500/30 hover:-translate-y-0.5 transition-all`,
    `\n              ${esc(config.hero.ctaText)}\n            `,
    needsLink,
  );

  const secondaryCta = config.hero.secondaryCta
    ? `            ${ctaTag(config.hero.secondaryCta.href, `inline-flex items-center px-8 py-3.5 text-base font-semibold ${isDark ? `text-${p}-400 border-${p}-400 hover:bg-${p}-400 hover:text-white` : `text-${p}-600 border-${p}-600 hover:bg-${p}-600 hover:text-white`} border-2 rounded-xl shadow-lg shadow-${p}-500/25 hover:shadow-xl hover:shadow-${p}-500/30 hover:-translate-y-0.5 transition-all`, esc(config.hero.secondaryCta.text), needsLink)}`
    : "";

  const linkImport = needsLink.value ? `import Link from "next/link";\n` : "";

  return `${linkImport}export default function Hero() {
  return (
    <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 ${t.bgHero} overflow-hidden">
${decorativeOrbs(p, s)}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-${p}-100 text-${p}-700 mb-6">
            ${pillText(config)}
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
            <span className="bg-gradient-to-r from-${p}-600 to-${s}-600 bg-clip-text text-transparent">
              ${esc(config.hero.headline)}
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl ${t.textBody} max-w-2xl mx-auto leading-relaxed">
            ${esc(config.hero.subheadline)}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            ${primaryCta}
${secondaryCta}
          </div>
        </div>
        <div className="mt-16 max-w-5xl mx-auto">
          <div className="relative rounded-2xl shadow-2xl overflow-hidden backdrop-blur-sm bg-white/5 ring-1 ring-white/10 p-2">
            ${heroImg}
          </div>
        </div>
      </div>
    </section>
  );
}
`;
}

// ── Split Left ──────────────────────────────────────────────────

function renderSplitLeftHero(config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";
  const heroImg = imgTag(config.hero.imageDescription, "w-full h-full object-cover rounded-2xl shadow-2xl");
  const needsLink = { value: false };

  const primaryCta = ctaTag(
    config.hero.ctaHref,
    `inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-white bg-${p}-600 hover:bg-${p}-700 rounded-xl shadow-lg shadow-${p}-500/25 hover:shadow-xl hover:shadow-${p}-500/30 hover:-translate-y-0.5 transition-all`,
    `\n                ${esc(config.hero.ctaText)}\n              `,
    needsLink,
  );

  const secondaryCta = config.hero.secondaryCta
    ? `              ${ctaTag(config.hero.secondaryCta.href, `inline-flex items-center px-8 py-3.5 text-base font-semibold ${isDark ? `text-${p}-400 border-${p}-400 hover:bg-${p}-400 hover:text-white` : `text-${p}-600 border-${p}-600 hover:bg-${p}-600 hover:text-white`} border-2 rounded-xl shadow-lg shadow-${p}-500/25 hover:shadow-xl hover:shadow-${p}-500/30 hover:-translate-y-0.5 transition-all`, esc(config.hero.secondaryCta.text), needsLink)}`
    : "";

  const linkImport = needsLink.value ? `import Link from "next/link";\n` : "";

  return `${linkImport}export default function Hero() {
  return (
    <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 ${t.bgHero} overflow-hidden">
${decorativeOrbs(p, s)}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-${p}-100 text-${p}-700 mb-6">
              ${pillText(config)}
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold ${t.textHeading} leading-tight tracking-tight">
              ${esc(config.hero.headline)}
            </h1>
            <p className="mt-6 text-lg ${t.textBody} leading-relaxed">
              ${esc(config.hero.subheadline)}
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              ${primaryCta}
${secondaryCta}
            </div>
            <div className="mt-8 flex items-center gap-8">
              <div>
                <p className="text-2xl font-bold ${t.textHeading}">100+</p>
                <p className="text-sm ${t.textMuted}">Happy clients</p>
              </div>
              <div className="w-px h-10 ${isDark ? "bg-gray-700" : "bg-gray-200"}" />
              <div>
                <p className="text-2xl font-bold ${t.textHeading}">5.0</p>
                <p className="text-sm ${t.textMuted}">Star rating</p>
              </div>
              <div className="w-px h-10 ${isDark ? "bg-gray-700" : "bg-gray-200"}" />
              <div>
                <p className="text-2xl font-bold ${t.textHeading}">24/7</p>
                <p className="text-sm ${t.textMuted}">Support</p>
              </div>
            </div>
          </div>
          <div className="relative h-80 md:h-[500px] ring-1 ring-${p}-200/50 rounded-2xl overflow-hidden">
            ${heroImg}
          </div>
        </div>
      </div>
    </section>
  );
}
`;
}

// ── Split Right ─────────────────────────────────────────────────

function renderSplitRightHero(config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";
  const heroImg = imgTag(config.hero.imageDescription, "w-full h-full object-cover rounded-2xl shadow-2xl");
  const needsLink = { value: false };

  const primaryCta = ctaTag(
    config.hero.ctaHref,
    `inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-white bg-${p}-600 hover:bg-${p}-700 rounded-xl shadow-lg shadow-${p}-500/25 hover:shadow-xl hover:shadow-${p}-500/30 hover:-translate-y-0.5 transition-all`,
    `\n                ${esc(config.hero.ctaText)}\n              `,
    needsLink,
  );

  const secondaryCta = config.hero.secondaryCta
    ? `              ${ctaTag(config.hero.secondaryCta.href, `inline-flex items-center px-8 py-3.5 text-base font-semibold ${isDark ? `text-${p}-400 border-${p}-400 hover:bg-${p}-400 hover:text-white` : `text-${p}-600 border-${p}-600 hover:bg-${p}-600 hover:text-white`} border-2 rounded-xl shadow-lg shadow-${p}-500/25 hover:shadow-xl hover:shadow-${p}-500/30 hover:-translate-y-0.5 transition-all`, esc(config.hero.secondaryCta.text), needsLink)}`
    : "";

  const linkImport = needsLink.value ? `import Link from "next/link";\n` : "";

  return `${linkImport}export default function Hero() {
  return (
    <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 ${t.bgHero} overflow-hidden">
${decorativeOrbs(p, s)}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="relative h-80 md:h-[500px] order-2 md:order-1 ring-1 ring-${p}-200/50 rounded-2xl overflow-hidden">
            ${heroImg}
          </div>
          <div className="order-1 md:order-2">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-${p}-100 text-${p}-700 mb-6">
              ${pillText(config)}
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold ${t.textHeading} leading-tight tracking-tight">
              ${esc(config.hero.headline)}
            </h1>
            <p className="mt-6 text-lg ${t.textBody} leading-relaxed">
              ${esc(config.hero.subheadline)}
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              ${primaryCta}
${secondaryCta}
            </div>
            <div className="mt-8 flex items-center gap-8">
              <div>
                <p className="text-2xl font-bold ${t.textHeading}">100+</p>
                <p className="text-sm ${t.textMuted}">Happy clients</p>
              </div>
              <div className="w-px h-10 ${isDark ? "bg-gray-700" : "bg-gray-200"}" />
              <div>
                <p className="text-2xl font-bold ${t.textHeading}">5.0</p>
                <p className="text-sm ${t.textMuted}">Star rating</p>
              </div>
              <div className="w-px h-10 ${isDark ? "bg-gray-700" : "bg-gray-200"}" />
              <div>
                <p className="text-2xl font-bold ${t.textHeading}">24/7</p>
                <p className="text-sm ${t.textMuted}">Support</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
`;
}

// ── Fullscreen ──────────────────────────────────────────────────

function renderFullscreenHero(config: WebsiteConfig): string {
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const heroImg = imgTag(config.hero.imageDescription, "absolute inset-0 w-full h-full object-cover");
  const needsLink = { value: false };

  const primaryCta = ctaTag(
    config.hero.ctaHref,
    `inline-flex items-center px-8 py-3.5 text-base font-semibold text-white bg-${p}-600 hover:bg-${p}-700 rounded-xl shadow-lg shadow-${p}-500/25 hover:shadow-xl hover:shadow-${p}-500/30 hover:-translate-y-0.5 transition-all`,
    `\n            ${esc(config.hero.ctaText)}\n          `,
    needsLink,
  );

  const secondaryCta = config.hero.secondaryCta
    ? `            ${ctaTag(config.hero.secondaryCta.href, `inline-flex items-center px-8 py-3.5 text-base font-semibold text-white border-2 border-white/30 hover:bg-white/10 rounded-xl shadow-lg shadow-${p}-500/25 hover:shadow-xl hover:shadow-${p}-500/30 hover:-translate-y-0.5 transition-all`, esc(config.hero.secondaryCta.text), needsLink)}`
    : "";

  const linkImport = needsLink.value ? `import Link from "next/link";\n` : "";

  return `${linkImport}export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image */}
      ${heroImg}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
${decorativeOrbs(p, s)}
      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <div className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-white/20 text-white backdrop-blur-sm mb-6">
          ${pillText(config)}
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white leading-tight tracking-tight">
          ${esc(config.hero.headline)}
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-gray-200 max-w-2xl mx-auto leading-relaxed">
          ${esc(config.hero.subheadline)}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          ${primaryCta}
${secondaryCta}
        </div>
      </div>
      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 animate-bounce">
        <span className="text-white/60 text-xs uppercase tracking-widest">Scroll</span>
        <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </section>
  );
}
`;
}

// ── Minimal ─────────────────────────────────────────────────────

function renderMinimalHero(config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";
  const needsLink = { value: false };

  const primaryCta = ctaTag(
    config.hero.ctaHref,
    `inline-flex items-center px-8 py-3.5 text-base font-semibold text-white bg-${p}-600 hover:bg-${p}-700 rounded-xl shadow-lg shadow-${p}-500/25 hover:shadow-xl hover:shadow-${p}-500/30 hover:-translate-y-0.5 transition-all`,
    `\n            ${esc(config.hero.ctaText)}\n          `,
    needsLink,
  );

  const secondaryCta = config.hero.secondaryCta
    ? `            ${ctaTag(config.hero.secondaryCta.href, `inline-flex items-center text-base font-medium ${isDark ? `text-${p}-400 hover:text-${p}-300` : `text-${p}-600 hover:text-${p}-700`} transition-colors underline underline-offset-4`, esc(config.hero.secondaryCta.text), needsLink)}`
    : "";

  const linkImport = needsLink.value ? `import Link from "next/link";\n` : "";

  return `${linkImport}export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 ${isDark ? "bg-gray-950" : "bg-white"} overflow-hidden">
${decorativeOrbs(p, s)}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-${p}-100 text-${p}-700 mb-6">
          ${pillText(config)}
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold ${t.textHeading} leading-tight tracking-tight">
          <span className="relative">
            <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-${p}-600 to-${s}-600 rounded-full"></span>
            ${esc(config.hero.headline)}
          </span>
        </h1>
        <p className="mt-8 text-lg sm:text-xl ${t.textBody} max-w-2xl leading-relaxed">
          ${esc(config.hero.subheadline)}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-start gap-4">
          ${primaryCta}
${secondaryCta}
        </div>
      </div>
    </section>
  );
}
`;
}

// ── Gradient Animated ───────────────────────────────────────────

function renderGradientAnimatedHero(config: WebsiteConfig): string {
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const needsLink = { value: false };

  const primaryCta = ctaTag(
    config.hero.ctaHref,
    `inline-flex items-center px-8 py-3.5 text-base font-semibold text-${p}-700 bg-white hover:bg-gray-100 rounded-xl shadow-lg shadow-${p}-500/25 hover:shadow-xl hover:shadow-${p}-500/30 hover:-translate-y-0.5 transition-all`,
    `\n            ${esc(config.hero.ctaText)}\n          `,
    needsLink,
  );

  const secondaryCta = config.hero.secondaryCta
    ? `            ${ctaTag(config.hero.secondaryCta.href, `inline-flex items-center px-8 py-3.5 text-base font-semibold text-white border-2 border-white/30 hover:bg-white/10 rounded-xl shadow-lg shadow-${p}-500/25 hover:shadow-xl hover:shadow-${p}-500/30 hover:-translate-y-0.5 transition-all`, esc(config.hero.secondaryCta.text), needsLink)}`
    : "";

  const linkImport = needsLink.value ? `import Link from "next/link";\n` : "";

  return `${linkImport}export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-${p}-600 via-${s}-600 to-${p}-700 overflow-hidden">
      {/* Floating geometric shapes */}
      <div className="absolute top-20 left-10 w-20 h-20 border border-white/20 rounded-lg rotate-12 animate-spin" style={{ animationDuration: "25s" }} />
      <div className="absolute top-40 right-20 w-16 h-16 border border-white/20 rounded-full animate-spin" style={{ animationDuration: "20s" }} />
      <div className="absolute bottom-32 left-1/4 w-24 h-24 border border-white/20 rounded-lg -rotate-12 animate-spin" style={{ animationDuration: "30s" }} />
      <div className="absolute bottom-20 right-1/3 w-14 h-14 border border-white/20 rounded-full animate-spin" style={{ animationDuration: "18s" }} />
      <div className="absolute top-1/3 left-1/3 w-10 h-10 border border-white/20 rounded-lg rotate-45 animate-spin" style={{ animationDuration: "22s" }} />
      <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <div className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-white/20 text-white backdrop-blur-sm mb-6">
          ${pillText(config)}
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white leading-tight tracking-tight">
          ${esc(config.hero.headline)}
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
          ${esc(config.hero.subheadline)}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          ${primaryCta}
${secondaryCta}
        </div>
      </div>
    </section>
  );
}
`;
}

// ── Video Background ────────────────────────────────────────────

function renderVideoBgHero(config: WebsiteConfig): string {
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const needsLink = { value: false };

  const primaryCta = ctaTag(
    config.hero.ctaHref,
    `inline-flex items-center px-8 py-3.5 text-base font-semibold text-white bg-${p}-600 hover:bg-${p}-700 rounded-xl shadow-lg shadow-${p}-500/25 hover:shadow-xl hover:shadow-${p}-500/30 hover:-translate-y-0.5 transition-all`,
    `\n              ${esc(config.hero.ctaText)}\n            `,
    needsLink,
  );

  const secondaryCta = config.hero.secondaryCta
    ? `              ${ctaTag(config.hero.secondaryCta.href, `inline-flex items-center px-8 py-3.5 text-base font-semibold text-white border-2 border-white/30 hover:bg-white/10 rounded-xl shadow-lg shadow-${p}-500/25 hover:shadow-xl hover:shadow-${p}-500/30 hover:-translate-y-0.5 transition-all`, esc(config.hero.secondaryCta.text), needsLink)}`
    : "";

  const linkImport = needsLink.value ? `import Link from "next/link";\n` : "";

  return `${linkImport}export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated gradient background (video-like effect) */}
      <div className="absolute inset-0 bg-gradient-to-br from-${p}-700 via-${s}-600 to-${p}-800 animate-gradient bg-[length:400%_400%]" />
      {/* Animated overlay shapes */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-${p}-900/40 via-transparent to-${s}-900/40 animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="absolute top-1/4 -left-10 w-96 h-96 bg-${s}-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
        <div className="absolute bottom-1/4 -right-10 w-80 h-80 bg-${p}-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "10s" }} />
      </div>
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40" />
      {/* Glassmorphism content card */}
      <div className="relative z-10 max-w-3xl mx-auto px-4">
        <div className="backdrop-blur-xl bg-white/10 ring-1 ring-white/20 rounded-3xl p-8 sm:p-12 text-center shadow-2xl">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-white/20 text-white backdrop-blur-sm mb-6">
            ${pillText(config)}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold text-white leading-tight tracking-tight">
            ${esc(config.hero.headline)}
          </h1>
          <p className="mt-6 text-base sm:text-lg text-white/80 max-w-xl mx-auto leading-relaxed">
            ${esc(config.hero.subheadline)}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            ${primaryCta}
${secondaryCta}
          </div>
        </div>
      </div>
    </section>
  );
}
`;
}
