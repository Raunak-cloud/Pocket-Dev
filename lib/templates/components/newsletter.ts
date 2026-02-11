import type { WebsiteConfig } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc } from "../utils/helpers";

// NewsletterSection will have: type: "newsletter", variant: "centered" | "split" | "banner", title, subtitle?, benefits?: string[]
// We access it via (section as any) since types will be updated separately

export function renderNewsletter(section: any, config: WebsiteConfig): string {
  switch (section.variant) {
    case "centered":   return renderCentered(section, config);
    case "split":      return renderSplit(section, config);
    case "banner":
    default:           return renderBanner(section, config);
  }
}

// ── Centered variant ────────────────────────────────────────────
// Glass-effect card with decorative gradient orbs, email input,
// subscribe button, and benefit items with check icons.

function renderCentered(section: any, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";
  const benefits: string[] = section.benefits || [];

  const benefitItems = benefits
    .map(
      (benefit, i) => `              <div key={${i}} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-${p}-500 to-${s}-500 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm ${t.textBody}">${esc(benefit)}</span>
              </div>`,
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";
import { Check, Mail } from "lucide-react";

export default function Newsletter() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.15 });

  return (
    <section className="py-20 lg:py-24 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={ref} className={\`relative overflow-hidden glass rounded-3xl p-8 sm:p-12 text-center transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}>
          {/* Decorative gradient orbs */}
          <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-${p}-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-${s}-500/10 blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-${p}-500/5 blur-2xl pointer-events-none" />

          <div className="relative z-10">
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-${p}-500 to-${s}-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-${p}-500/20">
              <Mail className="w-7 h-7 text-white" />
            </div>

${section.title ? `            <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n` : ""}${section.subtitle ? `            <p className="mt-4 text-lg ${t.textBody} max-w-2xl mx-auto">${esc(section.subtitle)}</p>\n` : ""}
            {/* Email form */}
            <form className="mt-8 flex flex-col sm:flex-row gap-3 max-w-lg mx-auto" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                className="flex-1 px-4 py-3 rounded-xl border ${t.borderLight} ${isDark ? "bg-gray-800 text-white placeholder-gray-400" : "bg-white text-gray-900 placeholder-gray-400"} focus:ring-2 focus:ring-${p}-500 focus:border-transparent outline-none transition"
                placeholder="Enter your email"
              />
              <button type="submit" className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-${p}-600 to-${s}-600 hover:from-${p}-700 hover:to-${s}-700 rounded-xl shadow-lg shadow-${p}-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all whitespace-nowrap">
                Subscribe
              </button>
            </form>

            <p className="mt-3 text-xs ${t.textMuted}">No spam. Unsubscribe anytime.</p>

${benefits.length > 0 ? `            {/* Benefits */}\n            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6">\n${benefitItems}\n            </div>\n` : ""}
          </div>
        </div>
      </div>
    </section>
  );
}
`;
}

// ── Split variant ───────────────────────────────────────────────
// Left side: title, subtitle, benefits list. Right side: name + email form.
// Card container with gradient border.

function renderSplit(section: any, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";
  const benefits: string[] = section.benefits || [];

  const benefitItems = benefits
    .map(
      (benefit, i) => `              <li key={${i}} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-${p}-500 to-${s}-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="${t.textBody}">${esc(benefit)}</span>
              </li>`,
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";
import { Check, Send } from "lucide-react";

export default function Newsletter() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.15 });

  return (
    <section className="py-20 lg:py-24 ${t.bgSectionAlt}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={ref} className={\`relative rounded-3xl p-[1px] bg-gradient-to-r from-${p}-500 via-${s}-500 to-${p}-500 transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}>
          <div className="${isDark ? "bg-gray-900" : "bg-white"} rounded-3xl p-8 sm:p-12">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              {/* Left: Info */}
              <div>
${section.title ? `                <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n` : ""}${section.subtitle ? `                <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}
${benefits.length > 0 ? `                <ul className="mt-6 space-y-3">\n${benefitItems}\n                </ul>\n` : ""}
              </div>

              {/* Right: Form */}
              <div>
                <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                  <div>
                    <label className="block text-sm font-medium ${t.textHeading} mb-1.5">Name</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 rounded-xl border ${t.borderLight} ${isDark ? "bg-gray-800 text-white placeholder-gray-400" : "bg-white text-gray-900 placeholder-gray-400"} focus:ring-2 focus:ring-${p}-500 focus:border-transparent outline-none transition"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium ${t.textHeading} mb-1.5">Email</label>
                    <input
                      type="email"
                      className="w-full px-4 py-2.5 rounded-xl border ${t.borderLight} ${isDark ? "bg-gray-800 text-white placeholder-gray-400" : "bg-white text-gray-900 placeholder-gray-400"} focus:ring-2 focus:ring-${p}-500 focus:border-transparent outline-none transition"
                      placeholder="you@example.com"
                    />
                  </div>
                  <button type="submit" className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-${p}-600 to-${s}-600 hover:from-${p}-700 hover:to-${s}-700 rounded-xl shadow-lg shadow-${p}-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                    <Send className="w-4 h-4" />
                    Subscribe
                  </button>
                  <p className="text-xs ${t.textMuted} text-center">No spam. Unsubscribe anytime.</p>
                </form>
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

// ── Banner variant ──────────────────────────────────────────────
// Full-width gradient background with inline headline, email input,
// and subscribe button. Stacked on mobile, one row on desktop.

function renderBanner(section: any, config: WebsiteConfig): string {
  const p = config.theme.primary;
  const s = config.theme.secondary;

  return `"use client";

import { Send } from "lucide-react";

export default function Newsletter() {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden bg-gradient-to-r from-${p}-600 via-${s}-600 to-${p}-600 animate-gradient bg-[length:200%_auto] rounded-3xl px-8 py-12 sm:px-16">
          {/* Decorative floating shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
            {/* Headline */}
            <div className="flex-1 text-center lg:text-left">
${section.title ? `              <h2 className="text-2xl sm:text-3xl font-bold text-white">${esc(section.title)}</h2>\n` : ""}${section.subtitle ? `              <p className="mt-2 text-white/80">${esc(section.subtitle)}</p>\n` : ""}
            </div>

            {/* Email form */}
            <form className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                className="flex-1 lg:w-72 px-4 py-3 rounded-xl bg-white/20 backdrop-blur-sm text-white placeholder-white/60 border border-white/20 focus:ring-2 focus:ring-white/40 focus:border-transparent outline-none transition"
                placeholder="Enter your email"
              />
              <button type="submit" className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-${p}-700 bg-white hover:bg-gray-50 rounded-xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all whitespace-nowrap">
                <Send className="w-4 h-4" />
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
`;
}
