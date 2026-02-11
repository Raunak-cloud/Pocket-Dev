import type { WebsiteConfig, GallerySection } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc, imgTag } from "../utils/helpers";

export function renderGallery(section: GallerySection, config: WebsiteConfig): string {
  switch (section.variant) {
    case "grid":    return renderGrid(section, config);
    case "masonry": return renderMasonry(section, config);
    case "carousel": return renderCarousel(section, config);
  }
}

function renderGrid(section: GallerySection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";
  const itemCount = section.items.length;

  const items = section.items
    .map(
      (item, i) => {
        const image = imgTag(item.imageDescription, "w-full h-64 object-cover group-hover:scale-110 transition-transform duration-500");
        return `          <div
            ref={ref}
            style={{ transitionDelay: "${i * 120}ms" }}
            className={\`group relative overflow-hidden rounded-2xl shadow-md hover:shadow-2xl transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
          >
            ${image}
            <div className="absolute top-3 right-3 ${isDark ? "bg-gray-900/80" : "bg-white/90"} backdrop-blur-sm text-xs font-semibold ${t.textHeading} px-2.5 py-1 rounded-full">
              ${i + 1} / ${itemCount}
            </div>
${item.caption ? `            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-5">\n              <p className="text-white text-sm font-medium">${esc(item.caption)}</p>\n            </div>` : `            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />`}
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";

export default function Gallery() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
${items}
        </div>
      </div>
    </section>
  );
}
`;
}

function renderMasonry(section: GallerySection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const isDark = config.theme.background === "dark";

  const items = section.items
    .map(
      (item, i) => {
        const tall = i % 3 === 0;
        const image = imgTag(item.imageDescription, `w-full ${tall ? "h-80" : "h-56"} object-cover transition-transform duration-500 group-hover:scale-105`);
        return `          <div
            ref={ref}
            style={{ transitionDelay: "${i * 100}ms" }}
            className={\`break-inside-avoid mb-4 group relative overflow-hidden rounded-2xl transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
          >
            ${image}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-5">
${item.caption ? `              <p className="text-white text-sm font-medium">${esc(item.caption)}</p>` : `              <div className="w-8 h-0.5 bg-white/60 rounded-full" />`}
            </div>
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";

export default function Gallery() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
${items}
        </div>
      </div>
    </section>
  );
}
`;
}

function renderCarousel(section: GallerySection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";
  const totalItems = section.items.length;

  const items = section.items
    .map(
      (item, i) => {
        const image = imgTag(item.imageDescription, "w-full h-72 object-cover transition-transform duration-500 group-hover:scale-105");
        return `          <div className="flex-shrink-0 w-80 snap-center group">
            <div className="rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300">
              <div className="relative overflow-hidden">
                ${image}
                <div className="absolute top-3 right-3 ${isDark ? "bg-gray-900/80" : "bg-white/90"} backdrop-blur-sm text-xs font-semibold ${t.textHeading} px-2.5 py-1 rounded-full">
                  ${i + 1} / ${totalItems}
                </div>
              </div>
${item.caption ? `              <div className="p-4 ${t.bgCard}">\n                <p className="text-sm ${t.textBody} font-medium">${esc(item.caption)}</p>\n              </div>` : ""}
            </div>
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useRef } from "react";
import { useInView } from "react-intersection-observer";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Gallery() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 340;
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
          className={\`flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}\`}
        >
${items}
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
