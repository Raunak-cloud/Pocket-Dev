import crypto from "node:crypto";
import Replicate from "replicate";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SiteTheme } from "@/app/types";

interface GeneratedFile {
  path: string;
  content: string;
}

interface PersistImageOptions {
  previousFiles?: GeneratedFile[];
  preserveExistingImages?: boolean;
  isUserProvidedPrompt?: boolean;
  originalPrompt?: string;
  detectedTheme?: SiteTheme;
}

type UrlOutput = {
  url: () => string | URL;
};

type ReplicateModelName = `${string}/${string}` | `${string}/${string}:${string}`;
const DEFAULT_REPLICATE_MODEL: ReplicateModelName = "prunaai/z-image-turbo";
const REPLICATE_MODEL = (
  process.env.REPLICATE_IMAGE_MODEL || DEFAULT_REPLICATE_MODEL
) as ReplicateModelName;
// z-image-turbo supports multiple resolutions: 768, 1024, 1152, etc.
// Using 1024x1024 for better quality while staying fast
const DEFAULT_IMAGE_WIDTH = 1024;
const DEFAULT_IMAGE_HEIGHT = 1024;
const DEFAULT_PROMPT = "High-quality, professional, well-lit, clean composition";
const RATE_LIMIT_RETRY_DELAY_MS = 10_000; // 10 seconds as requested
const MAX_RATE_LIMIT_RETRIES = 5; // Increased retries to ensure images are generated
const IMAGE_EXTENSION_RE = /\.(png|jpe?g|webp|gif|svg|avif)(?:$|\?)/i;
const REMOTE_URL_RE = /^https?:\/\//i;
const PLACEHOLDER_RE = /^REPLICATE_IMG_\d+$/i;
const KNOWN_IMAGE_HOSTS = new Set([
  "placehold.co",
  "via.placeholder.com",
  "dummyimage.com",
  "loremflickr.com",
  "picsum.photos",
  "replicate.delivery",
  "pbxt.replicate.delivery",
]);
const GENERIC_IMAGE_PROMPT_RE =
  /\b(?:image|photo|picture|professional photograph|professional product photo|placeholder|stock|hero image)\b/i;

function getThemeDefaultPrompt(theme: SiteTheme): string {
  if (theme === "food") {
    return "Beautifully plated dish, restaurant quality, appetizing, well-presented, natural lighting, culinary magazine style";
  }
  if (theme === "fashion") {
    return "High-end fashion, editorial style, stylish, clean minimal background, commercial quality, elegant";
  }
  if (theme === "interior") {
    return "Professionally designed interior space, natural daylight, modern aesthetic, spacious, clean design";
  }
  if (theme === "automotive") {
    return "Luxury car, sleek design, dramatic lighting, showroom quality, modern, dynamic angle";
  }
  if (theme === "people") {
    return "Natural portrait, authentic expression, well-lit, editorial style, clean background";
  }
  return DEFAULT_PROMPT;
}

function getSupabaseHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isUrlOutput(value: unknown): value is UrlOutput {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof (value as { url?: unknown }).url === "function"
  );
}

function trimPrompt(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[{}[\]<>`]/g, " ")
    .trim()
    .slice(0, 220);
}

function promptFromUrl(source: string): string {
  try {
    const url = new URL(source);
    const queryKeys = [
      "prompt",
      "q",
      "query",
      "text",
      "title",
      "description",
      "keyword",
    ];

    for (const key of queryKeys) {
      const value = url.searchParams.get(key);
      if (value) {
        const trimmed = trimPrompt(decodeURIComponent(value));
        if (trimmed) return trimmed;
      }
    }

    const pathname = decodeURIComponent(url.pathname || "")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (pathname.length > 4) {
      return trimPrompt(pathname);
    }
  } catch {
    // Ignore malformed URLs and fall back.
  }
  return DEFAULT_PROMPT;
}

function resolvePrompt(
  source: string,
  altText?: string,
  contextHint?: string,
  siteTheme: SiteTheme = "generic",
  isUserProvided: boolean = false,
): string {
  const trimmedAlt = trimPrompt(altText || "");
  const trimmedContext = trimPrompt(contextHint || "");
  const themeDefault = getThemeDefaultPrompt(siteTheme);

  // If this is a user-provided prompt, use it directly without length requirements
  if (isUserProvided && trimmedAlt) {
    console.log(`[resolvePrompt] Using user-provided prompt directly: "${trimmedAlt}"`);
    return trimmedAlt;
  }

  // PRIORITY 1: Use alt text if it's specific (minimum 10 words for quality)
  // Even if it contains some generic words, if it's detailed enough, use it
  if (trimmedAlt && trimmedAlt.split(/\s+/).length >= 10) {
    console.log(`[resolvePrompt] Using detailed alt text (${trimmedAlt.split(/\s+/).length} words): "${trimmedAlt}"`);
    return trimmedAlt;
  }

  // PRIORITY 2: If alt text is specific but shorter, still use it if not generic
  if (trimmedAlt && !GENERIC_IMAGE_PROMPT_RE.test(trimmedAlt) && trimmedAlt.length >= 15) {
    console.log(`[resolvePrompt] Using specific alt text: "${trimmedAlt}"`);
    return trimmedAlt;
  }

  // PRIORITY 3: Use contextual information from headings
  if (trimmedContext && trimmedContext.length >= 10) {
    console.log(`[resolvePrompt] Using context hint: "${trimmedContext}"`);

    // For food-related context, add photography style
    if (/\b(food|dish|meal|cook|chef|restaurant|kitchen|recipe)\b/i.test(trimmedContext)) {
      return `${trimmedContext}, food photography, appetizing presentation`;
    }

    // For learning/education context, add relevant photography style
    if (/\b(course|learning|student|teacher|education|study|lesson|mentor)\b/i.test(trimmedContext)) {
      return `${trimmedContext}, educational setting, students engaged in learning, modern classroom or study environment`;
    }

    return trimmedContext;
  }

  // PRIORITY 4: Fallback to alt text even if generic, better than nothing
  if (trimmedAlt && trimmedAlt.length >= 5) {
    console.log(`[resolvePrompt] Using fallback alt text: "${trimmedAlt}"`);
    return trimmedAlt;
  }

  // PRIORITY 5: Use theme defaults only for actual placeholders
  if (PLACEHOLDER_RE.test(source)) {
    console.log(`[resolvePrompt] Using theme default for placeholder: "${themeDefault}"`);
    return themeDefault;
  }

  // LAST RESORT: Try to extract from URL
  return promptFromUrl(source);
}

function extractContextHint(content: string, startIndex: number): string {
  const from = Math.max(0, startIndex - 1500);
  const to = Math.min(content.length, startIndex + 1500);
  const snippet = content.slice(from, to);

  // First priority: Look for article titles or main headings (h1, h2)
  const mainHeadingMatch = snippet.match(/<h[1-2][^>]*>([^<]{8,150})<\/h[1-2]>/i);
  if (mainHeadingMatch?.[1]) {
    const cleaned = sanitizeVisualSubjectPrompt(trimPrompt(mainHeadingMatch[1]));
    if (cleaned && cleaned.length >= 10) {
      console.log(`[extractContextHint] Found main heading: "${cleaned}"`);
      return cleaned;
    }
  }

  // Second priority: Look for h3 headings near the image
  const subHeadingMatch = snippet.match(/<h3[^>]*>([^<]{8,120})<\/h3>/i);
  if (subHeadingMatch?.[1]) {
    const cleaned = sanitizeVisualSubjectPrompt(trimPrompt(subHeadingMatch[1]));
    if (cleaned && cleaned.length >= 8) {
      console.log(`[extractContextHint] Found subheading: "${cleaned}"`);
      return cleaned;
    }
  }

  // Third priority: Look for title/name attributes
  const labelMatch = snippet.match(
    /\b(?:title|name|aria-label|product|service|category|collection|theme)\s*[:=]\s*["'`]([^"'`]{8,120})["'`]/i,
  );
  if (labelMatch?.[1]) {
    const cleaned = sanitizeVisualSubjectPrompt(trimPrompt(labelMatch[1]));
    if (cleaned && cleaned.length >= 8) return cleaned;
  }

  // Last resort: Extract meaningful text near the image
  const textMatch = snippet.match(/>([^<]{15,180})</);
  if (textMatch?.[1]) {
    const cleaned = sanitizeVisualSubjectPrompt(trimPrompt(textMatch[1]));
    if (cleaned && cleaned.length >= 10) return cleaned;
  }

  return "";
}

function extractPlaceholderNumber(source: string): number | null {
  const match = source.match(/REPLICATE_IMG_(\d+)/i);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

function getStyleDirection(base: string, siteTheme: SiteTheme): string {
  const text = base.toLowerCase();

  // Check for tech/blog/abstract concepts first
  if (/\b(AI|artificial intelligence|machine learning|algorithm|data|code|programming|software|technology|digital|cyber|network)\b/i.test(text)) {
    return "modern tech visualization, abstract digital concept, clean minimalist design, contemporary aesthetic";
  }

  if (/\b(design|UI|UX|interface|workspace|productivity|creativity|minimal)\b/i.test(text)) {
    return "clean modern aesthetic, minimalist workspace photography, professional environment, natural lighting";
  }

  if (/\b(CSS|HTML|JavaScript|web|framework|development|coding)\b/i.test(text)) {
    return "modern development environment, clean code editor setup, professional workspace, ambient lighting";
  }

  // Check for specific product categories that override theme
  if (/\b(shoe|sneaker|watch|bag|handbag|purse|bottle|perfume|cosmetic|jewelry|ring|necklace)\b/.test(text)) {
    return "commercial product photography, clean white background, professional studio lighting, centered composition, catalog quality";
  }

  if (/\b(food|dish|meal|cuisine|dessert|plate|bowl)\b/.test(text)) {
    return "editorial food photography, overhead angle, natural daylight, rustic wooden surface, garnished beautifully, appetizing presentation";
  }

  if (/\b(person|people|man|woman|model|portrait)\b/.test(text)) {
    return "professional portrait photography, natural skin tones, catchlight in eyes, soft diffused lighting, authentic expression";
  }

  // Check if the prompt actually matches the theme before applying theme styles
  // This prevents forcing food photography on tech blog articles
  if (siteTheme === "food" && /\b(food|dish|meal|cook|chef|restaurant|cuisine)\b/i.test(text)) {
    return "gourmet food photography, magazine editorial style, natural window light, warm tones";
  }
  if (siteTheme === "fashion" && /\b(fashion|clothing|apparel|style|outfit)\b/i.test(text)) {
    return "high fashion editorial, Vogue magazine style, dramatic lighting, professional model";
  }
  if (siteTheme === "interior" && /\b(interior|room|space|furniture|home)\b/i.test(text)) {
    return "architectural photography, wide angle lens, natural light, professionally staged";
  }
  if (siteTheme === "automotive" && /\b(car|vehicle|automotive|motorcycle)\b/i.test(text)) {
    return "luxury automotive photography, dramatic reflections, showroom environment, cinematic lighting";
  }
  if (siteTheme === "people" && /\b(person|people|portrait|team|staff)\b/i.test(text)) {
    return "lifestyle portrait photography, environmental portrait, natural candid moment";
  }

  // Default to clean, professional photography that matches the content
  return "professional editorial photography, clean composition, modern aesthetic";
}

function getPhotographyTechnique(siteTheme: SiteTheme): string {
  if (siteTheme === "food") {
    return "shot with macro lens, f/2.8 aperture, shallow depth of field, natural food styling";
  }
  if (siteTheme === "fashion") {
    return "shot with 85mm lens, f/1.8 aperture, professional makeup and styling, high-end retouching";
  }
  if (siteTheme === "interior") {
    return "shot with 16-35mm wide angle lens, f/8 aperture for deep focus, HDR technique, tilt-shift correction";
  }
  if (siteTheme === "automotive") {
    return "shot with 24-70mm lens, f/4 aperture, circular polarizer filter, multi-light setup";
  }
  if (siteTheme === "people") {
    return "shot with 85mm prime lens, f/2 aperture, natural light with reflector, authentic moment";
  }
  return "shot with professional camera, optimal aperture, proper exposure, sharp focus throughout";
}

function getCompositionGuidance(siteTheme: SiteTheme): string {
  if (siteTheme === "food") {
    return "rule of thirds composition, negative space around subject, hero ingredient highlighted, complementary props minimal";
  }
  if (siteTheme === "fashion") {
    return "centered subject, full body or three-quarter length, clean background separation, elegant pose";
  }
  if (siteTheme === "interior") {
    return "symmetrical composition, leading lines to focal point, balanced lighting across room, no clutter";
  }
  if (siteTheme === "automotive") {
    return "three-quarter front angle, dynamic perspective, reflective surface highlighted, minimal background distraction";
  }
  if (siteTheme === "people") {
    return "subject slightly off-center, environmental context visible, eye contact with camera, natural relaxed posture";
  }
  return "balanced composition, subject prominence, professional framing, clear focal point";
}

function getSimpleStyleHint(base: string, siteTheme: SiteTheme): string {
  const text = base.toLowerCase();

  // Tech/digital content - NO photography terms
  if (/\b(AI|artificial intelligence|machine learning|algorithm|data|code|programming|software|technology|digital|cyber|network)\b/i.test(text)) {
    return "modern, clean design, minimalist, contemporary";
  }

  if (/\b(design|UI|UX|interface|workspace|productivity|creativity|minimal)\b/i.test(text)) {
    return "clean, modern, minimalist, professional environment";
  }

  // Product photography - focus on the product
  if (/\b(shoe|sneaker|watch|bag|handbag|purse|bottle|perfume|cosmetic|jewelry|ring|necklace)\b/.test(text)) {
    return "clean background, well-lit, centered, catalog style";
  }

  // Food - focus on the dish
  if (/\b(food|dish|meal|cuisine|dessert|plate|bowl)\b/.test(text)) {
    return "appetizing, well-presented, natural lighting, overhead view";
  }

  // People - focus on the person
  if (/\b(person|people|man|woman|model|portrait)\b/.test(text)) {
    return "natural, authentic expression, soft lighting";
  }

  // Theme-based hints (only if content matches)
  if (siteTheme === "food" && /\b(food|dish|meal|cook|chef|restaurant|cuisine)\b/i.test(text)) {
    return "appetizing, beautifully plated, warm tones";
  }
  if (siteTheme === "fashion" && /\b(fashion|clothing|apparel|style|outfit)\b/i.test(text)) {
    return "stylish, elegant, modern fashion";
  }
  if (siteTheme === "interior" && /\b(interior|room|space|furniture|home)\b/i.test(text)) {
    return "spacious, well-lit, modern design";
  }
  if (siteTheme === "automotive" && /\b(car|vehicle|automotive|motorcycle)\b/i.test(text)) {
    return "sleek, modern, dynamic angle";
  }
  if (siteTheme === "people" && /\b(person|people|portrait|team|staff)\b/i.test(text)) {
    return "natural, candid moment, authentic";
  }

  // Default - keep it simple
  return "clean, modern, professional";
}

function buildGenerationPrompt(
  source: string,
  prompt: string,
  index: number,
  siteTheme: SiteTheme = "generic",
  isUserProvided: boolean = false,
): string {
  // If this is a user-provided prompt (from image regeneration), use it with minimal additions
  if (isUserProvided) {
    const userPrompt = trimPrompt(prompt);
    if (!userPrompt) {
      // Fallback if somehow empty
      return `${getThemeDefaultPrompt(siteTheme)}, high quality, photorealistic`;
    }
    // Only add minimal quality terms
    const minimalPrompt = `${userPrompt}, high quality, photorealistic`;
    console.log(`[buildGenerationPrompt] User-provided prompt: "${userPrompt}" -> "${minimalPrompt}"`);
    return minimalPrompt.slice(0, 400);
  }

  // For auto-generated placeholders, sanitize to remove UI/web terms
  const base = sanitizeVisualSubjectPrompt(
    trimPrompt(prompt) || getThemeDefaultPrompt(siteTheme),
  );

  // SIMPLIFIED: Just use the base prompt with minimal style guidance
  // No camera jargon that confuses the AI
  const placeholderNumber = extractPlaceholderNumber(source);
  const variationSeed = placeholderNumber ?? index;

  // Get simple style hints without photography jargon
  const simpleStyle = getSimpleStyleHint(base, siteTheme);

  // Build a clean, simple prompt structure
  const promptParts = [
    base,
    simpleStyle,
    `high quality, photorealistic`,
    `variation ${variationSeed}`,
  ];

  const finalPrompt = promptParts.filter(Boolean).join(", ");

  // Keep it under 400 chars for optimal results
  return finalPrompt.slice(0, 400);
}

function inferStyleHint(base: string, siteTheme: SiteTheme = "generic"): string {
  const text = base.toLowerCase();
  if (siteTheme === "food") {
    return "Editorial food photography, appetizing details, realistic plating, warm natural lighting.";
  }
  if (/\b(shoe|sneaker|watch|bag|bottle|chair|sofa|lamp|furniture|device|headphone|jewelry)\b/.test(text)) {
    return "Studio product photography, premium lighting, clean backdrop, e-commerce quality.";
  }
  if (/\b(food|dish|meal|coffee|drink|restaurant|dessert|pizza|burger|salad)\b/.test(text)) {
    return "Editorial food photography, appetizing details, realistic plating, soft natural lighting.";
  }
  if (/\b(person|man|woman|model|portrait|face|team|staff|doctor|lawyer|chef)\b/.test(text)) {
    return "Editorial portrait photography, realistic skin tone, natural lighting, clean depth of field.";
  }
  if (/\b(car|bike|motorcycle|vehicle|truck)\b/.test(text)) {
    return "Automotive photo style, realistic reflections, cinematic but natural lighting.";
  }
  if (/\b(home|interior|room|kitchen|bedroom|living room|office space|architecture)\b/.test(text)) {
    return "Interior/architectural photography with realistic perspective, balanced exposure, premium composition.";
  }
  return "Commercial editorial photography with realistic detail and clean composition.";
}

function sanitizeVisualSubjectPrompt(input: string): string {
  let text = input;

  // ONLY remove very specific UI/tech terms that would create literal screenshots
  // Keep domain-specific terms like "learning", "platform", "course", "student", etc.
  const literalUITerms = [
    /\b(?:screenshot|screen capture|screen grab)\b/gi,
    /\b(?:mockup|wireframe|prototype)\b/gi,
    /\b(?:hero section|banner section|header section)\b/gi,
  ];

  for (const re of literalUITerms) {
    text = text.replace(re, "");
  }

  // Replace UI-specific words with more photographic equivalents
  text = text.replace(/\bwebsite\b/gi, "professional setting");
  text = text.replace(/\bwebpage\b/gi, "professional setting");
  text = text.replace(/\b(?:dashboard|admin panel|control panel)\b/gi, "workspace");
  text = text.replace(/\b(?:UI|UX|interface|user interface)\b/gi, "");
  text = text.replace(/\b(?:app screen)\b/gi, "");
  text = text.replace(/\b(?:landing page|homepage)\b/gi, "");

  // Clean up extra whitespace
  text = text.replace(/\s+/g, " ").trim();

  // If we removed too much and lost the meaning, return a sensible default
  if (!text || text.length < 5) {
    return DEFAULT_PROMPT;
  }

  // Remove leading articles and prepositions if they don't make sense
  text = text.replace(/^(?:a|an|the|of|for|with|in|on|at)\s+/i, "");

  return text.trim();
}

function detectSiteTheme(files: GeneratedFile[]): SiteTheme {
  const corpus = files
    .slice(0, 40)
    .map((f) => f.content.slice(0, 6000))
    .join(" ")
    .toLowerCase();

  const score = (re: RegExp) => (corpus.match(re)?.length ?? 0);

  // Check for tech/blog indicators first
  const techBlogScore = score(
    /\b(blog|article|post|engineering|technology|software|code|programming|development|design system|UI|UX|tech|tutorial|guide)\b/g,
  );

  // If it's clearly a blog/tech site, return generic to avoid misclassification
  if (techBlogScore >= 5) return "generic";

  const foodScore = score(
    /\b(meal|meals|dish|dishes|food|cook|chef|kitchen|menu|restaurant|delivery|order|homemade|home cook|plating|recipe)\b/g,
  );
  const fashionScore = score(
    /\b(fashion|apparel|clothing|wear|outfit|sneaker|jewelry|boutique)\b/g,
  );
  const interiorScore = score(
    /\b(interior|furniture|living room|bedroom|kitchen design|home decor|architecture)\b/g,
  );
  const autoScore = score(
    /\b(car|vehicle|automotive|motorcycle|garage|driving)\b/g,
  );
  const peopleScore = score(
    /\b(team|staff|person|people|portrait|profile|professional)\b/g,
  );

  const ranked: Array<[SiteTheme, number]> = [
    ["food", foodScore],
    ["fashion", fashionScore],
    ["interior", interiorScore],
    ["automotive", autoScore],
    ["people", peopleScore],
  ];
  ranked.sort((a, b) => b[1] - a[1]);

  // Require at least 5 strong matches to classify as a specific theme
  // This prevents misclassification from incidental keyword matches
  if (ranked[0][1] < 5) return "generic";

  // Also check that the top theme is significantly higher than others
  if (ranked[1] && ranked[0][1] < ranked[1][1] * 2) return "generic";

  return ranked[0][0];
}

function createFallbackImageDataUri(source: string, prompt: string, index: number): string {
  const seed = `${source}:${index}:${prompt}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }

  const hueA = Math.abs(hash) % 360;
  const hueB = (hueA + 72) % 360;
  const hueC = (hueA + 144) % 360;
  const label = trimPrompt(prompt) || `Image ${index}`;
  const safeLabel = label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="hsl(${hueA} 72% 46%)"/>
<stop offset="50%" stop-color="hsl(${hueB} 74% 42%)"/>
<stop offset="100%" stop-color="hsl(${hueC} 78% 38%)"/>
</linearGradient>
</defs>
<rect width="1200" height="800" fill="url(#g)"/>
<g opacity="0.22" fill="#fff">
<circle cx="170" cy="160" r="90"/>
<circle cx="1070" cy="220" r="130"/>
<circle cx="900" cy="670" r="160"/>
</g>
<rect x="90" y="620" width="1020" height="110" rx="16" fill="rgba(0,0,0,0.28)"/>
<text x="120" y="690" fill="white" font-size="36" font-family="Arial, Helvetica, sans-serif">${safeLabel}</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function isSupabaseStorageUrl(source: string, supabaseHost: string | null): boolean {
  if (!supabaseHost || !REMOTE_URL_RE.test(source)) return false;
  try {
    const url = new URL(source);
    return url.hostname.toLowerCase() === supabaseHost;
  } catch {
    return false;
  }
}

function isLikelyImageUrl(source: string): boolean {
  try {
    const url = new URL(source);
    const host = url.hostname.toLowerCase();
    const pathname = url.pathname || "";
    if (KNOWN_IMAGE_HOSTS.has(host)) return true;
    if (IMAGE_EXTENSION_RE.test(pathname)) return true;
    if (
      url.searchParams.has("width") ||
      url.searchParams.has("height") ||
      url.searchParams.has("w") ||
      url.searchParams.has("h")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function shouldReplaceSource(source: string, supabaseHost: string | null): boolean {
  if (!source) return false;
  if (PLACEHOLDER_RE.test(source)) return true;
  if (source.startsWith("/") || source.startsWith("./") || source.startsWith("../")) {
    return false;
  }
  if (source.startsWith("data:") || source.startsWith("blob:") || source.startsWith("#")) {
    return false;
  }
  if (!REMOTE_URL_RE.test(source)) return false;
  if (isSupabaseStorageUrl(source, supabaseHost)) return false;
  return isLikelyImageUrl(source);
}

function collectImageSources(
  files: GeneratedFile[],
  siteTheme: SiteTheme,
  isUserProvided: boolean = false,
): Map<string, string> {
  const refs = new Map<string, string>();
  const supabaseHost = getSupabaseHost();

  for (const file of files) {
    const content = file.content;

    const tagRe = /<(?:img|Image)\b[^>]*>/gim;
    let tagMatch: RegExpExecArray | null = tagRe.exec(content);
    while (tagMatch) {
      const tag = tagMatch[0];
      const srcMatch = tag.match(/\bsrc\s*=\s*(?:\{)?["']([^"']+)["'](?:\})?/i);
      if (srcMatch) {
        const source = srcMatch[1].trim();
        if (shouldReplaceSource(source, supabaseHost) && !refs.has(source)) {
          const altMatch = tag.match(/\balt\s*=\s*(?:\{)?["']([^"']*)["'](?:\})?/i);
          const contextHint = extractContextHint(content, tagMatch.index);
          refs.set(
            source,
            resolvePrompt(source, altMatch?.[1], contextHint, siteTheme, isUserProvided),
          );
        }
      }
      tagMatch = tagRe.exec(content);
    }

    const cssUrlRe = /url\(\s*["']?(https?:\/\/[^"')\s]+)["']?\s*\)/gi;
    let cssMatch: RegExpExecArray | null = cssUrlRe.exec(content);
    while (cssMatch) {
      const source = cssMatch[1];
      if (shouldReplaceSource(source, supabaseHost) && !refs.has(source)) {
        refs.set(
          source,
          resolvePrompt(
            source,
            undefined,
            extractContextHint(content, cssMatch.index),
            siteTheme,
            isUserProvided,
          ),
        );
      }
      cssMatch = cssUrlRe.exec(content);
    }

    const placeholderRe = /REPLICATE_IMG_\d+/gi;
    let placeholderMatch: RegExpExecArray | null = placeholderRe.exec(content);
    while (placeholderMatch) {
      const source = placeholderMatch[0];
      if (!refs.has(source)) {
        refs.set(
          source,
          resolvePrompt(
            source,
            undefined,
            extractContextHint(content, placeholderMatch.index),
            siteTheme,
            isUserProvided,
          ),
        );
      }
      placeholderMatch = placeholderRe.exec(content);
    }

    const remoteUrlRe = /https?:\/\/[^\s"'`)<>\]}]+/g;
    let urlMatch: RegExpExecArray | null = remoteUrlRe.exec(content);
    while (urlMatch) {
      const source = urlMatch[0].replace(/[),.;]+$/, "");
      if (shouldReplaceSource(source, supabaseHost) && !refs.has(source)) {
        refs.set(
          source,
          resolvePrompt(
            source,
            undefined,
            extractContextHint(content, urlMatch.index),
            siteTheme,
            isUserProvided,
          ),
        );
      }
      urlMatch = remoteUrlRe.exec(content);
    }
  }

  return refs;
}

function collectOrderedImgSources(files: GeneratedFile[]): string[] {
  const out: string[] = [];
  for (const file of files) {
    const tagRe = /<(?:img|Image)\b[^>]*>/gim;
    let tagMatch: RegExpExecArray | null = tagRe.exec(file.content);
    while (tagMatch) {
      const tag = tagMatch[0];
      const srcMatch = tag.match(/\bsrc\s*=\s*(?:\{)?["']([^"']+)["'](?:\})?/i);
      if (srcMatch && srcMatch[1]) {
        out.push(srcMatch[1].trim());
      }
      tagMatch = tagRe.exec(file.content);
    }
  }
  return out;
}

function extractStablePreviousImageSources(previousFiles: GeneratedFile[]): string[] {
  const sources = collectOrderedImgSources(previousFiles);
  const result: string[] = [];
  for (const src of sources) {
    if (!src) continue;
    if (PLACEHOLDER_RE.test(src)) continue;
    if (src.startsWith("data:") || src.startsWith("blob:")) continue;
    if (src.startsWith("./") || src.startsWith("../") || src.startsWith("/")) continue;
    result.push(src);
  }
  return result;
}

function lockExistingImageSourcesOnEdit(
  nextFiles: GeneratedFile[],
  previousFiles: GeneratedFile[],
): GeneratedFile[] {
  const previousSources = extractStablePreviousImageSources(previousFiles);
  if (previousSources.length === 0) return nextFiles;
  const supabaseHost = getSupabaseHost();

  let rollingIndex = 0;
  const replaceToken = (source: string): string => {
    const placeholderMatch = source.match(/^REPLICATE_IMG_(\d+)$/i);
    if (placeholderMatch) {
      const idx = Number.parseInt(placeholderMatch[1], 10) - 1;
      if (idx >= 0 && idx < previousSources.length) {
        return previousSources[idx];
      }
      const fallback = previousSources[Math.min(rollingIndex, previousSources.length - 1)];
      rollingIndex++;
      return fallback;
    }

    // If the model swapped in volatile generated/placeholder hosts during edit,
    // preserve prior visual continuity by reusing the previous stable source.
    if (shouldReplaceSource(source, supabaseHost)) {
      const fallback = previousSources[Math.min(rollingIndex, previousSources.length - 1)];
      rollingIndex++;
      return fallback;
    }

    return source;
  };

  return nextFiles.map((file) => {
    const nextContent = file.content.replace(
      /\bsrc\s*=\s*(?:\{)?["']([^"']+)["'](?:\})?/gi,
      (match, source: string) => {
        const replacement = replaceToken(source.trim());
        if (!replacement || replacement === source.trim()) return match;
        return match.replace(source, replacement);
      },
    );

    if (nextContent === file.content) return file;
    return { ...file, content: nextContent };
  });
}

function getReplicateOutputUrl(output: unknown): string {
  if (typeof output === "string" && output.startsWith("http")) {
    return output;
  }

  if (isUrlOutput(output)) {
    return String(output.url());
  }

  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === "string" && first.startsWith("http")) {
      return first;
    }
    if (isUrlOutput(first)) {
      return String(first.url());
    }
  }

  throw new Error(`Unexpected Replicate output type: ${typeof output}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function getErrorStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const err = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
    cause?: { status?: unknown; statusCode?: unknown };
  };

  const candidates = [
    err.status,
    err.statusCode,
    err.response?.status,
    err.cause?.status,
    err.cause?.statusCode,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return null;
}

function isRateLimitError(error: unknown): boolean {
  const statusCode = getErrorStatusCode(error);
  if (statusCode === 429) return true;

  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("quota exceeded") ||
    message.includes("status code 429") ||
    message.includes("429")
  );
}

async function generateReplicateImage(
  replicate: Replicate,
  prompt: string,
): Promise<string> {
  // Parse negative prompt if present
  const [positivePrompt, ...negativeParts] = prompt.split("Negative prompt:");
  const negativePrompt = negativeParts.join("Negative prompt:").trim();

  const input: Record<string, unknown> = {
    width: DEFAULT_IMAGE_WIDTH,
    height: DEFAULT_IMAGE_HEIGHT,
    prompt: positivePrompt.trim(),
  };

  // Add negative prompt if provided and model supports it
  if (negativePrompt && REPLICATE_MODEL.includes("flux")) {
    input.prompt = `${positivePrompt.trim()} --negative ${negativePrompt}`;
  }

  const output = await replicate.run(REPLICATE_MODEL, { input });
  return getReplicateOutputUrl(output);
}

async function generateReplicateImageWithRetry(args: {
  replicate: Replicate;
  prompt: string;
  source: string;
}): Promise<string> {
  const { replicate, prompt, source } = args;

  let attempt = 0;
  while (true) {
    try {
      return await generateReplicateImage(replicate, prompt);
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= MAX_RATE_LIMIT_RETRIES) {
        throw error;
      }

      attempt++;
      console.warn(
        `[persistGeneratedImagesToStorage] Rate limited for "${source}" (retry ${attempt}/${MAX_RATE_LIMIT_RETRIES}) - waiting ${RATE_LIMIT_RETRY_DELAY_MS / 1000}s...`,
      );
      await sleep(RATE_LIMIT_RETRY_DELAY_MS);
    }
  }
}

function extensionFromContentType(contentType: string): string {
  const lower = contentType.toLowerCase();
  if (lower.includes("png")) return "png";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("gif")) return "gif";
  if (lower.includes("svg")) return "svg";
  if (lower.includes("avif")) return "avif";
  return "jpg";
}

async function ensureBucketExists(bucket: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    throw new Error(`Failed to list buckets: ${error.message}`);
  }

  const exists = data.some((entry) => entry.name === bucket);
  if (exists) return;

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: true,
  });
  if (createError) {
    throw new Error(`Failed to create bucket "${bucket}": ${createError.message}`);
  }
}

async function uploadImageFromUrl(args: {
  imageUrl: string;
  userId: string;
  bucket: string;
  index: number;
}): Promise<string> {
  const { imageUrl, userId, bucket, index } = args;
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to download image: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const ext = extensionFromContentType(contentType);
  const bytes = Buffer.from(await res.arrayBuffer());
  const objectPath = `${userId}/generated/${Date.now()}-${index}-${crypto.randomUUID()}.${ext}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    upsert: false,
    contentType,
    cacheControl: "31536000",
  });
  if (error) {
    throw new Error(`Failed to upload image to storage: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}

function applyReplacements(
  files: GeneratedFile[],
  replacements: Map<string, string>,
): GeneratedFile[] {
  if (replacements.size === 0) return files;

  return files.map((file) => {
    let content = file.content;
    for (const [from, to] of replacements) {
      if (from === to) continue;
      content = content.split(from).join(to);
    }
    if (content === file.content) return file;
    return { ...file, content };
  });
}

export async function persistGeneratedImagesToStorage(
  files: GeneratedFile[],
  userId: string,
  options?: PersistImageOptions,
): Promise<GeneratedFile[]> {
  if (files.length === 0) return files;

  let nextFiles = files;
  if (options?.preserveExistingImages && options.previousFiles?.length) {
    nextFiles = lockExistingImageSourcesOnEdit(nextFiles, options.previousFiles);
  }

  // Prioritize AI-detected theme from prompt, fall back to code analysis
  const siteTheme = (options?.detectedTheme as SiteTheme) || detectSiteTheme(nextFiles);
  const isUserProvided = options?.isUserProvidedPrompt ?? false;
  const promptContext = options?.originalPrompt || "";

  console.log(`[Image Generation] Theme: "${siteTheme}" (${options?.detectedTheme ? 'from prompt' : 'from code'}), isUserProvided: ${isUserProvided}`);
  const refs = collectImageSources(nextFiles, siteTheme, isUserProvided);
  if (refs.size === 0) return nextFiles;
  console.log(`[persistGeneratedImagesToStorage] Found ${refs.size} images to generate`);

  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) {
    console.warn(
      "[persistGeneratedImagesToStorage] REPLICATE_API_TOKEN is not configured. Falling back to SVG placeholders.",
    );
    const fallbackReplacements = new Map<string, string>();
    let fallbackIndex = 0;
    for (const [source, prompt] of refs) {
      fallbackIndex++;
      fallbackReplacements.set(
        source,
        createFallbackImageDataUri(source, prompt, fallbackIndex),
      );
    }
    return applyReplacements(nextFiles, fallbackReplacements);
  }

  const bucket =
    process.env.SUPABASE_GENERATED_IMAGES_BUCKET ||
    process.env.SUPABASE_STORAGE_BUCKET ||
    "generated-images";

  await ensureBucketExists(bucket);

  const replicate = new Replicate({ auth: apiKey });
  const replacements = new Map<string, string>();
  const failedImages: Array<{ source: string; prompt: string; index: number; error: unknown }> = [];

  // First pass: Try to generate all images
  let index = 0;
  for (const [source, prompt] of refs) {
    index++;
    try {
      const generationPrompt = buildGenerationPrompt(
        source,
        prompt,
        index,
        siteTheme,
        isUserProvided,
      );

      console.log(`[persistGeneratedImagesToStorage] Generating image ${index}/${refs.size}: ${source}`);

      const replicateUrl = await generateReplicateImageWithRetry({
        replicate,
        prompt: generationPrompt,
        source,
      });
      const storedUrl = await uploadImageFromUrl({
        imageUrl: replicateUrl,
        userId,
        bucket,
        index,
      });
      replacements.set(source, storedUrl);
      console.log(`[persistGeneratedImagesToStorage] ✓ Successfully generated image ${index}/${refs.size}`);
    } catch (error) {
      console.error(
        `[persistGeneratedImagesToStorage] Failed image ${index}/${refs.size} for "${source}":`,
        error,
      );

      // If rate limited, add to retry queue instead of giving up
      if (isRateLimitError(error)) {
        console.warn(`[persistGeneratedImagesToStorage] Rate limited for "${source}", will retry later`);
        failedImages.push({ source, prompt, index, error });
      } else {
        // For non-rate-limit errors, use fallback
        console.warn(`[persistGeneratedImagesToStorage] Non-recoverable error for "${source}", using fallback`);
        replacements.set(source, createFallbackImageDataUri(source, prompt, index));
      }
    }
  }

  // Second pass: Retry rate-limited images with extended retries
  if (failedImages.length > 0) {
    console.log(
      `[persistGeneratedImagesToStorage] Retrying ${failedImages.length} rate-limited image(s) with extended delays...`,
    );

    for (const { source, prompt, index: imgIndex } of failedImages) {
      let retryCount = 0;
      const maxExtendedRetries = 10; // More aggressive retries for rate limits
      let success = false;

      while (retryCount < maxExtendedRetries && !success) {
        try {
          retryCount++;
          console.log(
            `[persistGeneratedImagesToStorage] Retry attempt ${retryCount}/${maxExtendedRetries} for "${source}"`,
          );

          // Wait 10 seconds before retry
          await sleep(RATE_LIMIT_RETRY_DELAY_MS);

          const generationPrompt = buildGenerationPrompt(
            source,
            prompt,
            imgIndex,
            siteTheme,
            isUserProvided,
          );

          const replicateUrl = await generateReplicateImageWithRetry({
            replicate,
            prompt: generationPrompt,
            source,
          });
          const storedUrl = await uploadImageFromUrl({
            imageUrl: replicateUrl,
            userId,
            bucket,
            index: imgIndex,
          });
          replacements.set(source, storedUrl);
          success = true;
          console.log(`[persistGeneratedImagesToStorage] ✓ Successfully generated "${source}" after ${retryCount} retries`);
        } catch (error) {
          console.error(
            `[persistGeneratedImagesToStorage] Retry ${retryCount} failed for "${source}":`,
            error,
          );

          if (!isRateLimitError(error) || retryCount >= maxExtendedRetries) {
            // Give up and use fallback
            console.warn(
              `[persistGeneratedImagesToStorage] Giving up on "${source}" after ${retryCount} retries, using fallback`,
            );
            replacements.set(source, createFallbackImageDataUri(source, prompt, imgIndex));
            break;
          }
        }
      }
    }
  }

  const totalImages = refs.size;
  const successfulImages = replacements.size;
  const fallbackImages = Array.from(replacements.values()).filter(url => url.startsWith("data:image/svg")).length;

  console.log(
    `[persistGeneratedImagesToStorage] Image generation complete: ${successfulImages}/${totalImages} generated (${fallbackImages} fallbacks)`,
  );

  return applyReplacements(nextFiles, replacements);
}
