/**
 * AI Config Generator — uses Gemini to produce a WebsiteConfig JSON (~3K chars)
 * instead of generating full React code (~25K chars).
 *
 * Cost: ~8x cheaper than full code generation
 * Speed: single Gemini call, no lint retries, no JSON recovery cascade
 * Reliability: responseMimeType: "application/json" + strong prompting
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  WebsiteConfig,
  TemplateId,
  UploadedImage,
} from "./website-config-types";
import { CONFIG_GENERATOR_SYSTEM_PROMPT } from "@/lib/prompts";

export type { UploadedImage };

const MODEL = "gemini-3-flash-preview";
const MAX_TOKENS = 16384;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not found in environment variables");
  }
  return new GoogleGenerativeAI(apiKey);
}

/* System prompt imported from @/lib/prompts/config-generator-prompt.ts */

// ── Generate config ──────────────────────────────────────────────

export async function generateConfig(
  prompt: string,
  images?: UploadedImage[],
  onProgress?: (message: string) => void,
): Promise<WebsiteConfig> {
  const client = getGeminiClient();

  onProgress?.("Analyzing your request...");

  let userPrompt = `Create a website configuration for: ${prompt}`;

  if (images && images.length > 0) {
    const uploadedUrls = images
      .filter((img) => img.url)
      .map((img) => img.url);
    if (uploadedUrls.length > 0) {
      userPrompt += `\n\nThe user has uploaded ${uploadedUrls.length} image(s). Reference these in the design.`;
    }
  }

  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      maxOutputTokens: MAX_TOKENS,
      temperature: 0.8,
      responseMimeType: "application/json",
    },
  });

  onProgress?.("Generating website configuration...");

  console.log("🏗️ Generating website config with Gemini...");
  const startTime = Date.now();

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: `${CONFIG_GENERATOR_SYSTEM_PROMPT}\n\n${userPrompt}` }],
      },
    ],
  });

  const text = result.response.text();
  const elapsed = Date.now() - startTime;
  const usage = result.response.usageMetadata;
  console.log(`✅ Config generated in ${elapsed}ms (${text.length} chars)`);
  if (usage) {
    console.log(`📊 Tokens — prompt: ${usage.promptTokenCount}, output: ${usage.candidatesTokenCount}, total: ${usage.totalTokenCount}`);
  }

  onProgress?.("Processing configuration...");

  // Parse and validate
  const raw = JSON.parse(text);
  const config = validateAndNormalize(raw);

  console.log(
    `📋 Validated config: templateId=${config.templateId}, components=${Object.keys(config.components || {}).length}, pages=${Object.keys(config.pages).length}`,
  );
  logCustomSectionStats(config);

  return config;
}

// ── Edit config ──────────────────────────────────────────────────

export async function editConfig(
  currentConfig: WebsiteConfig,
  editPrompt: string,
  onProgress?: (message: string) => void,
): Promise<WebsiteConfig> {
  const client = getGeminiClient();

  onProgress?.("Processing edit request...");

  const userPrompt = `Here is the current website configuration:

${JSON.stringify(currentConfig, null, 2)}

The user wants to make this change: "${editPrompt}"

Return the UPDATED configuration JSON with the requested changes applied. Keep everything else the same. Output ONLY valid JSON.`;

  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      maxOutputTokens: MAX_TOKENS,
      temperature: 0.5,
      responseMimeType: "application/json",
    },
  });

  onProgress?.("Updating configuration...");

  console.log("🏗️ Editing website config with Gemini...");
  const startTime = Date.now();

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: `${CONFIG_GENERATOR_SYSTEM_PROMPT}\n\n${userPrompt}` }],
      },
    ],
  });

  const text = result.response.text();
  const elapsed = Date.now() - startTime;
  const usage = result.response.usageMetadata;
  console.log(`✅ Config edited in ${elapsed}ms (${text.length} chars)`);
  if (usage) {
    console.log(`📊 Tokens — prompt: ${usage.promptTokenCount}, output: ${usage.candidatesTokenCount}, total: ${usage.totalTokenCount}`);
  }

  const raw = JSON.parse(text);
  const config = validateAndNormalize(raw);
  logCustomSectionStats(config);

  return config;
}

// ── Custom section stats ─────────────────────────────────────────

function logCustomSectionStats(config: WebsiteConfig): void {
  // Log component stats (WebsiteConfig doesn't have sections property)
  const components = config.components || {};
  const componentCount = Object.keys(components).length;
  if (componentCount > 0) {
    console.log(`🧩 Components configured: ${componentCount}`);
    Object.keys(components).forEach((key) => {
      console.log(`   → ${key}`);
    });
  }
}

// ── Validation & normalization ───────────────────────────────────

const VALID_TEMPLATE_IDS: TemplateId[] = [
  "restaurant",
  "ecommerce",
  "saas",
  "portfolio",
  "blog",
  "fitness",
];

const VALID_TAILWIND_COLORS = new Set([
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
]);

function validateAndNormalize(raw: any): any {
  if (!raw || typeof raw !== "object") {
    throw new Error("Config is not an object");
  }

  // Normalize templateId
  const rawTemplateId = String(raw.templateId || "")
    .toLowerCase()
    .trim();
  // Map common aliases
  const templateAliases: Record<string, TemplateId> = {
    restaurant: "restaurant",
    restaurants: "restaurant",
    food: "restaurant",
    cafe: "restaurant",
    ecommerce: "ecommerce",
    "e-commerce": "ecommerce",
    shop: "ecommerce",
    store: "ecommerce",
    saas: "saas",
    software: "saas",
    app: "saas",
    portfolio: "portfolio",
    personal: "portfolio",
    blog: "blog",
    fitness: "fitness",
    gym: "fitness",
  };
  const templateId: TemplateId = templateAliases[rawTemplateId] || "saas";

  // Validate theme colors
  const theme = raw.theme || {};
  const primary = VALID_TAILWIND_COLORS.has(theme.primary)
    ? theme.primary
    : "blue";
  const secondary = VALID_TAILWIND_COLORS.has(theme.secondary)
    ? theme.secondary
    : "indigo";
  const accent = VALID_TAILWIND_COLORS.has(theme.accent)
    ? theme.accent
    : "amber";

  const background = theme.background === "dark" ? "dark" : "light";
  const validFonts = ["modern", "serif", "playful", "minimal"];
  const fontStyle = validFonts.includes(theme.fontStyle)
    ? theme.fontStyle
    : "modern";

  // Validate business
  const business = raw.business || {};

  // Validate nav
  const nav = raw.nav || {};
  const navItems = Array.isArray(nav.items)
    ? nav.items.filter((i: any) => i && i.label && i.href)
    : [
        { label: "Home", href: "/" },
        { label: "About", href: "/about" },
      ];

  // Validate hero
  const hero = raw.hero || {};
  const validHeroVariants = [
    "centered",
    "split-left",
    "split-right",
    "fullscreen",
    "minimal",
    "gradient-animated",
    "video-bg",
  ];
  const heroVariant = validHeroVariants.includes(hero.variant)
    ? hero.variant
    : "centered";

  // Validate sections
  const sections = Array.isArray(raw.sections)
    ? raw.sections.filter((s: any) => {
        if (!s || !s.type || !s.variant) return false;
        if (s.type === "custom") {
          // Custom sections must have a non-empty PascalCase componentName and code
          if (!s.componentName || typeof s.componentName !== "string") return false;
          if (!/^[A-Z][A-Za-z0-9]+$/.test(s.componentName)) return false;
          if (!s.code || typeof s.code !== "string") return false;
        }
        return true;
      })
    : [];

  // Validate footer
  const footer = raw.footer || {};
  const validFooterVariants = ["simple", "multi-column", "minimal"];
  const footerVariant = validFooterVariants.includes(footer.variant)
    ? footer.variant
    : "simple";

  // Validate pages
  const pages = Array.isArray(raw.pages)
    ? raw.pages.filter(
        (p: any) => p && p.path && p.title && Array.isArray(p.sections),
      )
    : [];

  return {
    version: 1,
    templateId,
    business: {
      name: business.name || "My Business",
      tagline: business.tagline || "Welcome to our website",
      description:
        business.description || "We provide great products and services.",
      phone: business.phone,
      email: business.email,
      address: business.address,
      hours: business.hours,
      logoUrl: business.logoUrl,
    },
    theme: {
      primary,
      secondary,
      accent,
    },
    nav: {
      items: navItems,
      ctaButton:
        nav.ctaButton && nav.ctaButton.label ? nav.ctaButton : undefined,
    },
    hero: {
      variant: heroVariant,
      headline: hero.headline || "Welcome",
      subheadline: hero.subheadline || "Discover what we have to offer",
      ctaText: hero.ctaText || "Get Started",
      ctaHref: hero.ctaHref || "#",
      secondaryCta:
        hero.secondaryCta && hero.secondaryCta.text
          ? hero.secondaryCta
          : undefined,
      imageDescription:
        hero.imageDescription ||
        "A professional modern business photograph, high quality, clean composition",
    },
    sections,
    footer: {
      variant: footerVariant,
      columns: Array.isArray(footer.columns) ? footer.columns : undefined,
      copyright:
        footer.copyright ||
        `© ${new Date().getFullYear()} All rights reserved.`,
      socialLinks: Array.isArray(footer.socialLinks)
        ? footer.socialLinks
        : undefined,
    },
    pages,
  };
}
