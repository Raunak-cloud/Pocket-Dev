import type { WebsiteConfig } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc, escAttr, collectSocialIcons, resolveSocialIcon, isInternalHref } from "../utils/helpers";

export function renderFooter(config: WebsiteConfig): string {
  switch (config.footer.variant) {
    case "multi-column": return renderMultiColumnFooter(config);
    case "minimal":      return renderMinimalFooter(config);
    case "simple":
    default:             return renderSimpleFooter(config);
  }
}

// ── Simple Footer ────────────────────────────────────────────────────

function renderSimpleFooter(config: WebsiteConfig): string {
  const p = config.theme.primary;
  const t = resolveTheme(config.theme);

  const socialIcons = config.footer.socialLinks
    ? collectSocialIcons(config.footer.socialLinks.map((s) => s.platform))
    : [];

  const allLucideImports = [...socialIcons, "ChevronUp"];
  const lucideImport = `import { ${[...new Set(allLucideImports)].join(", ")} } from "lucide-react";`;

  const socialLinks = config.footer.socialLinks
    ? config.footer.socialLinks
        .map(
          (s) =>
            `            <a
              href="${escAttr(s.url)}"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-${p}-400 hover:-translate-y-1 transition-all duration-300"
              aria-label="${escAttr(s.platform)}"
            >
              <${resolveSocialIcon(s.platform)} className="w-5 h-5" />
            </a>`,
        )
        .join("\n")
    : "";

  return `"use client";

${lucideImport}

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Gradient divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-${p}-500 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
${config.business.logoUrl ? `            <img src="${escAttr(config.business.logoUrl)}" alt="${escAttr(config.business.name)}" className="h-10 w-auto max-w-[180px] object-contain" />\n` : `            <div>\n              <h3 className="text-xl font-bold text-white">${esc(config.business.name)}</h3>\n              <p className="mt-1 text-sm text-gray-400">${esc(config.business.tagline)}</p>\n            </div>`}
          </div>

          {/* Social icons */}
${socialLinks ? `          <div className="flex items-center gap-4">\n${socialLinks}\n          </div>` : ""}
        </div>

        {/* Back to top + copyright */}
        <div className="mt-8 pt-8 border-t border-gray-800 flex flex-col items-center gap-4">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="group flex items-center gap-2 text-sm text-gray-500 hover:text-${p}-400 transition-colors"
          >
            <ChevronUp className="w-4 h-4 group-hover:-translate-y-1 transition-transform duration-300" />
            <span>Back to top</span>
          </button>
          <p className="text-sm text-gray-500">${esc(config.footer.copyright)}</p>
        </div>
      </div>
    </footer>
  );
}
`;
}

// ── Multi-Column Footer ──────────────────────────────────────────────

function renderMultiColumnFooter(config: WebsiteConfig): string {
  const p = config.theme.primary;
  const t = resolveTheme(config.theme);

  const socialIcons = config.footer.socialLinks
    ? collectSocialIcons(config.footer.socialLinks.map((s) => s.platform))
    : [];

  const allLucideImports = [...socialIcons, "ChevronUp", "ArrowRight"];
  const lucideImport = `import { ${[...new Set(allLucideImports)].join(", ")} } from "lucide-react";`;

  const needsLink = (config.footer.columns || []).some((col) =>
    col.links.some((link) => isInternalHref(link.href))
  );

  const linkImport = needsLink ? `import Link from "next/link";\n` : "";

  // ── Column links with hover arrow effect ────────────────────────

  const columns = (config.footer.columns || [])
    .map(
      (col) => `          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider">${esc(col.title)}</h4>
            <ul className="mt-4 space-y-2">
${col.links.map((link) => {
  const linkContent = `<span className="flex items-center gap-1 group/link hover:text-${p}-400 hover:translate-x-1 transition-all duration-200">
                    <ArrowRight className="w-3 h-3 opacity-0 -ml-4 group-hover/link:opacity-100 group-hover/link:ml-0 transition-all duration-200" />
                    <span>${esc(link.label)}</span>
                  </span>`;
  if (isInternalHref(link.href)) {
    return `              <li><Link href="${escAttr(link.href)}" className="text-sm text-gray-400 transition-colors">${linkContent}</Link></li>`;
  }
  return `              <li><a href="${escAttr(link.href)}" className="text-sm text-gray-400 transition-colors">${linkContent}</a></li>`;
}).join("\n")}
            </ul>
          </div>`,
    )
    .join("\n");

  // ── Social links with gradient bg hover ────────────────────────

  const socialLinks = config.footer.socialLinks
    ? config.footer.socialLinks
        .map(
          (s) =>
            `              <a
                href="${escAttr(s.url)}"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gradient-to-br hover:from-${p}-500 hover:to-${p}-700 transition-all duration-300"
                aria-label="${escAttr(s.platform)}"
              >
                <${resolveSocialIcon(s.platform)} className="w-5 h-5" />
              </a>`,
        )
        .join("\n")
    : "";

  // ── Newsletter signup form ─────────────────────────────────────

  const newsletter = `
            <form className="mt-4 flex gap-2" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="Your email"
                className="flex-1 px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-1 focus:ring-${p}-500 outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-${p}-600 hover:bg-${p}-700 rounded-lg transition-colors"
              >
                Subscribe
              </button>
            </form>`;

  return `"use client";

${lucideImport}
${linkImport}
export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Gradient divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-${p}-500 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
${config.business.logoUrl ? `            <img src="${escAttr(config.business.logoUrl)}" alt="${escAttr(config.business.name)}" className="h-10 w-auto max-w-[180px] object-contain mb-4" />\n` : `            <h3 className="text-xl font-bold text-white">${esc(config.business.name)}</h3>`}
            <p className="mt-2 text-sm text-gray-400">${esc(config.business.description.substring(0, 120))}</p>
${newsletter}
${socialLinks ? `            <div className="mt-4 flex items-center gap-2">\n${socialLinks}\n            </div>` : ""}
          </div>

          {/* Link columns */}
${columns}
        </div>

        {/* Bottom row: back to top + copyright */}
        <div className="pt-8 border-t border-gray-800 flex flex-col items-center gap-4">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="group flex items-center gap-2 text-sm text-gray-500 hover:text-${p}-400 transition-colors"
          >
            <ChevronUp className="w-4 h-4 group-hover:-translate-y-1 transition-transform duration-300" />
            <span>Back to top</span>
          </button>
          <p className="text-sm text-gray-500">${esc(config.footer.copyright)}</p>
        </div>
      </div>
    </footer>
  );
}
`;
}

// ── Minimal Footer ───────────────────────────────────────────────────

function renderMinimalFooter(config: WebsiteConfig): string {
  const p = config.theme.primary;

  const socialIcons = config.footer.socialLinks
    ? collectSocialIcons(config.footer.socialLinks.map((s) => s.platform))
    : [];

  const allLucideImports = [...socialIcons, "ChevronUp"];
  const lucideImport = allLucideImports.length > 0
    ? `import { ${[...new Set(allLucideImports)].join(", ")} } from "lucide-react";`
    : "";

  const socialLinks = config.footer.socialLinks
    ? config.footer.socialLinks
        .map(
          (s) =>
            `            <a
              href="${escAttr(s.url)}"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-${p}-400 transition-colors duration-300"
              aria-label="${escAttr(s.platform)}"
            >
              <${resolveSocialIcon(s.platform)} className="w-5 h-5" />
            </a>`,
        )
        .join("\n")
    : "";

  return `"use client";

${lucideImport}

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Gradient divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-${p}-500 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center gap-6">
          {/* Back to top */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="group flex items-center gap-2 text-sm text-gray-500 hover:text-${p}-400 transition-colors"
          >
            <ChevronUp className="w-4 h-4 group-hover:-translate-y-1 transition-transform duration-300" />
            <span>Back to top</span>
          </button>

${socialLinks ? `          {/* Social icons */}\n          <div className="flex items-center gap-4">\n${socialLinks}\n          </div>\n` : ""}
          {/* Copyright */}
          <p className="text-sm text-gray-500">${esc(config.footer.copyright)}</p>
        </div>
      </div>
    </footer>
  );
}
`;
}
