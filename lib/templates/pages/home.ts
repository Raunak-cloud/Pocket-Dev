import type { WebsiteConfig } from "../types";
import { getSectionComponentName } from "../utils/helpers";
import { isSupportedSection } from "../registry";

/**
 * Composes app/page.tsx by importing Hero + all homepage sections.
 */
export function renderHomePage(config: WebsiteConfig): string {
  const sectionImports: string[] = [];
  const sectionTags: string[] = [];

  const nameCount: Record<string, number> = {};

  for (const section of config.sections) {
    if (!isSupportedSection(section.type)) continue;

    const baseName = getSectionComponentName(section);
    if (!nameCount[baseName]) nameCount[baseName] = 0;
    nameCount[baseName]++;
    const suffix = nameCount[baseName] > 1 ? `${nameCount[baseName]}` : "";
    const compName = baseName + suffix;

    sectionImports.push(`import ${compName} from "./components/${compName}";`);
    sectionTags.push(`      <${compName} />`);
  }

  return `import Hero from "./components/Hero";
${sectionImports.join("\n")}

export default function Home() {
  return (
    <>
      <Hero />
${sectionTags.join("\n")}
    </>
  );
}
`;
}
