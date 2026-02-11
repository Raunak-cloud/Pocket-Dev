import type { WebsiteConfig, PageConfig } from "../types";
import { resolveTheme } from "../utils/theme";
import { esc, getSectionComponentName } from "../utils/helpers";
import { isSupportedSection } from "../registry";

/**
 * Composes a sub-page (e.g. /about, /menu, /products).
 */
export function renderSubPage(page: PageConfig, config: WebsiteConfig): string {
  const t = resolveTheme(config.theme);
  const isDark = config.theme.background === "dark";

  const sectionImports: string[] = [];
  const sectionTags: string[] = [];
  const nameCount: Record<string, number> = {};

  for (const section of page.sections) {
    if (!isSupportedSection(section.type)) continue;

    const baseName = getSectionComponentName(section);
    if (!nameCount[baseName]) nameCount[baseName] = 0;
    nameCount[baseName]++;
    const suffix = nameCount[baseName] > 1 ? `${nameCount[baseName]}` : "";
    const compName = baseName + suffix;

    sectionImports.push(`import ${compName} from "${getRelativeImport(page.path, compName)}";`);
    sectionTags.push(`      <${compName} />`);
  }

  return `${sectionImports.join("\n")}

export default function ${pascalCase(page.title)}Page() {
  return (
    <>
      {/* Page Header */}
      <section className="pt-28 pb-12 ${isDark ? "bg-gray-950" : "bg-gray-50"}">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold ${t.textHeading}">${esc(page.title)}</h1>
        </div>
      </section>
${sectionTags.join("\n")}
    </>
  );
}
`;
}

function pascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9\s\-_]/g, "")
    .split(/[\s\-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

function getRelativeImport(pagePath: string, componentName: string): string {
  const depth = pagePath.split("/").filter(Boolean).length;
  const prefix = "../".repeat(depth);
  return `${prefix}components/${componentName}`;
}
