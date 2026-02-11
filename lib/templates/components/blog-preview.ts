import type { WebsiteConfig, BlogPreviewSection } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc, imgTag } from "../utils/helpers";

export function renderBlogPreview(section: BlogPreviewSection, config: WebsiteConfig): string {
  switch (section.variant) {
    case "cards":        return renderCards(section, config);
    case "list":         return renderList(section, config);
    case "featured-hero": return renderFeaturedHero(section, config);
  }
}

function renderCards(section: BlogPreviewSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  const posts = section.posts
    .map(
      (post, i) => {
        const image = imgTag(post.imageDescription, "w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105");
        return `          <div
            ref={ref}
            style={{ transitionDelay: "${i * 120}ms" }}
            className={\`group ${t.bgCard} rounded-2xl border ${t.borderLight} overflow-hidden hover:shadow-xl transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
          >
            <div className="relative overflow-hidden">
              ${image}
${post.category ? `              <span className="absolute top-3 left-3 px-3 py-1 text-xs font-bold text-white bg-gradient-to-r from-${p}-600 to-${s}-600 rounded-full shadow-lg">${esc(post.category)}</span>` : ""}
            </div>
            <div className="p-5">
              <div className="flex items-center gap-3 text-xs ${t.textMuted} mb-3">
                <span>${esc(post.date)}</span>
                <span className="w-1 h-1 rounded-full ${isDark ? "bg-gray-600" : "bg-gray-300"}" />
                <span>5 min read</span>
              </div>
              <h3 className="text-lg font-bold ${t.textHeading} group-hover:text-${p}-600 transition-colors line-clamp-2">${esc(post.title)}</h3>
              <p className="mt-2 text-sm ${t.textBody} line-clamp-3">${esc(post.excerpt)}</p>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-${p}-500 to-${s}-500 flex items-center justify-center text-white text-xs font-bold">${esc(post.author.charAt(0))}</div>
                  <span className="text-xs font-medium ${t.textHeading}">${esc(post.author)}</span>
                </div>
                <span className="flex items-center gap-1 text-xs font-semibold text-${p}-600 group-hover:gap-2 transition-all">
                  Read more
                  <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </span>
              </div>
            </div>
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";

export default function BlogPreview() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="text-center max-w-3xl mx-auto mb-16">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
${posts}
        </div>
      </div>
    </section>
  );
}
`;
}

function renderList(section: BlogPreviewSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  const posts = section.posts
    .map(
      (post, i) => {
        const image = imgTag(post.imageDescription, "w-32 h-32 sm:w-40 sm:h-40 object-cover rounded-xl flex-shrink-0");
        return `          <div
            ref={ref}
            style={{ transitionDelay: "${i * 100}ms" }}
            className={\`group flex gap-6 p-4 ${t.bgCard} rounded-2xl border ${t.borderLight} ${isDark ? `hover:bg-${p}-950` : `hover:bg-${p}-50/50`} hover:shadow-lg transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
          >
            ${image}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
${post.category ? `                <span className="text-xs font-bold text-white bg-gradient-to-r from-${p}-600 to-${s}-600 px-2.5 py-0.5 rounded-full">${esc(post.category)}</span>` : ""}
                <span className="text-xs ${t.textMuted}">5 min read</span>
              </div>
              <h3 className="mt-2 text-lg font-bold ${t.textHeading} group-hover:text-${p}-600 transition-colors line-clamp-2">${esc(post.title)}</h3>
              <p className="mt-2 text-sm ${t.textBody} line-clamp-2">${esc(post.excerpt)}</p>
              <div className="mt-3 flex items-center gap-3 text-xs ${t.textMuted}">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-${p}-500 to-${s}-500 flex items-center justify-center text-white text-[10px] font-bold">${esc(post.author.charAt(0))}</div>
                  <span className="font-medium">${esc(post.author)}</span>
                </div>
                <span className="w-1 h-1 rounded-full ${isDark ? "bg-gray-600" : "bg-gray-300"}" />
                <time>${esc(post.date)}</time>
              </div>
            </div>
          </div>`;
      },
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";

export default function BlogPreview() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSectionAlt}">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="mb-12">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div className="space-y-6">
${posts}
        </div>
      </div>
    </section>
  );
}
`;
}

function renderFeaturedHero(section: BlogPreviewSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";

  const first = section.posts[0];
  const rest = section.posts.slice(1);

  const firstImage = first ? imgTag(first.imageDescription, "w-full h-80 object-cover transition-transform duration-500 group-hover:scale-105") : "";

  const restPosts = rest
    .map(
      (post, i) => `          <div
            ref={ref}
            style={{ transitionDelay: "${(i + 1) * 100}ms" }}
            className={\`group flex gap-4 p-4 rounded-xl ${isDark ? `hover:bg-${p}-950` : `hover:bg-${p}-50`} transition-all duration-700 \${inView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"}\`}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-${p}-500 to-${s}-500 flex items-center justify-center text-white text-sm font-bold mt-1">
              ${i + 2}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
${post.category ? `                <span className="text-xs font-bold text-${p}-600">${esc(post.category)}</span>\n                <span className="w-1 h-1 rounded-full ${isDark ? "bg-gray-600" : "bg-gray-300"}" />` : ""}
                <span className="text-xs ${t.textMuted}">5 min read</span>
              </div>
              <h3 className="text-sm font-bold ${t.textHeading} group-hover:text-${p}-600 transition-colors line-clamp-2 mt-1">${esc(post.title)}</h3>
              <div className="flex items-center gap-2 mt-2 text-xs ${t.textMuted}">
                <span className="font-medium">${esc(post.author)}</span>
                <span>&bull;</span>
                <time>${esc(post.date)}</time>
              </div>
            </div>
          </div>`,
    )
    .join("\n");

  return `"use client";

import { useInView } from "react-intersection-observer";

export default function BlogPreview() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
${section.title ? `        <div className="mb-12">\n          <h2 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(section.title)}</h2>\n${section.subtitle ? `          <p className="mt-4 text-lg ${t.textBody}">${esc(section.subtitle)}</p>\n` : ""}        </div>\n` : ""}
        <div className="grid lg:grid-cols-2 gap-8">
${first ? `          <div
            ref={ref}
            className={\`group ${t.bgCard} rounded-2xl border ${t.borderLight} overflow-hidden hover:shadow-2xl transition-all duration-700 \${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}\`}
          >
            <div className="relative overflow-hidden">
              ${firstImage}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
${first.category ? `                <span className="px-3 py-1 text-xs font-bold text-white bg-gradient-to-r from-${p}-600 to-${s}-600 rounded-full shadow-lg">${esc(first.category)}</span>` : ""}
                <h3 className="mt-3 text-xl sm:text-2xl font-bold text-white leading-tight">${esc(first.title)}</h3>
              </div>
            </div>
            <div className="p-6">
              <p className="${t.textBody} line-clamp-3">${esc(first.excerpt)}</p>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm ${t.textMuted}">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-${p}-500 to-${s}-500 flex items-center justify-center text-white text-[10px] font-bold">${esc(first.author.charAt(0))}</div>
                  <span className="font-medium">${esc(first.author)}</span>
                  <span>&bull;</span>
                  <time>${esc(first.date)}</time>
                </div>
                <span className="text-xs font-medium ${t.textMuted}">5 min read</span>
              </div>
            </div>
          </div>` : ""}
          <div className="space-y-2">
${restPosts}
          </div>
        </div>
      </div>
    </section>
  );
}
`;
}
