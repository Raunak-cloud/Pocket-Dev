import type { WebsiteConfig } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc, resolveIcon, collectIcons } from "../utils/helpers";

// ProcessSection will have: type: "process", variant: "numbered" | "timeline" | "cards",
// title?, subtitle?, steps: { title: string, description: string, icon?: string }[]
// We access it via (section as any) since types will be updated separately

export function renderProcess(section: any, config: WebsiteConfig): string {
  switch (section.variant) {
    case "numbered":   return renderNumbered(section, config);
    case "timeline":   return renderTimeline(section, config);
    case "cards":
    default:           return renderCards(section, config);
  }
}

// ── Helper: get icon imports for steps ──────────────────────────

function getStepIconImports(steps: { icon?: string }[]): string {
  const iconNames = steps.filter((s) => s.icon).map((s) => s.icon!);
  if (iconNames.length === 0) return "";
  const icons = collectIcons(iconNames);
  return `import { ${icons.join(", ")} } from "lucide-react";\n`;
}

function renderStepIcon(step: { icon?: string }, fallback: string): string {
  if (step.icon) {
    return `<${resolveIcon(step.icon)} className="w-6 h-6" />`;
  }
  return fallback;
}

// ── Numbered variant ────────────────────────────────────────────
// Large gradient number circles connected by dashed horizontal line.
// Staggered reveal via useInView.

function renderNumbered(section: any, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";
  const steps: { title: string; description: string; icon?: string }[] = section.steps || [];
  const cols = Math.min(steps.length, 4);

  const stepItems = steps
    .map(
      (step, i) => {
        const isLast = i === steps.length - 1;
        const num = String(i + 1).padStart(2, "0");
        // Connecting dashed line between steps (not on last item)
        const connector = !isLast
          ? `\n              {/* Connecting line */}\n              <div className="hidden lg:block absolute top-7 left-[calc(50%+28px)] w-[calc(100%-56px)] h-0.5 border-t-2 border-dashed ${isDark ? `border-${p}-700` : `border-${p}-300`}" />`
          : "";
        return `          <div
            key={${i}}
            className={\`relative text-center opacity-0 \${inView ? "animate-slide-up" : ""}\`}
            style={{ animationDelay: \`\${${i} * 0.15}s\`, animationFillMode: "forwards" }}
          >
            {/* Number circle */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-${p}-500 to-${p}-700 text-white flex items-center justify-center text-xl font-bold mx-auto shadow-lg shadow-${p}-500/25">
              ${num}
            </div>${connector}

            <h3 className="mt-6 text-lg font-semibold ${t.textHeading}">${esc(step.title)}</h3>
            <p className="mt-2 text-sm ${t.textBody} leading-relaxed">${esc(step.description)}</p>
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";

export default function Process() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 lg:py-24 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div ref={ref} className="grid sm:grid-cols-2 lg:grid-cols-${cols} gap-12 lg:gap-8">
${stepItems}
        </div>
      </div>
    </section>
  );
}
`;
}

// ── Timeline variant ────────────────────────────────────────────
// Vertical timeline with steps on alternating sides.
// Gradient connecting line down the center, staggered entrance.

function renderTimeline(section: any, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";
  const steps: { title: string; description: string; icon?: string }[] = section.steps || [];
  const iconImports = getStepIconImports(steps);

  const stepItems = steps
    .map(
      (step, i) => {
        const isEven = i % 2 === 0;
        const animClass = isEven ? "animate-slide-right" : "animate-slide-left";
        const num = String(i + 1).padStart(2, "0");
        const iconContent = renderStepIcon(step, num);
        return `          {/* Step ${i + 1} */}
          <div
            className={\`relative flex items-center gap-8 opacity-0 \${inView ? "${animClass}" : ""}\`}
            style={{ animationDelay: \`\${${i} * 0.2}s\`, animationFillMode: "forwards" }}
          >
            {/* Left content (even) or spacer (odd) */}
            <div className={\`flex-1 \${${isEven} ? "text-right" : ""} hidden md:block\`}>
${isEven ? `              <div className="inline-block ${t.bgCard} border ${t.borderLight} rounded-2xl p-6 text-left max-w-md ml-auto hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold ${t.textHeading}">${esc(step.title)}</h3>
                <p className="mt-2 text-sm ${t.textBody} leading-relaxed">${esc(step.description)}</p>
              </div>` : ""}
            </div>

            {/* Center node */}
            <div className="relative z-10 flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-${p}-500 to-${s}-600 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-${p}-500/25 ring-4 ${isDark ? "ring-gray-950" : "ring-white"}">
                ${iconContent}
              </div>
            </div>

            {/* Right content (odd) or spacer (even) */}
            <div className={\`flex-1 \${${!isEven} ? "" : ""}\`}>
${!isEven ? `              <div className="inline-block ${t.bgCard} border ${t.borderLight} rounded-2xl p-6 text-left max-w-md hover:shadow-lg transition-shadow">
                <h3 className="text-lg font-semibold ${t.textHeading}">${esc(step.title)}</h3>
                <p className="mt-2 text-sm ${t.textBody} leading-relaxed">${esc(step.description)}</p>
              </div>` : ""}
            </div>

            {/* Mobile-only content */}
            <div className="md:hidden flex-1">
              <h3 className="text-lg font-semibold ${t.textHeading}">${esc(step.title)}</h3>
              <p className="mt-2 text-sm ${t.textBody} leading-relaxed">${esc(step.description)}</p>
            </div>
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";
${iconImports}
export default function Process() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 lg:py-24 ${t.bgSectionAlt}">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div ref={ref} className="relative">
          {/* Vertical gradient line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-${p}-500 via-${s}-500 to-${p}-300 -translate-x-1/2 hidden md:block" />

          <div className="space-y-12">
${stepItems}
          </div>
        </div>
      </div>
    </section>
  );
}
`;
}

// ── Cards variant ───────────────────────────────────────────────
// Horizontal cards with step number, icon, title, description.
// Arrow/chevron between cards. Hover lift effect, staggered entrance.

function renderCards(section: any, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";
  const steps: { title: string; description: string; icon?: string }[] = section.steps || [];
  const iconImports = getStepIconImports(steps);
  const hasIcons = steps.some((s) => s.icon);

  const stepItems = steps
    .map(
      (step, i) => {
        const isLast = i === steps.length - 1;
        const num = String(i + 1).padStart(2, "0");
        const iconEl = step.icon
          ? `<${resolveIcon(step.icon)} className="w-6 h-6" />`
          : "";
        // Arrow separator between cards
        const arrow = !isLast
          ? `\n          {/* Arrow separator */}\n          <div className="hidden lg:flex items-center justify-center">\n            <svg className="w-8 h-8 ${t.textMuted}" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>\n              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />\n            </svg>\n          </div>`
          : "";
        return `          <div
            key={${i}}
            className={\`relative ${t.bgCard} border ${t.borderLight} rounded-2xl p-6 hover:-translate-y-1 hover:shadow-xl hover:shadow-${p}-500/10 transition-all duration-300 opacity-0 \${inView ? "animate-slide-up" : ""}\`}
            style={{ animationDelay: \`\${${i} * 0.15}s\`, animationFillMode: "forwards" }}
          >
            {/* Step number */}
            <span className="absolute top-4 right-4 text-3xl font-black ${isDark ? "text-gray-800" : "text-gray-100"} select-none pointer-events-none">${num}</span>

            {/* Icon */}
${iconEl ? `            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-${p}-500 to-${s}-600 text-white mb-4 shadow-lg shadow-${p}-500/20">\n              ${iconEl}\n            </div>\n` : `            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-${p}-500 to-${s}-600 text-white mb-4 shadow-lg shadow-${p}-500/20">\n              <span className="text-lg font-bold">${num}</span>\n            </div>\n`}
            <h3 className="text-lg font-semibold ${t.textHeading}">${esc(step.title)}</h3>
            <p className="mt-2 text-sm ${t.textBody} leading-relaxed">${esc(step.description)}</p>
          </div>${arrow}`;
      },
    )
    .join("\n");

  // Calculate grid: steps count plus separators
  const totalCols = steps.length + Math.max(steps.length - 1, 0);

  return `"use client";

import { useInView } from "react-intersection-observer";
${iconImports}
export default function Process() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 lg:py-24 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div ref={ref} className="grid sm:grid-cols-2 lg:grid-cols-${totalCols} gap-6 lg:gap-4 items-center">
${stepItems}
        </div>
      </div>
    </section>
  );
}
`;
}
