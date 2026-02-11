import type { WebsiteConfig, FaqSection } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc } from "../utils/helpers";

export function renderFaq(section: FaqSection, config: WebsiteConfig): string {
  switch (section.variant) {
    case "accordion":  return renderAccordion(section, config);
    case "two-column": return renderTwoColumn(section, config);
    case "simple":     return renderSimple(section, config);
  }
}

// ── "accordion" variant ──────────────────────────────────────────
// Smooth max-height transition, gradient left border on active,
// numbered questions, chevron rotation, scroll-reveal

function renderAccordion(section: FaqSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  const items = section.items
    .map(
      (item, i) => `          <div className={\`rounded-2xl border transition-all duration-300 \${open === ${i} ? "${isDark ? `border-${p}-500/30 bg-${p}-950/30` : `border-${p}-200 bg-${p}-50/30`} shadow-sm" : "${t.borderLight} ${isDark ? "bg-gray-900/50" : "bg-white"} hover:shadow-sm"}\`}>
            <button
              onClick={() => setOpen(open === ${i} ? null : ${i})}
              className="w-full flex items-center gap-4 py-5 px-6 text-left"
            >
              <span className={\`flex-shrink-0 text-sm font-bold \${open === ${i} ? "text-${p}-600" : "${t.textMuted}"}\`}>${String(i + 1).padStart(2, "0")}</span>
              <span className={\`flex-1 font-medium \${open === ${i} ? "text-${p}-600" : "${t.textHeading}"} transition-colors\`}>${esc(item.question)}</span>
              <ChevronDown className={\`w-5 h-5 flex-shrink-0 ${t.textMuted} transition-transform duration-300 \${open === ${i} ? "rotate-180 text-${p}-500" : ""}\`} />
            </button>
            <div className={\`overflow-hidden transition-all duration-300 \${open === ${i} ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}\`}>
              <div className="px-6 pb-5 pl-16 ${t.textBody} leading-relaxed">
                ${esc(item.answer)}
              </div>
            </div>
            {open === ${i} && <div className="h-0.5 mx-6 mb-0 rounded-full bg-gradient-to-r from-${p}-500 to-${s}-500" />}
          </div>`,
    )
    .join("\n");

  return `"use client";

import { useState } from "react";
import { useInView } from "react-intersection-observer";
import { ChevronDown } from "lucide-react";

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-24 ${t.bgSection}">
      <div
        ref={ref}
        className={\`max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
      >
${section.title ? `        <div className="text-center mb-14">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div className="space-y-3">
${items}
        </div>
      </div>
    </section>
  );
}
`;
}

// ── "two-column" variant ─────────────────────────────────────────
// Numbered questions (01, 02, ...) in primary color, hover effect
// on each Q&A block, better spacing, scroll-reveal

function renderTwoColumn(section: FaqSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const isDark = config.theme.background === "dark";

  const half = Math.ceil(section.items.length / 2);
  const leftItems = section.items.slice(0, half);
  const rightItems = section.items.slice(half);

  let globalIndex = 0;

  const renderCol = (items: typeof section.items) =>
    items
      .map((item) => {
        globalIndex++;
        const num = String(globalIndex).padStart(2, "0");
        return `            <div className="${isDark ? `hover:bg-${p}-950/30` : `hover:bg-${p}-50/50`} rounded-xl p-5 -m-5 transition-colors duration-200">
              <div className="flex items-start gap-3 mb-2">
                <span className="text-sm font-bold text-${p}-500 mt-0.5">${num}</span>
                <h3 className="text-base font-semibold ${t.textHeading} leading-snug">${esc(item.question)}</h3>
              </div>
              <p className="ml-8 text-sm ${t.textBody} leading-relaxed">${esc(item.answer)}</p>
            </div>`;
      })
      .join("\n");

  const leftHtml = renderCol(leftItems);
  globalIndex = half; // Reset for proper numbering since renderCol mutates
  // Actually, we already incremented correctly. The above is fine.

  return `"use client";

import { useInView } from "react-intersection-observer";

export default function Faq() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-24 ${t.bgSectionAlt}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div
          ref={ref}
          className={\`grid md:grid-cols-2 gap-x-16 gap-y-10 transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
        >
          <div className="space-y-10">
${leftHtml}
          </div>
          <div className="space-y-10">
${renderCol(rightItems)}
          </div>
        </div>
      </div>
    </section>
  );
}
`;
}

// ── "simple" variant ─────────────────────────────────────────────
// Gradient accent dot before each question, better separator
// styling, hover highlight, scroll-reveal

function renderSimple(section: FaqSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  const items = section.items
    .map(
      (item, i) => `        <div className="group py-7 ${i < section.items.length - 1 ? `border-b ${isDark ? "border-gray-800" : "border-gray-100"}` : ""} ${isDark ? `hover:bg-${p}-950/20` : `hover:bg-${p}-50/40`} rounded-xl px-5 -mx-5 transition-colors duration-200">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-2 h-2 mt-2.5 rounded-full bg-gradient-to-br from-${p}-500 to-${s}-500 group-hover:scale-125 transition-transform" />
            <div>
              <h3 className="text-base font-semibold ${t.textHeading} group-hover:text-${p}-600 transition-colors">${esc(item.question)}</h3>
              <p className="mt-2 ${t.textBody} leading-relaxed">${esc(item.answer)}</p>
            </div>
          </div>
        </div>`,
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";

export default function Faq() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-24 ${t.bgSection}">
      <div
        ref={ref}
        className={\`max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
      >
${section.title ? `        <div className="mb-10">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
${items}
      </div>
    </section>
  );
}
`;
}
