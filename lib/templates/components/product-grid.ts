import type { WebsiteConfig, ProductGridSection } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc, escAttr, imgTag } from "../utils/helpers";

export function renderProductGrid(section: ProductGridSection, config: WebsiteConfig): string {
  switch (section.variant) {
    case "grid":     return renderGrid(section, config);
    case "list":     return renderList(section, config);
    case "carousel": return renderCarousel(section, config);
    case "featured": return renderFeatured(section, config);
  }
}

// ── Helper: compute discount percentage ──────────────────────────

function discountBadge(price: string, originalPrice: string | undefined, p: string): string {
  if (!originalPrice) return "";
  const orig = parseFloat(originalPrice.replace(/[^0-9.]/g, ""));
  const curr = parseFloat(price.replace(/[^0-9.]/g, ""));
  if (!orig || !curr || orig <= curr) return "";
  const pct = Math.round(((orig - curr) / orig) * 100);
  return `              <span className="ml-2 text-xs font-semibold text-${p}-600 bg-${p}-100 px-2 py-0.5 rounded-full">-${pct}%</span>`;
}

// ── "grid" variant ───────────────────────────────────────────────
// Staggered scroll-reveal, image hover zoom, gradient badge,
// quick-view Eye overlay, gradient Add to Cart button with hover lift

function renderGrid(section: ProductGridSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const isDark = config.theme.background === "dark";

  const items = section.items
    .map(
      (item, i) => {
        const image = imgTag(item.imageDescription, "w-full h-56 object-cover group-hover:scale-110 transition-transform duration-500");
        const discount = discountBadge(item.price, item.originalPrice, p);
        return `          <div
            ref={ref}
            style={{ transitionDelay: "${i * 120}ms" }}
            className={\`group ${t.bgCard} rounded-2xl border ${t.borderLight} overflow-hidden hover:shadow-xl transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
          >
            <div className="relative overflow-hidden">
              ${image}
${item.badge ? `              <span className="absolute top-3 left-3 px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r from-${p}-500 to-${p}-600 rounded-full shadow-md">${esc(item.badge)}</span>` : ""}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Eye className="w-8 h-8 text-white drop-shadow-lg" />
              </div>
            </div>
            <div className="p-5">
              <h3 className="font-semibold ${t.textHeading} group-hover:text-${p}-600 transition-colors">${esc(item.name)}</h3>
              <p className="text-sm ${t.textBody} mt-1 line-clamp-2">${esc(item.description)}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-lg font-bold ${t.textHeading}">${esc(item.price)}</span>
${item.originalPrice ? `                <span className="text-sm ${t.textMuted} line-through">${esc(item.originalPrice)}</span>\n${discount}` : ""}
              </div>
              <button className="mt-4 w-full py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-${p}-600 to-${p}-700 hover:shadow-lg hover:-translate-y-0.5 rounded-xl transition-all duration-300">Add to Cart</button>
            </div>
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";
import { Eye } from "lucide-react";

export default function ProductGrid() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div className="grid sm:grid-cols-2 lg:grid-cols-${Math.min(section.items.length, 4)} gap-6">
${items}
        </div>
      </div>
    </section>
  );
}
`;
}

// ── "list" variant ───────────────────────────────────────────────
// Scroll-reveal, hover highlight, image with rounded corners and
// hover zoom, Add to Cart button with ShoppingCart icon

function renderList(section: ProductGridSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const isDark = config.theme.background === "dark";

  const items = section.items
    .map(
      (item, i) => {
        const image = imgTag(item.imageDescription, "w-40 h-40 object-cover group-hover:scale-110 transition-transform duration-500");
        const discount = discountBadge(item.price, item.originalPrice, p);
        return `          <div
            ref={ref}
            style={{ transitionDelay: "${i * 100}ms" }}
            className={\`group flex gap-6 p-4 ${t.bgCard} rounded-2xl border ${t.borderLight} ${isDark ? `hover:bg-gray-800/60` : `hover:bg-${p}-50/50`} hover:shadow-lg hover:border-${p}-200 transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
          >
            <div className="relative overflow-hidden rounded-xl flex-shrink-0">
              ${image}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold ${t.textHeading} group-hover:text-${p}-600 transition-colors">${esc(item.name)}</h3>
              <p className="text-sm ${t.textBody} mt-2 line-clamp-2">${esc(item.description)}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xl font-bold ${t.textHeading}">${esc(item.price)}</span>
${item.originalPrice ? `                <span className="text-sm ${t.textMuted} line-through">${esc(item.originalPrice)}</span>\n${discount}` : ""}
${item.badge ? `                <span className="px-2 py-0.5 text-xs font-semibold text-white bg-gradient-to-r from-${p}-500 to-${p}-600 rounded-full">${esc(item.badge)}</span>` : ""}
              </div>
              <button className="mt-4 inline-flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-gradient-to-r from-${p}-600 to-${p}-700 hover:shadow-lg hover:-translate-y-0.5 rounded-xl transition-all duration-300">
                <ShoppingCart className="w-4 h-4" />
                Add to Cart
              </button>
            </div>
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";
import { ShoppingCart } from "lucide-react";

export default function ProductGrid() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="mb-12">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div className="space-y-6">
${items}
        </div>
      </div>
    </section>
  );
}
`;
}

// ── "carousel" variant ───────────────────────────────────────────
// Left/right scroll buttons using useRef, gradient bg on scroll
// buttons, better card design with hover lift

function renderCarousel(section: ProductGridSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const isDark = config.theme.background === "dark";

  const items = section.items
    .map(
      (item) => {
        const image = imgTag(item.imageDescription, "w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500");
        return `          <div className="flex-shrink-0 w-72 snap-center group">
            <div className="${t.bgCard} rounded-2xl border ${t.borderLight} overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="relative overflow-hidden">
                ${image}
${item.badge ? `                <span className="absolute top-3 left-3 px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r from-${p}-500 to-${p}-600 rounded-full shadow-md">${esc(item.badge)}</span>` : ""}
              </div>
              <div className="p-4">
                <h3 className="font-semibold ${t.textHeading} group-hover:text-${p}-600 transition-colors">${esc(item.name)}</h3>
                <p className="text-sm ${t.textBody} mt-1 line-clamp-2">${esc(item.description)}</p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold ${t.textHeading}">${esc(item.price)}</span>
${item.originalPrice ? `                    <span className="text-xs ${t.textMuted} line-through">${esc(item.originalPrice)}</span>` : ""}
                  </div>
                  <button className="px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-${p}-600 to-${p}-700 hover:shadow-md rounded-lg transition-all">Add</button>
                </div>
              </div>
            </div>
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useRef } from "react";
import { useInView } from "react-intersection-observer";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function ProductGrid() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 300;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="flex items-end justify-between mb-12">\n          <div>\n            <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `            <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}          </div>\n          <div className="hidden sm:flex gap-2">\n            <button\n              onClick={() => scroll("left")}\n              className="p-2.5 rounded-full bg-gradient-to-r from-${p}-600 to-${p}-700 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"\n              aria-label="Scroll left"\n            >\n              <ChevronLeft className="w-5 h-5" />\n            </button>\n            <button\n              onClick={() => scroll("right")}\n              className="p-2.5 rounded-full bg-gradient-to-r from-${p}-600 to-${p}-700 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"\n              aria-label="Scroll right"\n            >\n              <ChevronRight className="w-5 h-5" />\n            </button>\n          </div>\n        </div>\n` : ""}
        <div className="relative">
          <div
            ref={(el) => { (scrollRef as any).current = el; ref(el); }}
            className={\`flex gap-6 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}\`}
          >
${items}
          </div>

          <button
            onClick={() => scroll("left")}
            className="sm:hidden absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-gradient-to-r from-${p}-600 to-${p}-700 text-white shadow-lg hover:shadow-xl transition-all"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="sm:hidden absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-gradient-to-r from-${p}-600 to-${p}-700 text-white shadow-lg hover:shadow-xl transition-all"
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

// ── "featured" variant ───────────────────────────────────────────
// Large featured product with gradient "Featured" badge and star
// rating placeholder, staggered entrance animation, hover effects

function renderFeatured(section: ProductGridSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  const first = section.items[0];
  const rest = section.items.slice(1);

  const firstImage = first ? imgTag(first.imageDescription, "w-full h-80 object-cover group-hover:scale-105 transition-transform duration-500") : "";

  // Star rating placeholder for featured item
  const starRating = `              <div className="flex gap-0.5 mt-2">
                <svg className="w-5 h-5 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" /></svg>
                <svg className="w-5 h-5 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" /></svg>
                <svg className="w-5 h-5 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" /></svg>
                <svg className="w-5 h-5 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" /></svg>
                <svg className="w-5 h-5 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" /></svg>
              </div>`;

  const restItems = rest
    .map(
      (item, i) => {
        const image = imgTag(item.imageDescription, "w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500");
        return `          <div
            ref={ref}
            style={{ transitionDelay: "${(i + 1) * 150}ms" }}
            className={\`group ${t.bgCard} rounded-2xl border ${t.borderLight} overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
          >
            <div className="relative overflow-hidden">
              ${image}
${item.badge ? `              <span className="absolute top-3 left-3 px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r from-${p}-500 to-${p}-600 rounded-full shadow-md">${esc(item.badge)}</span>` : ""}
            </div>
            <div className="p-4">
              <h3 className="font-semibold ${t.textHeading} group-hover:text-${p}-600 transition-colors">${esc(item.name)}</h3>
              <p className="text-sm ${t.textBody} mt-1 line-clamp-1">${esc(item.description)}</p>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold ${t.textHeading}">${esc(item.price)}</span>
${item.originalPrice ? `                  <span className="text-xs ${t.textMuted} line-through">${esc(item.originalPrice)}</span>` : ""}
                </div>
                <button className="px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-${p}-600 to-${p}-700 rounded-lg hover:shadow-md hover:-translate-y-0.5 transition-all">Add</button>
              </div>
            </div>
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";

export default function ProductGrid() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div className="grid lg:grid-cols-2 gap-8">
${first ? `          <div
            ref={ref}
            className={\`group ${t.bgCard} rounded-2xl border ${t.borderLight} overflow-hidden hover:shadow-2xl transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
          >
            <div className="relative overflow-hidden">
              ${firstImage}
              <span className="absolute top-4 left-4 px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-${p}-500 via-${s}-500 to-${p}-600 rounded-full shadow-lg uppercase tracking-wider">Featured</span>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold ${t.textHeading} group-hover:text-${p}-600 transition-colors">${esc(first.name)}</h3>
              <p className="${t.textBody} mt-2">${esc(first.description)}</p>
${starRating}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold ${t.textHeading}">${esc(first.price)}</span>
${first.originalPrice ? `                  <span className="text-sm ${t.textMuted} line-through">${esc(first.originalPrice)}</span>` : ""}
                </div>
                <button className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-${p}-600 to-${p}-700 hover:shadow-lg hover:-translate-y-0.5 rounded-xl transition-all duration-300">Add to Cart</button>
              </div>
            </div>
          </div>` : ""}
          <div className="grid sm:grid-cols-2 gap-4">
${restItems}
          </div>
        </div>
      </div>
    </section>
  );
}
`;
}
