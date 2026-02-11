import type { WebsiteConfig, ConfigSection, SectionType } from "./types";
import { renderFeatureGrid } from "./components/feature-grid";
import { renderMenuSection } from "./components/menu-section";
import { renderProductGrid } from "./components/product-grid";
import { renderTestimonials } from "./components/testimonials";
import { renderPricing } from "./components/pricing";
import { renderGallery } from "./components/gallery";
import { renderStats } from "./components/stats";
import { renderCtaBanner } from "./components/cta-banner";
import { renderTeam } from "./components/team";
import { renderContact } from "./components/contact";
import { renderFaq } from "./components/faq";
import { renderAbout } from "./components/about";
import { renderBlogPreview } from "./components/blog-preview";
import { renderLogoCloud } from "./components/logo-cloud";
import { renderNewsletter } from "./components/newsletter";
import { renderProcess } from "./components/process";
import { renderCustom } from "./components/custom";

const KNOWN_SECTION_TYPES: Set<string> = new Set([
  "feature-grid", "menu", "product-grid", "testimonials", "pricing",
  "gallery", "stats", "cta-banner", "team", "blog-preview",
  "contact", "faq", "about", "logo-cloud", "newsletter", "process", "custom",
]);

/** Check if a section type is renderable. */
export function isSupportedSection(type: string): boolean {
  return KNOWN_SECTION_TYPES.has(type);
}

/**
 * Given a ConfigSection, renders it into a React component string.
 * Returns null for unknown section types (skipped by compiler).
 */
export function renderSection(section: ConfigSection, config: WebsiteConfig): string | null {
  switch (section.type) {
    case "feature-grid":  return renderFeatureGrid(section, config);
    case "menu":          return renderMenuSection(section, config);
    case "product-grid":  return renderProductGrid(section, config);
    case "testimonials":  return renderTestimonials(section, config);
    case "pricing":       return renderPricing(section, config);
    case "gallery":       return renderGallery(section, config);
    case "stats":         return renderStats(section, config);
    case "cta-banner":    return renderCtaBanner(section, config);
    case "team":          return renderTeam(section, config);
    case "contact":       return renderContact(section, config);
    case "faq":           return renderFaq(section, config);
    case "about":         return renderAbout(section, config);
    case "blog-preview":  return renderBlogPreview(section, config);
    case "logo-cloud":    return renderLogoCloud(section, config);
    case "newsletter":    return renderNewsletter(section, config);
    case "process":       return renderProcess(section, config);
    case "custom":        return renderCustom(section);
    default:
      console.warn(`⚠️ Unknown section type: "${(section as any).type}", skipping`);
      return null;
  }
}
