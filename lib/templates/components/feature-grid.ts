import type { WebsiteConfig, FeatureGridSection } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc, resolveIcon, collectIcons } from "../utils/helpers";

export function renderFeatureGrid(section: FeatureGridSection, config: WebsiteConfig): string {
  switch (section.variant) {
    case "cards":       return renderCards(section, config);
    case "icons-left":  return renderIconsLeft(section, config);
    case "icons-top":   return renderIconsTop(section, config);
    case "alternating": return renderAlternating(section, config);
  }
}

function getImports(section: FeatureGridSection): string {
  const icons = collectIcons(section.items.map((i) => i.icon));
  return `import { ${icons.join(", ")} } from "lucide-react";`;
}

// ── "cards" variant ─────────────────────────────────────────────
// Scroll-reveal via useInView, staggered card animations, gradient
// icon containers, hover border glow, and a large number index.

function renderCards(section: FeatureGridSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const isDark = config.theme.background === "dark";

  const items = section.items
    .map(
      (item, i) => `          <div
            key={${i}}
            className={\`relative p-6 ${t.bgCard} rounded-2xl border ${t.borderLight} hover:border-${p}-200 hover:shadow-xl hover:shadow-${p}-500/10 transition-all duration-500 group opacity-0 \${inView ? "animate-slide-up" : ""}\`}
            style={{ animationDelay: \`\${${i} * 0.1}s\`, animationFillMode: "forwards" }}
          >
            <span className="absolute top-4 right-4 text-4xl font-black ${isDark ? "text-gray-800" : "text-gray-100"} select-none pointer-events-none">${String(i + 1).padStart(2, "0")}</span>
            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-${p}-500 to-${p}-600 text-white mb-4 shadow-lg shadow-${p}-500/20">
              <${resolveIcon(item.icon)} className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold ${t.textHeading}">${esc(item.title)}</h3>
            <p className="mt-2 text-sm ${t.textBody} leading-relaxed">${esc(item.description)}</p>
          </div>`,
    )
    .join("\n");

  return `"use client";

import { useRef } from "react";
import { useInView } from "react-intersection-observer";
${getImports(section)}

export default function FeatureGrid() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div ref={ref} className="grid sm:grid-cols-2 lg:grid-cols-${Math.min(section.items.length, 4)} gap-6">
${items}
        </div>
      </div>
    </section>
  );
}
`;
}

// ── "icons-left" variant ────────────────────────────────────────
// Scroll-reveal, colored left border accent, icon ring effect.

function renderIconsLeft(section: FeatureGridSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;

  const items = section.items
    .map(
      (item, i) => `          <div
            key={${i}}
            className={\`flex gap-4 border-l-2 border-${p}-500 pl-6 opacity-0 \${inView ? "animate-slide-up" : ""}\`}
            style={{ animationDelay: \`\${${i} * 0.1}s\`, animationFillMode: "forwards" }}
          >
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-${p}-100 text-${p}-600 ring-2 ring-${p}-100">
              <${resolveIcon(item.icon)} className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold ${t.textHeading}">${esc(item.title)}</h3>
              <p className="mt-1 text-sm ${t.textBody}">${esc(item.description)}</p>
            </div>
          </div>`,
    )
    .join("\n");

  return `"use client";

import { useRef } from "react";
import { useInView } from "react-intersection-observer";
${getImports(section)}

export default function FeatureGrid() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSectionAlt}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="max-w-3xl mb-12">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div ref={ref} className="grid sm:grid-cols-2 gap-8">
${items}
        </div>
      </div>
    </section>
  );
}
`;
}

// ── "icons-top" variant ─────────────────────────────────────────
// Scroll-reveal, hover-float icons, gradient accent line under icon.

function renderIconsTop(section: FeatureGridSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;

  const items = section.items
    .map(
      (item, i) => `          <div
            key={${i}}
            className={\`text-center group opacity-0 \${inView ? "animate-slide-up" : ""}\`}
            style={{ animationDelay: \`\${${i} * 0.1}s\`, animationFillMode: "forwards" }}
          >
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-${p}-100 text-${p}-600 mb-0 group-hover:-translate-y-1 transition-transform duration-300">
              <${resolveIcon(item.icon)} className="w-7 h-7" />
            </div>
            <div className="w-8 h-0.5 bg-gradient-to-r from-${p}-500 to-${s}-500 mx-auto mt-3 mb-4 rounded-full" />
            <h3 className="text-lg font-semibold ${t.textHeading}">${esc(item.title)}</h3>
            <p className="mt-2 text-sm ${t.textBody} leading-relaxed">${esc(item.description)}</p>
          </div>`,
    )
    .join("\n");

  return `"use client";

import { useRef } from "react";
import { useInView } from "react-intersection-observer";
${getImports(section)}

export default function FeatureGrid() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div ref={ref} className="grid sm:grid-cols-2 lg:grid-cols-${Math.min(section.items.length, 4)} gap-10">
${items}
        </div>
      </div>
    </section>
  );
}
`;
}

// ── "alternating" variant ───────────────────────────────────────
// Scroll-reveal with alternating slide-left / slide-right per row,
// glass-effect gradient placeholder with subtle dot pattern,
// connecting vertical line between items.

function renderAlternating(section: FeatureGridSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  const items = section.items
    .map(
      (item, i) => {
        const isEven = i % 2 === 0;
        const animClass = isEven ? "animate-slide-left" : "animate-slide-right";
        return `          {/* Item ${i + 1} */}
          <div className="relative">
${i > 0 ? `            <div className="absolute left-1/2 -top-8 w-px h-8 bg-gradient-to-b from-${p}-300 to-${p}-100 hidden md:block" />\n` : ""}
            <div
              className={\`flex flex-col md:flex-row ${!isEven ? "md:flex-row-reverse" : ""} items-center gap-8 opacity-0 \${inView ? "${animClass}" : ""}\`}
              style={{ animationDelay: \`\${${i} * 0.15}s\`, animationFillMode: "forwards" }}
            >
              <div className="flex-1">
                <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-${p}-500 to-${p}-600 text-white mb-4 shadow-lg shadow-${p}-500/20">
                  <${resolveIcon(item.icon)} className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold ${t.textHeading}">${esc(item.title)}</h3>
                <p className="mt-3 text-base ${t.textBody} leading-relaxed">${esc(item.description)}</p>
              </div>
              <div className="flex-1 w-full h-48 rounded-2xl relative overflow-hidden ${isDark ? "bg-gray-800/50 border border-gray-700/50" : "bg-white/60 border border-gray-200/50"} backdrop-blur-sm shadow-inner">
                <div className="absolute inset-0 bg-gradient-to-br from-${p}-100/60 to-${s}-100/40 ${isDark ? "from-${p}-900/30 to-${s}-900/20" : ""}" />
                <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, ${isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"} 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
              </div>
            </div>
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useRef } from "react";
import { useInView } from "react-intersection-observer";
${getImports(section)}

export default function FeatureGrid() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div ref={ref} className="space-y-16">
${items}
        </div>
      </div>
    </section>
  );
}
`;
}
