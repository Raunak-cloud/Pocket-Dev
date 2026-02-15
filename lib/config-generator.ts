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

// ── System prompt ────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a web design consultant. Given a user's description of the website they want, you produce a JSON configuration object. Output ONLY valid JSON — no markdown, no explanation, no code fences.

The JSON must follow this EXACT schema:

{
  "version": 1,
  "templateId": "restaurant" | "ecommerce" | "saas" | "portfolio" | "blog" | "fitness",
  "business": {
    "name": "string",
    "tagline": "string",
    "description": "string",
    "phone": "string (optional)",
    "email": "string (optional)",
    "address": "string (optional)",
    "hours": "string (optional)",
    "logoUrl": "string (optional — URL to a logo image, set by the system when user uploads a logo)"
  },
  "theme": {
    "primary": "<tailwind-color>",
    "secondary": "<tailwind-color>",
    "accent": "<tailwind-color>",
    "background": "light" | "dark",
    "fontStyle": "modern" | "serif" | "playful" | "minimal"
  },
  "nav": {
    "items": [{ "label": "string", "href": "string" }],
    "ctaButton": { "label": "string", "href": "string" } (optional)
  },
  "hero": {
    "variant": "centered" | "split-left" | "split-right" | "fullscreen" | "minimal" | "gradient-animated" | "video-bg",
    "headline": "string",
    "subheadline": "string",
    "ctaText": "string",
    "ctaHref": "string",
    "secondaryCta": { "text": "string", "href": "string" } (optional),
    "imageDescription": "string (20-40 words, vivid description for AI image generation)"
  },
  "sections": [ ...section objects... ],
  "footer": {
    "variant": "simple" | "multi-column" | "minimal",
    "columns": [{ "title": "string", "links": [{ "label": "string", "href": "string" }] }] (optional),
    "copyright": "string",
    "socialLinks": [{ "platform": "string", "url": "string" }] (optional)
  },
  "pages": [
    {
      "path": "/about",
      "title": "About",
      "sections": [ ...section objects... ]
    }
  ]
}

TAILWIND COLORS (use ONLY these): slate, gray, zinc, neutral, stone, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose

SECTION TYPES — each section object must have "type" and "variant" fields, plus type-specific data:

1. feature-grid (variants: cards, icons-left, icons-top, alternating)
   Required: title, items: [{ icon, title, description }]
   Icons: star, heart, check, shield, zap, rocket, globe, code, users, phone, mail, clock, etc.

2. menu (variants: tabbed, grid, list, elegant) — for restaurants
   Required: title, categories: [{ name, items: [{ name, description, price }] }]

3. product-grid (variants: grid, list, carousel, featured) — for e-commerce
   Required: title, items: [{ name, price, description, imageDescription, originalPrice?, badge? }]

4. testimonials (variants: cards, single-spotlight, slider, minimal)
   Required: title, items: [{ name, role, quote, rating? }]

5. pricing (variants: columns, toggle, comparison-table)
   Required: title, tiers: [{ name, price, period?, description, features: [string], highlighted?, ctaText }]

6. gallery (variants: grid, masonry, carousel)
   Required: title, items: [{ imageDescription, caption? }]

7. stats (variants: inline, cards, large-numbers)
   Required: items: [{ value, label }]

8. cta-banner (variants: gradient, solid, with-image)
   Required: headline, description, ctaText, ctaHref, imageDescription? (only for with-image variant)

9. team (variants: grid, carousel, detailed)
   Required: title, members: [{ name, role, bio?, imageDescription }]

10. blog-preview (variants: cards, list, featured-hero)
    Required: title, posts: [{ title, excerpt, date, author, imageDescription, category? }]

11. contact (variants: form-only, split-with-info, minimal)
    Required: title

12. faq (variants: accordion, two-column, simple)
    Required: title, items: [{ question, answer }]

13. about (variants: text-image, timeline, values-grid)
    Required: title, content
    For text-image: imageDescription
    For timeline: timeline: [{ year, title, description }]
    For values-grid: values: [{ title, description, icon }]

14. logo-cloud (variants: scroll, grid, simple) — trusted-by / partner logos section
    Required: items: [{ name }]
    Optional: title, subtitle
    Use for showing client logos, partner brands, or "trusted by" sections.

15. newsletter (variants: centered, split, banner) — email signup section
    Required: title
    Optional: subtitle, benefits: [string]
    Use for email list signups with optional benefit highlights.

16. process (variants: numbered, timeline, cards) — how-it-works / step-by-step
    Required: steps: [{ title, description, icon? }]
    Optional: title, subtitle
    Icons: same as feature-grid icons.
    Use for showing processes, workflows, or "how it works" steps.

17. custom (variant: custom) — for ANYTHING not covered above (charts, animations, parallax, counters, maps, embeds, etc.)
    Required: componentName (PascalCase, e.g. "RevenueChart"), code (full React component source)
    The "code" field is a complete React/TSX component string with imports and a default export.
    Available imports: react, next/link, next/image, framer-motion, recharts, lucide-react, react-countup, react-type-animation, react-intersection-observer, embla-carousel-react, date-fns, @radix-ui/react-accordion, @radix-ui/react-tabs, @radix-ui/react-dialog, @radix-ui/react-tooltip, @radix-ui/react-progress, class-variance-authority, clsx, tailwind-merge. Tailwind CSS for styling.
    The component must have a default export. Use "use client" directive if it uses hooks/state/effects.
    Keep code concise — under 80 lines per component.

HERO VARIANT TIPS:
- "centered" — classic centered layout with image below
- "split-left" / "split-right" — text on one side, image on the other
- "fullscreen" — full-screen background image with overlay
- "minimal" — simple text-focused, no image
- "gradient-animated" — animated gradient background, modern SaaS feel, no image needed
- "video-bg" — animated gradient simulating video, glassmorphism card overlay

RULES:
1. templateId MUST be one of: restaurant, ecommerce, saas, portfolio, blog, fitness (lowercase, exact)
2. Include 4-8 sections on the homepage
3. Write real, compelling, specific content — not generic placeholders
4. imageDescription fields must be vivid and specific (20-40 words) for AI image generation
5. MAXIMUM 6 imageDescription fields total across entire config (hero + all sections + all pages)
6. Include 2-4 sub-pages with 1-3 sections each
7. Color choices should match the business vibe (warm for restaurants, cool for tech, etc.)
8. Restaurant → must have menu section. E-commerce → must have product-grid section.
9. Use "custom" sections ONLY when the request cannot be fulfilled by the 16 template types above.
   Prefer template types when possible — they are faster and more reliable.
10. Include a logo-cloud section for professional sites (saas, ecommerce, fitness) to build trust.
11. Include a process section for service-oriented sites to explain how things work.
12. Consider a newsletter section for blogs and content-focused sites.

RESTAURANT PAGES: /menu, /about, /contact
ECOMMERCE PAGES: /products, /about, /contact
SAAS PAGES: /features, /pricing, /contact
PORTFOLIO PAGES: /projects, /about, /contact`;

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
        parts: [{ text: `${SYSTEM_PROMPT}\n\n${userPrompt}` }],
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
        parts: [{ text: `${SYSTEM_PROMPT}\n\n${userPrompt}` }],
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
