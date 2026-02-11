import type { WebsiteConfig, StatsSection } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc, escAttr } from "../utils/helpers";

export function renderStats(section: StatsSection, config: WebsiteConfig): string {
  switch (section.variant) {
    case "inline":        return renderInline(section, config);
    case "cards":         return renderCards(section, config);
    case "large-numbers": return renderLargeNumbers(section, config);
  }
}

// ── Shared: CountUp value renderer snippet ───────────────────────
// Parses a stat value like "$1,200+", "99.9%", "24/7" and renders
// either an animated CountUp for numeric values or plain text.

function countUpSnippet(item: { value: string }): string {
  return `{(() => {
                  const raw = "${escAttr(item.value)}";
                  const match = raw.match(/^([^0-9]*)([\\d,]+\\.?\\d*)(.*)$/);
                  if (match && inView) {
                    return <><span>{match[1]}</span><CountUp end={parseFloat(match[2].replace(/,/g, ""))} duration={2.5} separator="," /><span>{match[3]}</span></>;
                  }
                  return raw;
                })()}`;
}

// ── Inline variant ───────────────────────────────────────────────

function renderInline(section: StatsSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  const items = section.items
    .map(
      (item, i) => {
        const isLast = i === section.items.length - 1;
        const divider = !isLast
          ? `\n            <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-16 bg-gradient-to-b from-transparent via-${p}-300 to-transparent opacity-50" />`
          : "";
        return `          <div className="relative text-center px-4">
              <p className="text-3xl sm:text-4xl lg:text-5xl font-extrabold bg-gradient-to-r from-${p}-600 to-${s}-600 bg-clip-text text-transparent">
                ${countUpSnippet(item)}
              </p>
              <p className="mt-2 text-xs sm:text-sm ${t.textMuted} uppercase tracking-wider font-medium">${esc(item.label)}</p>${divider}
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";
import CountUp from "react-countup";

export default function Stats() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.3 });

  return (
    <section className="py-16 lg:py-20 ${t.bgSectionAlt}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <h2 className="text-2xl sm:text-3xl font-bold ${t.textHeading} text-center mb-12">${esc(section.title)}</h2>\n` : ""}        <div ref={ref} className="grid grid-cols-2 md:grid-cols-${Math.min(section.items.length, 4)} gap-8">
${items}
        </div>
      </div>
    </section>
  );
}
`;
}

// ── Cards variant ────────────────────────────────────────────────

function renderCards(section: StatsSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  const items = section.items
    .map(
      (item, i) => `          <div
            className="${t.bgCard} rounded-2xl border ${t.borderLight} border-t-4 border-t-${p}-500 p-8 text-center hover:-translate-y-1 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
            style={{ animationDelay: "${i * 150}ms" }}
          >
            <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-${p}-100 opacity-40 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-${p}-400" />
            </div>
            <p className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-${p}-600 mb-2">
              ${countUpSnippet(item)}
            </p>
            <p className="text-sm ${t.textBody} font-medium">${esc(item.label)}</p>
          </div>`,
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";
import CountUp from "react-countup";

export default function Stats() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.3 });

  return (
    <section className="py-20 lg:py-24 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n        </div>\n` : ""}        <div ref={ref} className="grid grid-cols-2 md:grid-cols-${Math.min(section.items.length, 4)} gap-6">
${items}
        </div>
      </div>
    </section>
  );
}
`;
}

// ── Large Numbers variant ────────────────────────────────────────

function renderLargeNumbers(section: StatsSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;

  const items = section.items
    .map(
      (item) => `          <div className="text-center py-8 relative z-10">
            <p className="text-6xl md:text-7xl font-black bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent tracking-tight drop-shadow-sm">
              ${countUpSnippet(item)}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white/90" />
              </span>
              <p className="text-sm sm:text-base text-white/90 font-medium tracking-wide">${esc(item.label)}</p>
            </div>
          </div>`,
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";
import CountUp from "react-countup";

export default function Stats() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.3 });

  return (
    <section className="relative py-20 lg:py-28 bg-gradient-to-br from-${p}-600 via-${s}-600 to-${p}-700 overflow-hidden">
      {/* Decorative floating circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute top-1/3 right-10 w-48 h-48 rounded-full bg-white/5 blur-xl" />
        <div className="absolute bottom-10 left-1/4 w-64 h-64 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-10 left-1/2 w-32 h-32 rounded-full bg-white/5 blur-lg" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-16 relative z-10">${esc(section.title)}</h2>\n` : ""}        <div ref={ref} className="grid grid-cols-2 md:grid-cols-${Math.min(section.items.length, 4)} gap-8">
${items}
        </div>
      </div>
    </section>
  );
}
`;
}
