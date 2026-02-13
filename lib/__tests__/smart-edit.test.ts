/**
 * Test cases for smart edit system
 * Demonstrates fixes for:
 * 1. Logo changes affecting all images
 * 2. Drastic changes breaking site
 */

import { classifyEdit } from "../smart-edit-router";
import type { WebsiteConfig } from "../templates/types";

// Mock config for testing
const mockRestaurantConfig: WebsiteConfig = {
  version: 1,
  templateId: "restaurant",
  business: {
    name: "Bella Italia",
    tagline: "Authentic Italian Cuisine",
    description: "Family-owned restaurant since 1985",
    phone: "(555) 123-4567",
    email: "info@bella-italia.com",
    logoUrl: "https://example.com/old-logo.png",
  },
  theme: {
    primary: "red",
    secondary: "amber",
    accent: "green",
    background: "light",
    fontStyle: "serif",
  },
  nav: {
    items: [
      { label: "Home", href: "/" },
      { label: "Menu", href: "/menu" },
    ],
  },
  hero: {
    variant: "split-left",
    headline: "Taste of Italy",
    subheadline: "Fresh pasta made daily",
    ctaText: "View Menu",
    ctaHref: "/menu",
    imageDescription: "rustic Italian restaurant interior with wooden tables",
  },
  sections: [
    {
      type: "menu",
      variant: "tabbed",
      title: "Our Menu",
      categories: [],
    },
  ],
  footer: {
    variant: "multi-column",
    copyright: "© 2024 Bella Italia",
    columns: [],
  },
  pages: [],
};

// ── Test Cases ───────────────────────────────────────────────────

describe("Smart Edit Classification", () => {
  test("ISSUE 1: Logo change should only target logo", async () => {
    const classification = await classifyEdit(
      "Change the logo to my new brand image",
      mockRestaurantConfig
    );

    expect(classification.type).toBe("logo-only");
    expect(classification.targetFields).toEqual(["business.logoUrl"]);
    expect(classification.shouldRegenerate).toBe(false);
    console.log("✅ Logo change correctly classified as narrow scope");
  });

  test("ISSUE 2: Drastic change should trigger regeneration", async () => {
    const classification = await classifyEdit(
      "Make this a SaaS landing page for project management software",
      mockRestaurantConfig
    );

    expect(classification.type).toBe("structure-major");
    expect(classification.shouldRegenerate).toBe(true);
    console.log("✅ Drastic change correctly triggers full regeneration");
  });

  test("Color change should only affect theme", async () => {
    const classification = await classifyEdit(
      "Change the primary color to blue",
      mockRestaurantConfig
    );

    expect(classification.type).toBe("styling");
    expect(classification.targetFields).toContain("theme.primary");
    expect(classification.shouldRegenerate).toBe(false);
    console.log("✅ Color change limited to theme fields");
  });

  test("Content change should not affect structure", async () => {
    const classification = await classifyEdit(
      "Update the hero headline to 'Welcome to Bella Italia'",
      mockRestaurantConfig
    );

    expect(classification.type).toBe("content");
    expect(classification.targetFields).toContain("hero.headline");
    expect(classification.shouldRegenerate).toBe(false);
    console.log("✅ Content change limited to text fields");
  });

  test("Minor structure change should not regenerate", async () => {
    const classification = await classifyEdit(
      "Add a testimonials section after the menu",
      mockRestaurantConfig
    );

    expect(classification.type).toBe("structure-minor");
    expect(classification.shouldRegenerate).toBe(false);
    console.log("✅ Minor structural change uses surgical edit");
  });

  test("Multiple major changes should regenerate", async () => {
    const classification = await classifyEdit(
      "Change to dark theme, make it a tech startup page, add 5 new sections, change all content",
      mockRestaurantConfig
    );

    expect(classification.shouldRegenerate).toBe(true);
    console.log("✅ Multiple major changes trigger full regeneration");
  });
});

// ── Expected Behavior ────────────────────────────────────────────

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    BEFORE vs AFTER                             ║
╠═══════════════════════════════════════════════════════════════╣
║                                                                ║
║  BEFORE (OLD SYSTEM):                                          ║
║  ❌ User: "Change logo"                                        ║
║     → AI changes: logoUrl, hero.imageDescription,             ║
║       section images, gallery images (BROKEN!)                ║
║                                                                ║
║  ❌ User: "Make it a SaaS page"                                ║
║     → AI tries to fit SaaS into restaurant structure          ║
║     → Result: Broken hybrid mess                              ║
║                                                                ║
╠═══════════════════════════════════════════════════════════════╣
║                                                                ║
║  AFTER (SMART EDIT SYSTEM):                                    ║
║  ✅ User: "Change logo"                                        ║
║     → Classified as: logo-only                                ║
║     → Changes ONLY: business.logoUrl                          ║
║     → All other images: UNCHANGED ✅                           ║
║                                                                ║
║  ✅ User: "Make it a SaaS page"                                ║
║     → Classified as: structure-major                          ║
║     → Triggers: Full regeneration from scratch                ║
║     → Result: Clean SaaS site ✅                               ║
║                                                                ║
╚═══════════════════════════════════════════════════════════════╝
`);
