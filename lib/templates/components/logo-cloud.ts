import type { WebsiteConfig } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc } from "../utils/helpers";

// LogoCloudSection will have: type: "logo-cloud", variant: "scroll" | "grid" | "simple", title?, subtitle?, items: { name: string }[]
// We access it via (section as any) since types will be updated separately

export function renderLogoCloud(section: any, config: WebsiteConfig): string {
  switch (section.variant) {
    case "scroll": return renderScroll(section, config);
    case "grid":   return renderGrid(section, config);
    case "simple":
    default:       return renderSimple(section, config);
  }
}

// ── Scroll variant ──────────────────────────────────────────────
// Infinite scrolling marquee of logo items using CSS animation.
// Duplicates the items list for seamless looping. Gradient fade on edges.

function renderScroll(section: any, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const isDark = config.theme.background === "dark";
  const items: { name: string }[] = section.items || [];

  const logoItem = (item: { name: string }, i: number, prefix: string) =>
    `              <div key={"${prefix}-${i}"} className="flex-shrink-0 mx-8 px-6 py-3 ${t.bgCard} border ${t.borderLight} rounded-xl">
                <span className="text-lg font-bold ${t.textMuted}">${esc(item.name)}</span>
              </div>`;

  const firstSet = items.map((item, i) => logoItem(item, i, "a")).join("\n");
  const secondSet = items.map((item, i) => logoItem(item, i, "b")).join("\n");

  const fromColor = isDark ? "gray-950" : "white";

  return `"use client";

export default function LogoCloud() {
  return (
    <section className="py-16 lg:py-20 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-12">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div className="relative overflow-hidden">
          {/* Left fade */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-${fromColor} to-transparent z-10 pointer-events-none" />
          {/* Right fade */}
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-${fromColor} to-transparent z-10 pointer-events-none" />

          <div className="flex animate-marquee">
            {/* First set */}
${firstSet}
            {/* Duplicate set for seamless loop */}
${secondSet}
          </div>
        </div>
      </div>
    </section>
  );
}
`;
}

// ── Grid variant ────────────────────────────────────────────────
// Static grid of logo cards with grayscale hover effect.

function renderGrid(section: any, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const isDark = config.theme.background === "dark";
  const items: { name: string }[] = section.items || [];
  const cols = Math.min(Math.max(items.length, 3), 6);

  const logoItems = items
    .map(
      (item, i) => `          <div
            key={${i}}
            className="${t.bgCard} border ${t.borderLight} rounded-2xl p-8 flex items-center justify-center opacity-50 hover:opacity-100 transition-all duration-300 hover:shadow-lg hover:border-${p}-200 group"
          >
            <span className="text-xl font-bold ${t.textMuted} group-hover:${isDark ? `text-${p}-400` : `text-${p}-600`} transition-colors duration-300">${esc(item.name)}</span>
          </div>`,
    )
    .join("\n");

  return `export default function LogoCloud() {
  return (
    <section className="py-16 lg:py-20 ${t.bgSectionAlt}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-12">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-${cols} gap-6">
${logoItems}
        </div>
      </div>
    </section>
  );
}
`;
}

// ── Simple variant ──────────────────────────────────────────────
// Single row centered with "Trusted by" label above.

function renderSimple(section: any, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const items: { name: string }[] = section.items || [];

  const logoItems = items
    .map(
      (item, i) => `          <div key={${i}} className="px-6 py-3 ${t.bgCard} border ${t.borderLight} rounded-xl">
            <span className="text-lg font-bold ${t.textMuted}">${esc(item.name)}</span>
          </div>`,
    )
    .join("\n");

  return `export default function LogoCloud() {
  return (
    <section className="py-16 lg:py-20 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-medium ${t.textMuted} uppercase tracking-wider mb-8">${section.title ? esc(section.title) : "Trusted by leading companies"}</p>
${section.subtitle ? `          <p className="text-base ${t.textBody} mb-8 max-w-2xl mx-auto">${esc(section.subtitle)}</p>\n` : ""}
          <div className="flex flex-wrap items-center justify-center gap-4">
${logoItems}
          </div>
        </div>
      </div>
    </section>
  );
}
`;
}
