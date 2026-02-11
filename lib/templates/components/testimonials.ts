import type { WebsiteConfig, TestimonialsSection } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc } from "../utils/helpers";

export function renderTestimonials(section: TestimonialsSection, config: WebsiteConfig): string {
  switch (section.variant) {
    case "cards":           return renderCards(section, config);
    case "single-spotlight": return renderSpotlight(section, config);
    case "slider":          return renderSlider(section, config);
    case "minimal":         return renderMinimal(section, config);
  }
}

// ── Star SVG helper ───────────────────────────────────────────────

function renderStars(rating: number | undefined, centered = false): string {
  if (!rating) return "";
  const stars = Array.from({ length: 5 }, (_, i) => {
    if (i < rating) {
      return `<svg key={${i}} className="w-4 h-4 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" /></svg>`;
    }
    return `<svg key={${i}} className="w-4 h-4 text-gray-300 fill-gray-300" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" /></svg>`;
  }).join("\n                ");
  const justifyClass = centered ? "justify-center" : "";
  return `              <div className="flex gap-0.5 mb-3 ${justifyClass}">\n                ${stars}\n              </div>`;
}

// ── Section header helper ─────────────────────────────────────────

function renderSectionHeader(section: TestimonialsSection, t: ReturnType<typeof resolveTheme>, center = true): string {
  if (!section.title) return "";
  const alignment = center ? "text-center max-w-3xl mx-auto" : "max-w-3xl";
  let header = `        <div className="${alignment} mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n`;
  if (section.subtitle) {
    header += `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n`;
  }
  header += `        </div>\n`;
  return header;
}

// ── "cards" variant ───────────────────────────────────────────────
// Scroll-reveal with staggered fade-in, decorative quote icon,
// gradient accent bar, avatar with gradient ring

function renderCards(section: TestimonialsSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  const items = section.items
    .map(
      (item, i) => `          <div
            ref={ref}
            style={{ transitionDelay: "${i * 150}ms" }}
            className={\`relative overflow-hidden p-6 ${t.bgCard} rounded-2xl border ${t.borderLight} hover:shadow-xl transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
          >
            <span className="absolute top-4 right-6 text-6xl font-serif ${isDark ? "text-gray-800" : "text-gray-100"} leading-none select-none pointer-events-none">&ldquo;</span>
${renderStars(item.rating)}
            <p className="${t.textBody} italic leading-relaxed relative z-10">&ldquo;${esc(item.quote)}&rdquo;</p>
            <div className="mt-6 flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-full bg-${p}-100 flex items-center justify-center text-${p}-600 font-bold text-sm ring-2 ring-${p}-500/30">${esc(item.name.charAt(0))}</div>
              <div>
                <p className="font-semibold ${t.textHeading} text-sm">${esc(item.name)}</p>
                <p className="text-xs ${t.textMuted}">${esc(item.role)}</p>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-${p}-500 to-${s}-500" />
          </div>`,
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";

export default function Testimonials() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSectionAlt}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${renderSectionHeader(section, t)}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
${items}
        </div>
      </div>
    </section>
  );
}
`;
}

// ── "single-spotlight" variant ────────────────────────────────────
// Large gradient quote icon, prominent quote text, decorative
// flanking lines around author, stars below quote

function renderSpotlight(section: TestimonialsSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const item = section.items[0];
  if (!item) return renderCards(section, config);

  return `import { Quote } from "lucide-react";

export default function Testimonials() {
  return (
    <section className="py-24 ${t.bgSection}">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
${section.title ? `        <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading} mb-16">${esc(section.title)}</h2>\n` : ""}
        <div className="bg-gradient-to-br from-${p}-500 to-${s}-500 text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg">
          <Quote className="w-8 h-8" />
        </div>

        <blockquote className="text-2xl sm:text-3xl lg:text-4xl ${t.textHeading} font-medium leading-relaxed italic">
          &ldquo;${esc(item.quote)}&rdquo;
        </blockquote>

${renderStars(item.rating, true) ? `        <div className="mt-6">\n${renderStars(item.rating, true)}\n        </div>\n` : ""}
        <div className="mt-8 flex items-center justify-center gap-4">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-${p}-300" />
          <div>
            <p className="font-semibold ${t.textHeading} text-lg">${esc(item.name)}</p>
            <p className="text-sm ${t.textMuted}">${esc(item.role)}</p>
          </div>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-${p}-300" />
        </div>
      </div>
    </section>
  );
}
`;
}

// ── "slider" variant ──────────────────────────────────────────────
// Auto-advance with 5s interval, left/right arrows, animated dot
// indicators with active-wider style, smooth transitions,
// progress bar that fills over 5 seconds

function renderSlider(section: TestimonialsSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";
  const len = section.items.length;

  const items = section.items
    .map(
      (item, i) => `          {current === ${i} && (
            <div className="text-center animate-fade-in">
${renderStars(item.rating, true)}
              <p className="text-lg sm:text-xl lg:text-2xl ${t.textHeading} italic leading-relaxed max-w-3xl mx-auto">&ldquo;${esc(item.quote)}&rdquo;</p>
              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full bg-${p}-100 flex items-center justify-center text-${p}-600 font-bold text-sm">${esc(item.name.charAt(0))}</div>
                <div className="text-left">
                  <p className="font-semibold ${t.textHeading}">${esc(item.name)}</p>
                  <p className="text-sm ${t.textMuted}">${esc(item.role)}</p>
                </div>
              </div>
            </div>
          )}`,
    )
    .join("\n");

  const dots = section.items
    .map(
      (_, i) =>
        `            <button key={${i}} onClick={() => { setCurrent(${i}); setProgress(0); }} className={\`h-2.5 rounded-full transition-all duration-300 \${current === ${i} ? "bg-${p}-600 w-8" : "${isDark ? "bg-gray-600" : "bg-gray-300"} w-2.5 hover:bg-${p}-400"}\`} aria-label={\`Go to testimonial ${i + 1}\`} />`,
    )
    .join("\n");

  return `"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Testimonials() {
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const total = ${len};

  const goNext = useCallback(() => {
    setCurrent((c) => (c + 1) % total);
    setProgress(0);
  }, [total]);

  const goPrev = useCallback(() => {
    setCurrent((c) => (c - 1 + total) % total);
    setProgress(0);
  }, [total]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % total);
      setProgress(0);
    }, 5000);
    return () => clearInterval(timer);
  }, [total]);

  useEffect(() => {
    const tick = setInterval(() => {
      setProgress((p) => Math.min(p + 2, 100));
    }, 100);
    return () => clearInterval(tick);
  }, [current]);

  return (
    <section className="py-20 ${t.bgSectionAlt}">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
${renderSectionHeader(section, t)}
        <div className="relative min-h-[240px] flex items-center">
          <button
            onClick={goPrev}
            className="absolute left-0 z-10 p-2 rounded-full ${isDark ? "bg-gray-800 hover:bg-gray-700 text-gray-300" : "bg-white hover:bg-gray-50 text-gray-600"} shadow-lg transition-colors"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="w-full px-12">
${items}
          </div>

          <button
            onClick={goNext}
            className="absolute right-0 z-10 p-2 rounded-full ${isDark ? "bg-gray-800 hover:bg-gray-700 text-gray-300" : "bg-white hover:bg-gray-50 text-gray-600"} shadow-lg transition-colors"
            aria-label="Next testimonial"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-center gap-2 mt-8">
${dots}
        </div>

        <div className="mt-4 max-w-xs mx-auto h-1 ${isDark ? "bg-gray-800" : "bg-gray-200"} rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-${p}-500 to-${s}-500 rounded-full transition-all duration-100 ease-linear"
            style={{ width: \`\${progress}%\` }}
          />
        </div>
      </div>
    </section>
  );
}
`;
}

// ── "minimal" variant ─────────────────────────────────────────────
// Gradient left border, larger quote text, hover highlight,
// small quote icon before each quote

function renderMinimal(section: TestimonialsSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  const items = section.items
    .map(
      (item) => `        <div className="relative ${isDark ? `hover:bg-${p}-950` : `hover:bg-${p}-50`} rounded-xl p-6 -ml-6 transition-all group">
          <div className="absolute left-0 top-6 bottom-6 w-1 rounded-full bg-gradient-to-b from-${p}-500 to-${s}-500" />
          <div className="pl-6">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-${p}-400 opacity-60" viewBox="0 0 24 24" fill="currentColor"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151C7.546 6.068 5.983 8.789 5.983 11h4v10H0z" /></svg>
              <p className="${t.textBody} text-base sm:text-lg italic leading-relaxed">&ldquo;${esc(item.quote)}&rdquo;</p>
            </div>
            <p className="mt-4 text-sm font-semibold ${t.textHeading}">${esc(item.name)} <span className="${t.textMuted} font-normal">&mdash; ${esc(item.role)}</span></p>
          </div>
        </div>`,
    )
    .join("\n");

  return `export default function Testimonials() {
  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
${renderSectionHeader(section, t, false)}
        <div className="space-y-4">
${items}
        </div>
      </div>
    </section>
  );
}
`;
}
