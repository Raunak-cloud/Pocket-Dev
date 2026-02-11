import type { WebsiteConfig, TeamSection } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc, imgTag } from "../utils/helpers";

export function renderTeam(section: TeamSection, config: WebsiteConfig): string {
  switch (section.variant) {
    case "grid":     return renderGrid(section, config);
    case "carousel": return renderCarousel(section, config);
    case "detailed": return renderDetailed(section, config);
  }
}

function renderGrid(section: TeamSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  const members = section.members
    .map(
      (m, i) => {
        const avatar = imgTag(m.imageDescription, "w-24 h-24 rounded-full object-cover mx-auto ring-4 ring-" + p + "-500/30");
        return `          <div
            ref={ref}
            style={{ transitionDelay: "${i * 120}ms" }}
            className={\`group text-center p-6 ${t.bgCard} rounded-2xl border ${t.borderLight} hover:-translate-y-2 hover:shadow-xl transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
          >
            <div className="relative inline-block">
              ${avatar}
              <div className="absolute inset-0 rounded-full bg-gradient-to-t from-${p}-600/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-2">
                <span className="text-white text-[10px] font-semibold tracking-wide uppercase">${esc(m.role)}</span>
              </div>
            </div>
            <h3 className="mt-4 text-lg font-semibold ${t.textHeading} group-hover:text-${p}-600 transition-colors">${esc(m.name)}</h3>
            <p className="text-sm text-${p}-600 font-medium">${esc(m.role)}</p>
${m.bio ? `            <p className="mt-2 text-sm ${t.textBody} line-clamp-3">${esc(m.bio)}</p>` : ""}
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";

export default function Team() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div className="grid sm:grid-cols-2 lg:grid-cols-${Math.min(section.members.length, 4)} gap-8">
${members}
        </div>
      </div>
    </section>
  );
}
`;
}

function renderCarousel(section: TeamSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  const members = section.members
    .map(
      (m) => {
        const avatar = imgTag(m.imageDescription, "w-20 h-20 rounded-full object-cover ring-4 ring-" + p + "-500/20");
        return `          <div className="flex-shrink-0 w-64 snap-center group">
            <div className="${t.bgCard} rounded-2xl border ${t.borderLight} p-6 text-center hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
              <div className="flex justify-center">${avatar}</div>
              <h3 className="mt-4 font-semibold ${t.textHeading} group-hover:text-${p}-600 transition-colors">${esc(m.name)}</h3>
              <p className="text-sm text-${p}-600 font-medium">${esc(m.role)}</p>
${m.bio ? `              <p className="mt-2 text-xs ${t.textBody} line-clamp-2">${esc(m.bio)}</p>` : ""}
            </div>
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useRef } from "react";
import { useInView } from "react-intersection-observer";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Team() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 280;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section className="py-20 ${t.bgSectionAlt}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="flex items-end justify-between mb-12">\n          <div>\n            <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `            <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}          </div>\n          <div className="hidden sm:flex gap-2">\n            <button\n              onClick={() => scroll("left")}\n              className="p-2.5 rounded-full ${isDark ? "bg-gray-800 hover:bg-gray-700 text-gray-300" : "bg-white hover:bg-gray-50 text-gray-600"} shadow-lg border ${t.borderLight} transition-colors"\n              aria-label="Scroll left"\n            >\n              <ChevronLeft className="w-5 h-5" />\n            </button>\n            <button\n              onClick={() => scroll("right")}\n              className="p-2.5 rounded-full ${isDark ? "bg-gray-800 hover:bg-gray-700 text-gray-300" : "bg-white hover:bg-gray-50 text-gray-600"} shadow-lg border ${t.borderLight} transition-colors"\n              aria-label="Scroll right"\n            >\n              <ChevronRight className="w-5 h-5" />\n            </button>\n          </div>\n        </div>\n` : ""}
        <div
          ref={(el) => { (scrollRef as any).current = el; ref(el); }}
          className={\`flex gap-6 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}\`}
        >
${members}
        </div>

        <div className="flex sm:hidden justify-center gap-3 mt-6">
          <button
            onClick={() => scroll("left")}
            className="p-2.5 rounded-full ${isDark ? "bg-gray-800 hover:bg-gray-700 text-gray-300" : "bg-white hover:bg-gray-50 text-gray-600"} shadow-lg border ${t.borderLight} transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="p-2.5 rounded-full ${isDark ? "bg-gray-800 hover:bg-gray-700 text-gray-300" : "bg-white hover:bg-gray-50 text-gray-600"} shadow-lg border ${t.borderLight} transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
`;
}

function renderDetailed(section: TeamSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  const members = section.members
    .map(
      (m, i) => {
        const avatar = imgTag(m.imageDescription, "w-full h-64 object-cover transition-transform duration-500 group-hover:scale-105");
        return `          <div
            ref={ref}
            style={{ transitionDelay: "${i * 150}ms" }}
            className={\`group ${t.bgCard} rounded-2xl border ${t.borderLight} overflow-hidden hover:shadow-xl transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
          >
            <div className="h-1.5 bg-gradient-to-r from-${p}-500 to-${s}-500" />
            <div className="relative overflow-hidden">
              ${avatar}
            </div>
            <div className="p-6">
              <h3 className="text-lg font-bold ${t.textHeading} group-hover:text-${p}-600 transition-colors">${esc(m.name)}</h3>
              <p className="text-sm text-${p}-600 font-medium">${esc(m.role)}</p>
${m.bio ? `              <p className="mt-3 text-sm ${t.textBody} leading-relaxed line-clamp-4">${esc(m.bio)}</p>` : ""}
              <div className="mt-4 flex gap-2">
                <div className="w-8 h-8 rounded-full ${isDark ? "bg-gray-800" : "bg-gray-100"} flex items-center justify-center ${t.textMuted} hover:text-${p}-600 transition-colors cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                </div>
                <div className="w-8 h-8 rounded-full ${isDark ? "bg-gray-800" : "bg-gray-100"} flex items-center justify-center ${t.textMuted} hover:text-${p}-600 transition-colors cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                </div>
              </div>
            </div>
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";

export default function Team() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
${members}
        </div>
      </div>
    </section>
  );
}
`;
}
