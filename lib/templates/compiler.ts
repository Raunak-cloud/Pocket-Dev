import type {
  WebsiteConfig,
  GeneratedFile,
  CompiledProject,
  ConfigSection,
} from "./types";
import { renderLayout } from "./base/layout";
import { renderGlobalsCss } from "./base/globals-css";
import { renderTailwindConfig } from "./base/tailwind-config";
import { renderPackageJson, getBaseDependencies } from "./base/package-json";
import { renderLoading } from "./base/loading";
import { renderNavbar } from "./components/navbar";
import { renderFooter } from "./components/footer";
import { renderHero } from "./components/hero";
import { renderSection, isSupportedSection } from "./registry";
import { renderHomePage } from "./pages/home";
import { renderSubPage } from "./pages/sub-page";
import { getSectionComponentName, resetImageCounter } from "./utils/helpers";

/**
 * Compile a WebsiteConfig into a full Next.js project.
 * Deterministic, no AI, no parsing, no retries.
 */
export function compileTemplate(config: WebsiteConfig): CompiledProject {
  // Reset the global image counter so placeholders start from REPLICATE_IMG_1
  resetImageCounter();

  // Filter out unsupported section types before compiling
  config = {
    ...config,
    sections: config.sections.filter((s) => isSupportedSection(s.type)),
    pages: config.pages.map((p) => ({
      ...p,
      sections: p.sections.filter((s) => isSupportedSection(s.type)),
    })),
  };

  const files: GeneratedFile[] = [];

  // 1. Base files
  files.push({ path: "app/layout.tsx", content: renderLayout(config) });
  files.push({ path: "app/globals.css", content: renderGlobalsCss(config) });
  files.push({ path: "tailwind.config.ts", content: renderTailwindConfig(config) });
  files.push({ path: "package.json", content: renderPackageJson(config) });
  files.push({ path: "app/loading.tsx", content: renderLoading(config) });

  // 2. Shared components
  files.push({ path: "app/components/Navbar.tsx", content: renderNavbar(config) });
  files.push({ path: "app/components/Footer.tsx", content: renderFooter(config) });

  // 3. Hero
  files.push({ path: "app/components/Hero.tsx", content: renderHero(config) });

  // 4. Section components for homepage
  const homeNameCount: Record<string, number> = {};
  for (const section of config.sections) {
    const baseName = getSectionComponentName(section);
    if (!homeNameCount[baseName]) homeNameCount[baseName] = 0;
    homeNameCount[baseName]++;
    const suffix = homeNameCount[baseName] > 1 ? `${homeNameCount[baseName]}` : "";
    const fileName = baseName + suffix;

    const content = renderSection(section, config);
    if (content) {
      files.push({ path: `app/components/${fileName}.tsx`, content });
    }
  }

  // 5. Section components for sub-pages (may overlap with homepage sections)
  for (const page of config.pages) {
    const pageNameCount: Record<string, number> = {};
    for (const section of page.sections) {
      const baseName = getSectionComponentName(section);
      if (!pageNameCount[baseName]) pageNameCount[baseName] = 0;
      pageNameCount[baseName]++;
      const suffix = pageNameCount[baseName] > 1 ? `${pageNameCount[baseName]}` : "";
      const fileName = baseName + suffix;

      // Only add if not already added (homepage might already have it)
      const filePath = `app/components/${fileName}.tsx`;
      if (!files.some((f) => f.path === filePath)) {
        const content = renderSection(section, config);
        if (content) {
          files.push({ path: filePath, content });
        }
      }
    }
  }

  // 6. Homepage
  files.push({ path: "app/page.tsx", content: renderHomePage(config) });

  // 7. Sub-pages
  for (const page of config.pages) {
    files.push({
      path: `app${page.path}/page.tsx`,
      content: renderSubPage(page, config),
    });
  }

  return {
    files,
    dependencies: getBaseDependencies(),
    config,
  };
}

/**
 * Gather all sections across homepage + sub-pages.
 */
export function allSections(config: WebsiteConfig): ConfigSection[] {
  const sections: ConfigSection[] = [...config.sections];
  for (const page of config.pages) {
    sections.push(...page.sections);
  }
  return sections;
}
