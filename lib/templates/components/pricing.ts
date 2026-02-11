import type { WebsiteConfig, PricingSection } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc, escAttr } from "../utils/helpers";

export function renderPricing(section: PricingSection, config: WebsiteConfig): string {
  switch (section.variant) {
    case "columns":          return renderColumns(section, config);
    case "toggle":           return renderToggle(section, config);
    case "comparison-table": return renderComparison(section, config);
  }
}

// ── Shared: gradient checkmark circle ────────────────────────────

function checkmarkCircle(p: string): string {
  return `<div className="w-5 h-5 rounded-full bg-gradient-to-br from-${p}-500 to-${p}-600 flex items-center justify-center flex-shrink-0"><svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div>`;
}

// ── Shared: sparkle SVG icon ─────────────────────────────────────

function sparkleIcon(): string {
  return `<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41L12 0Z" /></svg>`;
}

// ── Columns variant ──────────────────────────────────────────────

function renderColumns(section: PricingSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  const tiers = section.tiers
    .map(
      (tier, idx) => {
        const highlighted = tier.highlighted;
        const features = tier.features
          .map(
            (f) => `                <li className="flex items-start gap-3">
                  ${checkmarkCircle(p)}
                  <span className="${highlighted ? "text-gray-300" : t.textBody}">${esc(f)}</span>
                </li>`,
          )
          .join("\n");

        const priceBlock = `              <span className="text-4xl font-extrabold ${highlighted ? "text-white" : t.textHeading}">${esc(tier.price)}</span>
${tier.period ? `              <span className="text-sm ${highlighted ? "text-white/60" : t.textMuted}"> / ${esc(tier.period)}</span>` : ""}
${highlighted && tier.period ? `              <span className="ml-2 inline-flex items-center text-xs font-bold text-${p}-600 bg-white/90 px-2 py-0.5 rounded-full">Save 20%</span>` : ""}`;

        const cardInner = `            <div className="${highlighted ? `bg-gradient-to-b from-${p}-600 to-${p}-700 text-white shadow-2xl shadow-${p}-500/25` : `${t.bgCard} border ${t.borderLight} hover:-translate-y-1 hover:shadow-xl transition-all duration-300`} rounded-2xl p-8 flex flex-col relative h-full">
${highlighted ? `              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-${p}-500 to-${s}-500 text-white text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-lg">${sparkleIcon()} Popular ${sparkleIcon()}</div>` : ""}
              <h3 className="text-xl font-bold ${highlighted ? "text-white" : t.textHeading}">${esc(tier.name)}</h3>
              <p className="mt-2 text-sm ${highlighted ? "text-white/70" : t.textMuted}">${esc(tier.description)}</p>
              <div className="mt-6 flex items-baseline flex-wrap gap-1">
${priceBlock}
              </div>
              <ul className="mt-8 space-y-4 flex-1">
${features}
              </ul>
              <button className="mt-8 w-full py-3.5 text-sm font-semibold rounded-xl transition-all duration-200 ${highlighted ? "bg-white text-gray-900 hover:bg-gray-100 hover:shadow-lg" : `text-white ${t.gradientPrimary} hover:shadow-lg hover:shadow-${p}-500/25`}">${esc(tier.ctaText)}</button>
            </div>`;

        // Highlighted tier gets animated gradient border wrapper
        if (highlighted) {
          return `          <div
            ref={ref}
            style={{ transitionDelay: \`\${${idx} * 150}ms\` }}
            className={\`transform transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
          >
            <div className="bg-gradient-to-r from-${p}-500 via-${s}-500 to-${p}-500 p-[2px] rounded-2xl animate-gradient bg-[length:200%_200%]">
${cardInner}
            </div>
          </div>`;
        }

        return `          <div
            ref={ref}
            style={{ transitionDelay: \`\${${idx} * 150}ms\` }}
            className={\`transform transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
          >
${cardInner}
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useRef } from "react";
import { useInView } from "react-intersection-observer";

export default function Pricing() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div className="grid md:grid-cols-${Math.min(section.tiers.length, 3)} gap-8 items-stretch">
${tiers}
        </div>
      </div>
    </section>
  );
}
`;
}

// ── Toggle variant ───────────────────────────────────────────────

function renderToggle(section: PricingSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  const tiers = section.tiers
    .map(
      (tier, idx) => {
        const highlighted = tier.highlighted;
        const features = tier.features
          .map(
            (f) => `                  <li className="flex items-start gap-3 text-sm">
                    ${checkmarkCircle(p)}
                    <span className="${highlighted ? "text-gray-300" : t.textBody}">${esc(f)}</span>
                  </li>`,
          )
          .join("\n");

        const priceBlock = `                <span className="text-3xl font-extrabold">${esc(tier.price)}</span>
${tier.period ? `                <span className="text-sm ${highlighted ? "text-white/60" : t.textMuted}"> / ${esc(tier.period)}</span>` : ""}
${highlighted && tier.period ? `                <span className="ml-2 inline-flex items-center text-xs font-bold text-${p}-600 bg-white/90 px-2 py-0.5 rounded-full">Save 20%</span>` : ""}`;

        const cardInner = `              <div className="${highlighted ? `bg-gradient-to-b from-${p}-600 to-${p}-700 text-white shadow-2xl shadow-${p}-500/25` : `${t.bgCard} border ${t.borderLight} hover:-translate-y-1 hover:shadow-xl transition-all duration-300`} rounded-2xl p-8 flex flex-col relative h-full">
${highlighted ? `                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-${p}-500 to-${s}-500 text-white text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-lg">${sparkleIcon()} Popular ${sparkleIcon()}</div>` : ""}
                <h3 className="text-lg font-bold ${highlighted ? "text-white" : t.textHeading}">${esc(tier.name)}</h3>
                <p className="text-sm ${highlighted ? "text-white/70" : t.textMuted} mt-1">${esc(tier.description)}</p>
                <div className="mt-4 flex items-baseline flex-wrap gap-1">
${priceBlock}
                </div>
                <ul className="mt-6 space-y-3 flex-1">
${features}
                </ul>
                <button className="mt-6 w-full py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${highlighted ? "bg-white text-gray-900 hover:bg-gray-100 hover:shadow-lg" : `text-white ${t.gradientPrimary} hover:shadow-lg hover:shadow-${p}-500/25`}">${esc(tier.ctaText)}</button>
              </div>`;

        if (highlighted) {
          return `            <div
              ref={ref}
              style={{ transitionDelay: \`\${${idx} * 150}ms\` }}
              className={\`transform transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
            >
              <div className="bg-gradient-to-r from-${p}-500 via-${s}-500 to-${p}-500 p-[2px] rounded-2xl animate-gradient bg-[length:200%_200%]">
${cardInner}
              </div>
            </div>`;
        }

        return `            <div
              ref={ref}
              style={{ transitionDelay: \`\${${idx} * 150}ms\` }}
              className={\`transform transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
            >
${cardInner}
            </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useState } from "react";
import { useInView } from "react-intersection-observer";

export default function Pricing() {
  const [annual, setAnnual] = useState(false);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSectionAlt}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-8">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={\`text-sm font-semibold transition-colors duration-200 \${!annual ? "${t.textHeading}" : "${t.textMuted}"}\`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className={\`relative w-16 h-8 rounded-full transition-all duration-300 shadow-inner \${annual ? "bg-gradient-to-r from-${p}-500 to-${p}-600" : "${isDark ? "bg-gray-700" : "bg-gray-300"}"}\`}
            aria-label="Toggle billing period"
          >
            <span className={\`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 \${annual ? "translate-x-8" : ""}\`} />
          </button>
          <span className={\`text-sm font-semibold transition-colors duration-200 flex items-center \${annual ? "${t.textHeading}" : "${t.textMuted}"}\`}>
            Annual
            <span className="ml-2 text-xs font-semibold text-${p}-600 bg-${p}-100 px-2 py-0.5 rounded-full">Save 20%</span>
          </span>
        </div>
        <div className="grid md:grid-cols-${Math.min(section.tiers.length, 3)} gap-8 items-stretch">
${tiers}
        </div>
      </div>
    </section>
  );
}
`;
}

// ── Comparison table variant ─────────────────────────────────────

function renderComparison(section: PricingSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  // Collect all unique features across tiers
  const allFeatures = Array.from(new Set(section.tiers.flatMap((tier) => tier.features)));

  const headerCells = section.tiers
    .map(
      (tier) => {
        if (tier.highlighted) {
          return `              <th className="px-6 py-6 text-center bg-gradient-to-b from-${p}-600 to-${p}-700 text-white ${section.tiers.indexOf(tier) === section.tiers.length - 1 ? "rounded-tr-2xl" : ""}">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full mb-3">${sparkleIcon()} Popular</div>
                <h3 className="font-bold text-lg text-white">${esc(tier.name)}</h3>
                <p className="text-3xl font-extrabold mt-2 text-white">${esc(tier.price)}</p>
${tier.period ? `                <p className="text-sm text-white/60 mt-1">/ ${esc(tier.period)}</p>` : ""}
              </th>`;
        }
        return `              <th className="px-6 py-6 text-center ${isDark ? "bg-gray-800" : "bg-gray-50"}">
                <h3 className="font-bold text-lg ${t.textHeading}">${esc(tier.name)}</h3>
                <p className="text-3xl font-extrabold mt-2 ${t.textHeading}">${esc(tier.price)}</p>
${tier.period ? `                <p className="text-sm ${t.textMuted} mt-1">/ ${esc(tier.period)}</p>` : ""}
              </th>`;
      },
    )
    .join("\n");

  const rows = allFeatures
    .map(
      (feature, rowIdx) => {
        const isEven = rowIdx % 2 === 0;
        const rowBg = isEven ? (isDark ? "bg-gray-900/50" : "bg-gray-50/50") : "";
        const hoverBg = isDark ? "hover:bg-gray-800" : `hover:bg-${p}-50`;

        const cells = section.tiers
          .map(
            (tier) => {
              const has = tier.features.includes(feature);
              const highlightBg = tier.highlighted ? (isDark ? `bg-${p}-900/20` : `bg-${p}-50/50`) : "";
              return `              <td className="px-6 py-4 text-center ${highlightBg}">
                ${has ? checkmarkCircle(p) + "" : `<span className="${isDark ? "text-gray-600" : "text-gray-300"}">&mdash;</span>`}
              </td>`;
            },
          )
          .join("\n");

        // Center the checkmark circles in td
        const cellsCentered = cells.replace(
          /(<td className="[^"]*">)\s*(<div className="w-5)/g,
          '$1\n                <div className="flex justify-center">$2',
        ).replace(
          /(flex-shrink-0">.*?<\/svg><\/div>)(\s*<\/td>)/g,
          '$1</div>$2',
        );

        return `            <tr className="${rowBg} ${hoverBg} transition-colors duration-150">
              <td className="px-6 py-4 text-sm font-medium ${t.textBody}">${esc(feature)}</td>
${cellsCentered}
            </tr>`;
      },
    )
    .join("\n");

  // CTA row at bottom
  const ctaCells = section.tiers
    .map(
      (tier) => {
        const highlighted = tier.highlighted;
        return `              <td className="px-6 py-6 text-center ${highlighted ? (isDark ? `bg-${p}-900/20` : `bg-${p}-50/50`) : ""}">
                <button className="w-full py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${highlighted ? `text-white ${t.gradientPrimary} hover:shadow-lg hover:shadow-${p}-500/25` : `border-2 border-${p}-600 text-${p}-600 hover:bg-${p}-600 hover:text-white`}">${esc(tier.ctaText)}</button>
              </td>`;
      },
    )
    .join("\n");

  return `export default function Pricing() {
  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div className="overflow-x-auto rounded-2xl shadow-lg border ${t.borderLight}">
          <table className="w-full ${isDark ? "bg-gray-900" : "bg-white"}">
            <thead>
              <tr className="border-b ${t.borderLight}">
                <th className="px-6 py-6 text-left ${t.textMuted} text-sm font-semibold uppercase tracking-wider ${isDark ? "bg-gray-800" : "bg-gray-50"} rounded-tl-2xl">Features</th>
${headerCells}
              </tr>
            </thead>
            <tbody className="divide-y ${isDark ? "divide-gray-800" : "divide-gray-100"}">
${rows}
            </tbody>
            <tfoot>
              <tr className="border-t-2 ${t.borderLight}">
                <td className="px-6 py-6"></td>
${ctaCells}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}
`;
}
