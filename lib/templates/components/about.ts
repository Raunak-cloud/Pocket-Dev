import type { WebsiteConfig, AboutSection } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc, imgTag, resolveIcon, collectIcons } from "../utils/helpers";

export function renderAbout(section: AboutSection, config: WebsiteConfig): string {
  switch (section.variant) {
    case "text-image":  return renderTextImage(section, config);
    case "timeline":    return renderTimeline(section, config);
    case "values-grid": return renderValuesGrid(section, config);
  }
}

// ── "text-image" variant ─────────────────────────────────────────
// Scroll-reveal, gradient accent line above title, decorative image
// frame (ring + shadow), better leading, small stats row below content

function renderTextImage(section: AboutSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";
  const image = section.imageDescription
    ? imgTag(section.imageDescription, "w-full h-80 object-cover rounded-2xl")
    : "";

  return `"use client";

import { useInView } from "react-intersection-observer";

export default function About() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-24 ${t.bgSection}">
      <div
        ref={ref}
        className={\`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
      >
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            {/* Gradient accent line */}
            <div className="w-16 h-1 bg-gradient-to-r from-${p}-500 to-${s}-500 rounded-full mb-6" />
${section.title ? `            <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading} leading-tight">${esc(section.title)}</h2>\n` : ""}
${section.subtitle ? `            <p className="mt-3 text-lg text-${p}-600 font-medium">${esc(section.subtitle)}</p>\n` : ""}
            <div className="mt-6 ${t.textBody} leading-relaxed space-y-4 text-base">
              <p>${esc(section.content || "")}</p>
            </div>

            {/* Stats row */}
            <div className="mt-10 grid grid-cols-3 gap-6">
              <div className="text-center ${isDark ? "bg-gray-900/60" : "bg-gray-50"} rounded-xl py-4 px-3">
                <p className="text-2xl font-bold bg-gradient-to-r from-${p}-600 to-${s}-600 bg-clip-text text-transparent">10+</p>
                <p className="text-xs ${t.textMuted} mt-1">Years Experience</p>
              </div>
              <div className="text-center ${isDark ? "bg-gray-900/60" : "bg-gray-50"} rounded-xl py-4 px-3">
                <p className="text-2xl font-bold bg-gradient-to-r from-${p}-600 to-${s}-600 bg-clip-text text-transparent">500+</p>
                <p className="text-xs ${t.textMuted} mt-1">Happy Clients</p>
              </div>
              <div className="text-center ${isDark ? "bg-gray-900/60" : "bg-gray-50"} rounded-xl py-4 px-3">
                <p className="text-2xl font-bold bg-gradient-to-r from-${p}-600 to-${s}-600 bg-clip-text text-transparent">99%</p>
                <p className="text-xs ${t.textMuted} mt-1">Satisfaction</p>
              </div>
            </div>
          </div>
${image ? `          {/* Decorative image frame */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-${p}-500/20 to-${s}-500/20 rounded-3xl blur-2xl" />
            <div className="relative ring-1 ring-${p}-200/50 ${isDark ? "ring-${p}-500/20" : ""} rounded-2xl overflow-hidden shadow-2xl">
              ${image}
            </div>
          </div>` : ""}
        </div>
      </div>
    </section>
  );
}
`;
}

// ── "timeline" variant ───────────────────────────────────────────
// Gradient connecting line, gradient circle nodes, alternating
// left/right layout on desktop, staggered reveal

function renderTimeline(section: AboutSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  const events = (section.timeline || [])
    .map(
      (e, i) => {
        const isLeft = i % 2 === 0;
        return `          {/* Timeline item ${i + 1} */}
          <div
            style={{ transitionDelay: "${i * 150}ms" }}
            className={\`relative grid md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-8 transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
          >
            {/* Left content */}
            <div className="${isLeft ? "" : "md:order-3 "}${isLeft ? "md:text-right" : ""}">
              ${isLeft ? `<div className="${isDark ? "bg-gray-900/80 border border-gray-800" : "bg-white border border-gray-100"} rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-bold ${t.textHeading}">${esc(e.title)}</h3>
                <p className="mt-2 text-sm ${t.textBody} leading-relaxed">${esc(e.description)}</p>
              </div>` : `<div className="hidden md:block" />`}
            </div>

            {/* Center node */}
            <div className="flex flex-col items-center ${isLeft ? "" : "md:order-2"}">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-${p}-500 to-${s}-600 text-white flex items-center justify-center text-xs font-bold shadow-lg shadow-${p}-500/30 ring-4 ${isDark ? "ring-gray-950" : "ring-white"}">
                ${esc(e.year)}
              </div>
              ${i < (section.timeline || []).length - 1 ? `<div className="w-0.5 flex-1 bg-gradient-to-b from-${p}-400 to-${s}-400 mt-2 min-h-[2rem]" />` : ""}
            </div>

            {/* Right content */}
            <div className="${isLeft ? "md:order-3 " : ""}${isLeft ? "" : "md:text-left"}">
              ${isLeft ? `<div className="hidden md:block" />` : `<div className="${isDark ? "bg-gray-900/80 border border-gray-800" : "bg-white border border-gray-100"} rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-bold ${t.textHeading}">${esc(e.title)}</h3>
                <p className="mt-2 text-sm ${t.textBody} leading-relaxed">${esc(e.description)}</p>
              </div>`}
            </div>
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";

export default function About() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.05 });

  return (
    <section className="py-24 ${t.bgSectionAlt}">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center mb-8">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
${section.content ? `        <div className="max-w-3xl mx-auto ${t.textBody} leading-relaxed text-center mb-16">\n          <p>${esc(section.content)}</p>\n        </div>\n` : ""}
        <div ref={ref} className="space-y-6">
${events}
        </div>
      </div>
    </section>
  );
}
`;
}

// ── "values-grid" variant ────────────────────────────────────────
// Icon containers with gradient backgrounds, cards with hover lift,
// staggered entrance animation, gradient border on hover

function renderValuesGrid(section: AboutSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  const iconNames = (section.values || []).map((v) => v.icon || "star");
  const icons = collectIcons(iconNames);
  const iconImport = icons.length > 0 ? `import { ${icons.join(", ")} } from "lucide-react";\n` : "";

  const values = (section.values || [])
    .map(
      (v, i) => `          <div
            style={{ transitionDelay: "${i * 100}ms" }}
            className={\`group relative text-center p-8 rounded-2xl border ${isDark ? "border-gray-800 bg-gray-900/60" : "border-gray-100 bg-white"} hover:border-${p}-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
          >
            {/* Gradient border glow on hover */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-${p}-500/0 to-${s}-500/0 group-hover:from-${p}-500/10 group-hover:to-${s}-500/10 transition-all duration-300 pointer-events-none" />

            <div className="relative">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-${p}-500 to-${p}-600 text-white mb-5 shadow-lg shadow-${p}-500/20 group-hover:shadow-${p}-500/40 group-hover:scale-105 transition-all duration-300">
                <${resolveIcon(v.icon || "star")} className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold ${t.textHeading} group-hover:text-${p}-600 transition-colors">${esc(v.title)}</h3>
              <p className="mt-3 text-sm ${t.textBody} leading-relaxed">${esc(v.description)}</p>
            </div>
          </div>`,
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";
${iconImport}
export default function About() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-24 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-8">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
${section.content ? `        <div className="max-w-3xl mx-auto ${t.textBody} leading-relaxed text-center mb-16">\n          <p>${esc(section.content)}</p>\n        </div>\n` : ""}
        <div ref={ref} className="grid sm:grid-cols-2 lg:grid-cols-${Math.min((section.values || []).length, 4)} gap-8">
${values}
        </div>
      </div>
    </section>
  );
}
`;
}
