import type { WebsiteConfig, CtaBannerSection } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc, escAttr, imgTag, isInternalHref } from "../utils/helpers";

export function renderCtaBanner(section: CtaBannerSection, config: WebsiteConfig): string {
  switch (section.variant) {
    case "gradient":   return renderGradient(section, config);
    case "solid":      return renderSolid(section, config);
    case "with-image": return renderWithImage(section, config);
  }
}

// ── Gradient ─────────────────────────────────────────────────────

function renderGradient(section: CtaBannerSection, config: WebsiteConfig): string {
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const internal = isInternalHref(section.ctaHref);
  const tag = internal ? "Link" : "a";
  const linkImport = internal ? `import Link from "next/link";\n` : "";

  return `${linkImport}import { ArrowRight } from "lucide-react";

export default function CtaBanner() {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden bg-gradient-to-r from-${p}-600 via-${s}-600 to-${p}-600 animate-gradient bg-[length:200%_auto] rounded-3xl px-8 py-16 sm:px-16 text-center">
          {/* Decorative floating shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2" />

          {/* Content */}
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
              ${esc(section.headline)}
            </h2>
            <p className="mt-4 text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
              ${esc(section.description)}
            </p>
            <${tag} href="${escAttr(section.ctaHref)}" className="mt-8 inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-${p}-700 bg-white hover:bg-gray-50 rounded-xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all">
              ${esc(section.ctaText)}
              <ArrowRight className="w-4 h-4" />
            </${tag}>
          </div>
        </div>
      </div>
    </section>
  );
}
`;
}

// ── Solid ────────────────────────────────────────────────────────

function renderSolid(section: CtaBannerSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const internal = isInternalHref(section.ctaHref);
  const tag = internal ? "Link" : "a";
  const linkImport = internal ? `import Link from "next/link";\n` : "";

  return `${linkImport}import { ArrowRight } from "lucide-react";

export default function CtaBanner() {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden bg-${p}-600 rounded-3xl px-8 py-16 sm:px-16 text-center">
          {/* Pattern overlay */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

          {/* Content */}
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
              ${esc(section.headline)}
            </h2>
            <p className="mt-4 text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
              ${esc(section.description)}
            </p>
            <${tag} href="${escAttr(section.ctaHref)}" className="mt-8 inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-${p}-600 bg-white hover:bg-gray-50 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
              ${esc(section.ctaText)}
              <ArrowRight className="w-4 h-4" />
            </${tag}>
          </div>
        </div>
      </div>
    </section>
  );
}
`;
}

// ── With Image ───────────────────────────────────────────────────

function renderWithImage(section: CtaBannerSection, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const p = config.theme.primary;
  const s = config.theme.secondary;
  const isDark = config.theme.background === "dark";
  const image = section.imageDescription
    ? imgTag(section.imageDescription, "w-full h-full object-cover")
    : "";
  const internal = isInternalHref(section.ctaHref);
  const tag = internal ? "Link" : "a";
  const linkImport = internal ? `import Link from "next/link";\n` : "";

  return `"use client";

${linkImport}import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

export default function CtaBanner() {
  const { ref, inView } = useInView(0.15);

  return (
    <section className="py-20 ${t.bgSection}">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={ref} className="grid md:grid-cols-2 gap-12 items-center">
          {/* Text side */}
          <div className={\`opacity-0 \${inView ? "animate-slide-right" : ""}\`}>
            <div className="w-16 h-1 bg-gradient-to-r from-${p}-500 to-${s}-500 rounded-full mb-6" />
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold ${t.textHeading} leading-tight">
              ${esc(section.headline)}
            </h2>
            <p className="mt-4 text-lg ${t.textBody} leading-relaxed">
              ${esc(section.description)}
            </p>
            <${tag} href="${escAttr(section.ctaHref)}" className="mt-8 inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-white bg-${p}-600 hover:bg-${p}-700 rounded-xl shadow-lg shadow-${p}-500/25 hover:shadow-xl hover:shadow-${p}-500/30 hover:-translate-y-0.5 transition-all">
              ${esc(section.ctaText)}
              <ArrowRight className="w-4 h-4" />
            </${tag}>
          </div>

          {/* Image side */}
${image ? `          <div className={\`relative opacity-0 \${inView ? "animate-slide-left" : ""}\`}>
            <div className="relative rounded-2xl shadow-2xl ring-1 ring-white/10 overflow-hidden">
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-tr from-${p}-600/20 to-transparent z-10 pointer-events-none" />
              <div className="h-80 md:h-96">
                ${image}
              </div>
            </div>
            {/* Decorative accent behind image */}
            <div className="absolute -bottom-4 -right-4 w-full h-full rounded-2xl bg-gradient-to-br from-${p}-200 to-${s}-200 ${isDark ? "opacity-10" : "opacity-30"} -z-10" />
          </div>` : ""}
        </div>
      </div>
    </section>
  );
}
`;
}
