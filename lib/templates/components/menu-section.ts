import type { WebsiteConfig, MenuSection } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc, escAttr, imgTag } from "../utils/helpers";

export function renderMenuSection(section: MenuSection, config: WebsiteConfig): string {
  switch (section.variant) {
    case "tabbed":  return renderTabbed(section, config);
    case "grid":    return renderGrid(section, config);
    case "list":    return renderList(section, config);
    case "elegant": return renderElegant(section, config);
  }
}

// ── "tabbed" variant ─────────────────────────────────────────────
// Better tab buttons with sliding underline indicator, gradient
// active state, menu items with hover highlight, accent price,
// subtle decorative food emojis

function renderTabbed(section: MenuSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const isDark = config.theme.background === "dark";

  const categoryNames = section.categories.map((c) => `"${esc(c.name)}"`).join(", ");

  // Decorative food emojis mapped by index
  const foodDecorations = ["\u{1F374}", "\u{1F35D}", "\u{1F957}", "\u{1F372}", "\u{1F969}", "\u{1F370}"];

  const categoryItems = section.categories
    .map(
      (cat, ci) => {
        const items = cat.items
          .map(
            (item, ii) => {
              const emoji = foodDecorations[(ci * 3 + ii) % foodDecorations.length];
              return `              <div className="flex justify-between items-start gap-4 py-5 ${isDark ? "border-gray-800" : "border-gray-100"} border-b last:border-b-0 ${isDark ? "hover:bg-gray-800/50" : "hover:bg-gray-50"} -mx-4 px-4 rounded-lg transition-colors group">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm opacity-40 group-hover:opacity-70 transition-opacity">${emoji}</span>
                    <h4 className="font-semibold ${t.textHeading} group-hover:text-${p}-600 transition-colors">${esc(item.name)}</h4>
                  </div>
                  <p className="text-sm ${t.textBody} mt-1 ml-7">${esc(item.description)}</p>
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-${p}-500 to-${p}-700 bg-clip-text text-transparent whitespace-nowrap">${esc(item.price)}</span>
              </div>`;
            },
          )
          .join("\n");

        return `          {active === "${esc(cat.name)}" && (
            <div className="space-y-0 animate-fade-in">
${items}
            </div>
          )}`;
      },
    )
    .join("\n");

  const tabButtons = section.categories
    .map(
      (cat) =>
        `            <button
              key="${esc(cat.name)}"
              onClick={() => setActive("${esc(cat.name)}")}
              className={\`relative px-6 py-3 text-sm font-medium transition-all \${active === "${esc(cat.name)}" ? "text-${p}-600" : "${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}"}\`}
            >
              ${esc(cat.name)}
              <span className={\`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-${p}-500 to-${p}-600 rounded-full transition-all duration-300 \${active === "${esc(cat.name)}" ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"}\`} />
            </button>`,
    )
    .join("\n");

  return `"use client";

import { useState } from "react";
import { useInView } from "react-intersection-observer";

export default function MenuSection() {
  const [active, setActive] = useState("${esc(section.categories[0]?.name || "")}");
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center mb-12">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div
          ref={ref}
          className={\`transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
        >
          <div className="flex flex-wrap justify-center gap-0 mb-10 border-b ${isDark ? "border-gray-800" : "border-gray-200"}">
${tabButtons}
          </div>
          <div>
${categoryItems}
          </div>
        </div>
      </div>
    </section>
  );
}
`;
}

// ── "grid" variant ───────────────────────────────────────────────
// Scroll-reveal with staggered animation, cards with hover lift
// and border color change, price badge with gradient, decorative
// category headers with lines

function renderGrid(section: MenuSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const isDark = config.theme.background === "dark";

  const categories = section.categories
    .map(
      (cat, ci) => {
        const items = cat.items
          .map(
            (item, ii) => {
              const delay = ci * 200 + ii * 100;
              return `            <div
              ref={ref}
              style={{ transitionDelay: "${delay}ms" }}
              className={\`p-5 ${t.bgCard} rounded-xl border ${t.borderLight} hover:shadow-lg hover:-translate-y-0.5 hover:border-${p}-300 transition-all duration-700 group \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
            >
              <div className="flex justify-between items-start">
                <h4 className="font-semibold ${t.textHeading} group-hover:text-${p}-600 transition-colors">${esc(item.name)}</h4>
                <span className="ml-4 px-3 py-1 text-sm font-bold text-white bg-gradient-to-r from-${p}-500 to-${p}-600 rounded-full whitespace-nowrap">${esc(item.price)}</span>
              </div>
              <p className="text-sm ${t.textBody} mt-2">${esc(item.description)}</p>
            </div>`;
            },
          )
          .join("\n");

        return `          <div className="mb-12 last:mb-0">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-${p}-200" />
              <h3 className="text-2xl font-bold ${t.textHeading} whitespace-nowrap">${esc(cat.name)}</h3>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-${p}-200" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
${items}
            </div>
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";

export default function MenuSection() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSectionAlt}">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center mb-12">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
${categories}
      </div>
    </section>
  );
}
`;
}

// ── "list" variant ───────────────────────────────────────────────
// Better gradient dotted leader lines, hover highlight on items,
// category header with gradient underline, price in gradient text

function renderList(section: MenuSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const isDark = config.theme.background === "dark";

  const categories = section.categories
    .map(
      (cat) => {
        const items = cat.items
          .map(
            (item) => `            <div className="flex justify-between items-baseline gap-2 py-4 ${isDark ? "hover:bg-gray-800/40" : "hover:bg-gray-50"} -mx-4 px-4 rounded-lg transition-colors group">
              <div className="flex-shrink-0">
                <span className="font-medium ${t.textHeading} group-hover:text-${p}-600 transition-colors">${esc(item.name)}</span>
                <p className="text-sm ${t.textBody} mt-0.5">${esc(item.description)}</p>
              </div>
              <div className="flex-1 mx-3 mt-3 border-b-2 border-dotted ${isDark ? "border-gray-700" : "border-gray-200"} self-end" style={{ backgroundImage: "linear-gradient(to right, ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"} 33%, transparent 0%)", backgroundPosition: "bottom", backgroundSize: "6px 2px", backgroundRepeat: "repeat-x", borderColor: "transparent" }} />
              <span className="font-bold text-lg bg-gradient-to-r from-${p}-500 to-${p}-700 bg-clip-text text-transparent whitespace-nowrap flex-shrink-0">${esc(item.price)}</span>
            </div>`,
          )
          .join("\n");

        return `          <div className="mb-10 last:mb-0">
            <div className="relative inline-block mb-6">
              <h3 className="text-xl font-bold ${t.textHeading}">${esc(cat.name)}</h3>
              <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-${p}-500 to-${p}-600 rounded-full" />
            </div>
${items}
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";

export default function MenuSection() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center mb-12">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div
          ref={ref}
          className={\`transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
        >
${categories}
        </div>
      </div>
    </section>
  );
}
`;
}

// ── "elegant" variant ────────────────────────────────────────────
// Decorative ornament SVG between categories, gradient divider
// lines, serif-style price when using serif font, hover effects
// with subtle background change, "Popular" badge with star icon
// on first item in each category

function renderElegant(section: MenuSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const isDark = config.theme.background === "dark";
  const isSerif = config.theme.fontStyle === "serif";

  // Decorative ornament SVG
  const ornament = `          <div className="flex justify-center my-10">
            <svg className="w-24 h-6 ${isDark ? "text-gray-700" : `text-${p}-200`}" viewBox="0 0 96 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 12h36m24 0h36" stroke="currentColor" strokeWidth="1" />
              <circle cx="48" cy="12" r="4" fill="currentColor" />
              <circle cx="38" cy="12" r="1.5" fill="currentColor" />
              <circle cx="58" cy="12" r="1.5" fill="currentColor" />
              <path d="M42 8c2-3 4-3 6 0m-6 8c2 3 4 3 6 0" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          </div>`;

  // Star icon for "Popular" badge (inline SVG to avoid extra imports)
  const starSvg = `<svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" /></svg>`;

  const categories = section.categories
    .map(
      (cat, ci) => {
        const items = cat.items
          .map(
            (item, ii) => {
              const isFirst = ii === 0;
              const popularBadge = isFirst
                ? `\n                  <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 text-xs font-semibold text-${p}-600 bg-${p}-50 ${isDark ? `text-${p}-400 bg-${p}-950` : ""} rounded-full">${starSvg} Popular</span>`
                : "";
              return `            <div className="py-6 ${isDark ? "border-gray-800/60" : "border-gray-100"} border-b last:border-b-0 ${isDark ? "hover:bg-gray-800/30" : `hover:bg-${p}-50/30`} -mx-4 px-4 rounded-lg transition-colors group">
              <div className="flex justify-between items-start">
                <div className="flex items-center flex-wrap">
                  <h4 className="text-lg font-semibold ${t.textHeading} tracking-wide group-hover:text-${p}-600 transition-colors">${esc(item.name)}</h4>${popularBadge}
                </div>
                <span className="${isSerif ? "font-serif text-xl font-light italic" : "text-lg font-light"} ${t.textAccent} whitespace-nowrap ml-4">${esc(item.price)}</span>
              </div>
              <p className="text-sm ${t.textMuted} mt-1.5 italic">${esc(item.description)}</p>
            </div>`;
            },
          )
          .join("\n");

        const categoryBlock = `          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-${p}-300 to-transparent" />
              <h3 className="text-xl font-bold tracking-widest uppercase ${t.textAccent}">${esc(cat.name)}</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-${p}-300 to-transparent" />
            </div>
${items}
          </div>`;

        // Add ornament between categories (not after the last one)
        if (ci < section.categories.length - 1) {
          return categoryBlock + "\n" + ornament;
        }
        return categoryBlock;
      },
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";

export default function MenuSection() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${isDark ? "bg-gray-950" : "bg-stone-50"}">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center mb-16">\n          <h2 className="text-4xl font-bold ${t.textHeading} tracking-tight">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textMuted} italic">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div
          ref={ref}
          className={\`transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
        >
${categories}
        </div>
      </div>
    </section>
  );
}
`;
}
