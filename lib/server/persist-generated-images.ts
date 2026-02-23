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

/**
 * Enrich short/vague subject labels with concrete visual descriptions.
 * A context hint like "Dogs" or "For Cats" is too vague for an image model —
 * it needs specific visual details like breed, setting, lighting to produce
 * a relevant photograph instead of a random stock image.
 */
function enrichShortSubjectPrompt(subject: string): string {
  const text = subject.toLowerCase().trim();
  const wordCount = text.split(/\s+/).length;

  // If already detailed enough (4+ words), don't enrich
  if (wordCount >= 4) return subject;

  // Animal categories → describe a real photograph of that animal
  if (/\bdog|dogs|puppy|puppies\b/.test(text)) {
    return `a happy golden retriever dog sitting on a clean white background, professional pet photography, studio lighting, looking at camera`;
  }
  if (/\bcat|cats|kitten|kittens\b/.test(text)) {
    return `a beautiful tabby cat with green eyes sitting elegantly, professional pet photography, soft studio lighting, clean white background`;
  }
  if (/\bbird|birds|parrot|parakeet\b/.test(text)) {
    return `a colorful parrot perched on a natural branch, professional animal photography, bright studio lighting, clean background`;
  }
  if (/\bhamster|rabbit|bunny|guinea pig\b/.test(text)) {
    return `an adorable fluffy rabbit on a soft white surface, professional pet photography, gentle studio lighting`;
  }
  if (/\bpet|pets\b/.test(text)) {
    return `a cute golden retriever puppy and a tabby kitten together, professional pet photography, warm studio lighting, clean white background`;
  }

  // Food categories
  if (/\bpizza\b/.test(text)) {
    return `a freshly baked margherita pizza with melted mozzarella and fresh basil on a wooden board, warm restaurant lighting, overhead view`;
  }
  if (/\bburger|hamburger\b/.test(text)) {
    return `a gourmet beef burger with melted cheese, lettuce, and tomato on a brioche bun, dramatic side lighting, dark background`;
  }
  if (/\bsushi\b/.test(text)) {
    return `an elegant sushi platter with nigiri and maki rolls on a black slate plate, soft natural lighting, top-down view`;
  }
  if (/\bcoffee\b/.test(text)) {
    return `a latte art coffee in a ceramic cup on a wooden table with coffee beans scattered around, warm morning light, cafe setting`;
  }

  // If the subject is very short (1-2 words) and doesn't match known categories,
  // add basic photography qualifiers to help the model
  if (wordCount <= 2) {
    return `${subject}, professional photograph, studio lighting, clean background, high quality`;
  }

  return subject;
}

function resolvePrompt(
  source: string,
  altText?: string,
  contextHint?: string,
  siteTheme: SiteTheme = "generic",
  isUserProvided: boolean = false,
  globalContextHint?: string,
): string {
  const trimmedAlt = trimPrompt(altText || "");
  const trimmedContext = trimPrompt(contextHint || "");
  const trimmedGlobalContext = trimPrompt(globalContextHint || "");
  const themeDefault = getThemeDefaultPrompt(siteTheme);

  // If this is a user-provided prompt, use it directly without length requirements
  if (isUserProvided && trimmedAlt) {
    console.log(`[resolvePrompt] Using user-provided prompt directly: "${trimmedAlt}"`);
    return trimmedAlt;
  }

  // PRIORITY 1: Detailed alt text (10+ words) — best case, AI wrote a good description
  if (trimmedAlt && trimmedAlt.split(/\s+/).length >= 10) {
    console.log(`[resolvePrompt] P1 - detailed alt text (${trimmedAlt.split(/\s+/).length} words): "${trimmedAlt}"`);
    return trimmedAlt;
  }

  // PRIORITY 2: Shorter but specific alt text (not generic filler words)
  if (trimmedAlt && !GENERIC_IMAGE_PROMPT_RE.test(trimmedAlt) && trimmedAlt.length >= 10) {
    console.log(`[resolvePrompt] P2 - specific alt text: "${trimmedAlt}"`);
    // Combine alt text with context hint to make it more specific
    // e.g., alt="orthopedic bed" + context="Cloud-9 Orthopedic Bed" → richer prompt
    if (trimmedContext && !trimmedContext.toLowerCase().includes(trimmedAlt.toLowerCase())) {
      const combined = `${trimmedAlt}, ${trimmedContext}`;
      console.log(`[resolvePrompt]   → enriched with context: "${combined}"`);
      return combined;
    }
    return trimmedAlt;
  }

  // PRIORITY 3: Context from nearby headings/labels (e.g., product name, section title)
  // This is crucial for product cards where alt text may be generic but the card title is specific
  if (trimmedContext && trimmedContext.length >= 4) {
    console.log(`[resolvePrompt] P3 - context hint: "${trimmedContext}"`);

    // Enrich short category labels with visual descriptions so the image model
    // knows what to actually photograph. "Dogs" alone → the model might generate anything.
    // "Dogs" + enrichment → "a happy golden retriever dog, professional pet photography"
    const enriched = enrichShortSubjectPrompt(trimmedContext);

    // If we also have some alt text (even generic), combine them
    if (trimmedAlt && trimmedAlt.length >= 5) {
      const combined = `${enriched}, ${trimmedAlt}`;
      console.log(`[resolvePrompt]   → combined with alt: "${combined}"`);
      return combined;
    }

    return enriched;
  }

  // PRIORITY 4: Any alt text at all (even generic ones get enhanced below)
  if (trimmedAlt && trimmedAlt.length >= 5) {
    console.log(`[resolvePrompt] P4 - fallback alt text: "${trimmedAlt}"`);
    return trimmedAlt;
  }

  // PRIORITY 5: Theme defaults for placeholders
  if (PLACEHOLDER_RE.test(source)) {
    console.log(`[resolvePrompt] P5 - theme default for placeholder: "${themeDefault}"`);
    return themeDefault;
  }

  // LAST RESORT
  console.log(`[resolvePrompt] LAST RESORT - using theme default: "${themeDefault}"`);
  return themeDefault;
}

function extractContextHint(content: string, startIndex: number): string {
  // Search a tighter window — closer text is more likely to be the actual item name
  const from = Math.max(0, startIndex - 800);
  const to = Math.min(content.length, startIndex + 800);
  const snippet = content.slice(from, to);

  // Generic section labels that should be heavily penalized — these are NOT specific product names
  const genericSectionLabelRe =
    /\b(best sellers?|featured|trending|shop all|view all|new arrivals?|our products?|collections?|products?|services?|about us|learn more|read more|view details?|see all|explore)\b/i;

  // Price-like patterns indicate we're near a product card — boost nearby text
  const priceRe = /\$\d+|\d+\.\d{2}/;

  type Candidate = { text: string; absIndex: number; kind: "heading" | "attr" | "text" };
  const candidates: Candidate[] = [];

  const pushCandidate = (
    rawText: string | undefined,
    localIndex: number | undefined,
    kind: Candidate["kind"],
  ) => {
    if (!rawText || typeof localIndex !== "number") return;
    const cleaned = sanitizeVisualSubjectPrompt(trimPrompt(rawText));
    if (!cleaned || cleaned.length < 4) return;
    if (/^[\d\W_]+$/.test(cleaned)) return;
    // Skip prices, buttons, and very short generic text
    if (/^\$?\d+(\.\d+)?$/.test(cleaned)) return;
    candidates.push({ text: cleaned, absIndex: from + localIndex, kind });
  };

  // Extract headings — product names are often in <h3>, <h4> near product cards
  const headingRe = /<h([1-6])[^>]*>([^<]{3,160})<\/h\1>/gi;
  let headingMatch: RegExpExecArray | null = headingRe.exec(snippet);
  while (headingMatch) {
    pushCandidate(headingMatch[2], headingMatch.index, "heading");
    headingMatch = headingRe.exec(snippet);
  }

  // Extract label attributes
  const labelAttrRe =
    /\b(?:title|name|aria-label|product|service|category|collection|theme)\s*[:=]\s*["'`]([^"'`]{4,140})["'`]/gi;
  let labelMatch: RegExpExecArray | null = labelAttrRe.exec(snippet);
  while (labelMatch) {
    pushCandidate(labelMatch[1], labelMatch.index, "attr");
    labelMatch = labelAttrRe.exec(snippet);
  }

  // Extract text nodes (but only reasonably sized ones — skip single words and long paragraphs)
  const textNodeRe = />([^<]{4,80})</g;
  let textMatch: RegExpExecArray | null = textNodeRe.exec(snippet);
  while (textMatch) {
    pushCandidate(textMatch[1], textMatch.index, "text");
    textMatch = textNodeRe.exec(snippet);
  }

  if (candidates.length === 0) return "";

  const scoreCandidate = (c: Candidate): number => {
    const distance = Math.abs(c.absIndex - startIndex);
    // PROXIMITY IS KING: Closest text to the image is most likely its label/title.
    // Use a steep decay so nearby text dominates over distant headings.
    const distanceScore = Math.max(0, 3000 - distance * 3);
    const wordCount = c.text.split(/\s+/).length;
    // Sweet spot: 2-6 words (typical product name like "Cloud-9 Orthopedic Bed")
    const specificityScore = wordCount >= 2 && wordCount <= 8 ? 200 : Math.min(wordCount * 15, 100);
    // Attributes (title=, name=) are most specific, then headings, then text nodes
    const kindBonus = c.kind === "attr" ? 150 : c.kind === "heading" ? 100 : 30;
    // Heavily penalize generic section labels
    const genericPenalty = genericSectionLabelRe.test(c.text) ? 500 : 0;
    const longPenalty = c.text.length > 80 ? 100 : 0;
    // Bonus if nearby text contains a price (signals a product card context)
    const nearbySnippet = snippet.slice(
      Math.max(0, c.absIndex - from - 200),
      Math.min(snippet.length, c.absIndex - from + 200),
    );
    const productCardBonus = priceRe.test(nearbySnippet) ? 150 : 0;

    return distanceScore + specificityScore + kindBonus + productCardBonus - genericPenalty - longPenalty;
  };

  const best = candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate) }))
    .sort((a, b) => b.score - a.score)[0]?.candidate;

  if (!best) return "";
  console.log(`[extractContextHint] Best context (${best.kind}): "${best.text}"`);
  return best.text;
}

function extractPlaceholderNumber(source: string): number | null {
  const match = source.match(/REPLICATE_IMG_(\d+)/i);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
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

  // Pets/ecommerce product cards
  if (
    /\b(pet|pets|dog|dogs|cat|cats|bird|birds|hamster|rabbit|guinea pig|leash|harness|pet bed|cat tree|pet toy|pet food)\b/.test(
      text,
    )
  ) {
    return "clean e-commerce product photography, bright neutral background, sharp details, no people";
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

  // Default - keep it simple and object-focused
  return "clean, modern, natural lighting, subject-focused";
}

function deriveNegativePrompt(
  basePrompt: string,
  globalContextHint: string,
  siteTheme: SiteTheme,
): string {
  // These are things the image model must NEVER generate.
  // The collage/grid/text problem is the #1 issue, so always include these.
  const alwaysExclude = [
    "collage", "grid layout", "multiple images", "image grid", "mood board",
    "text", "labels", "captions", "watermarks", "logos", "words", "letters", "typography",
    "website screenshot", "app interface", "UI mockup", "wireframe",
    "clipart", "cartoon", "illustration", "drawing", "sketch", "icon set",
    "split screen", "side by side", "before and after", "comparison",
  ];

  const text = `${basePrompt} ${globalContextHint}`.toLowerCase();

  // Add domain-specific exclusions
  if (/\b(pet|dog|cat|bird|hamster|rabbit|leash|harness)\b/.test(text)) {
    alwaysExclude.push("humans", "office workers", "business portraits", "laptops", "phones");
  }

  if (/\b(food|dish|meal|restaurant|cuisine|chef)\b/.test(text)) {
    alwaysExclude.push("office workers", "business portraits", "laptops", "phones");
  }

  if (/\b(shop|store|e-?commerce|product|price|buy|cart)\b/.test(text)) {
    alwaysExclude.push("website screenshots", "app interfaces", "product grids");
  }

  return alwaysExclude.join(", ");
}

function buildGenerationPrompt(
  source: string,
  prompt: string,
  index: number,
  siteTheme: SiteTheme = "generic",
  isUserProvided: boolean = false,
  globalContextHint?: string,
  exclusionHint?: string,
): string {
  // If this is a user-provided prompt (from image regeneration), use it with minimal additions
  if (isUserProvided) {
    const userPrompt = trimPrompt(prompt);
    if (!userPrompt) {
      return `${getThemeDefaultPrompt(siteTheme)}, high quality, photorealistic`;
    }
    const minimalPrompt = `${userPrompt}. Single subject, photorealistic photograph. NEVER generate collage, grid, multiple images, text, labels, or clipart.`;
    const truncatedUserPrompt = minimalPrompt.slice(0, 500);
    console.log(`\n========== IMAGE PROMPT (User-Provided) [${source}] ==========`);
    console.log(`  Original input: "${userPrompt}"`);
    console.log(`  FINAL PROMPT → "${truncatedUserPrompt}"`);
    console.log(`=============================================================\n`);
    return truncatedUserPrompt;
  }

  // --- AUTO-GENERATED PROMPT CONSTRUCTION ---
  // The #1 principle: the prompt must describe a SPECIFIC, CONCRETE visual subject.
  // Never use abstract instructions like "matches the nearby context" — the image
  // model cannot read HTML. It needs a direct description of what to photograph.

  const base = sanitizeVisualSubjectPrompt(
    trimPrompt(prompt) || getThemeDefaultPrompt(siteTheme),
  );

  const contextGuard = trimPrompt(globalContextHint || "");
  const exclusionGuard = trimPrompt(exclusionHint || "");
  const negativePrompt = deriveNegativePrompt(base, contextGuard, siteTheme);
  const allExclusions = [negativePrompt, exclusionGuard].filter(Boolean).join(", ");

  // Determine the style based on content
  const simpleStyle = getSimpleStyleHint(base, siteTheme);

  // Build the prompt with the SUBJECT first, style second, negatives last.
  // This structure ensures the image model focuses on the actual subject.
  const finalPrompt = [
    // SUBJECT: The most important part — what to actually photograph
    base,
    // STYLE: How it should look
    simpleStyle,
    // QUALITY: Always enforce single-subject photorealism
    "single object in frame, photorealistic, professional photograph, studio quality",
    // HARD NEGATIVES: Prevent collage/grid/text — the most common failure mode
    `NEVER generate: ${allExclusions}`,
  ].join(". ");

  // Allow up to 500 chars for better prompt quality
  const truncatedPrompt = finalPrompt.slice(0, 500);

  console.log(`\n========== IMAGE PROMPT [${source}] ==========`);
  console.log(`  Base (subject):  "${base}"`);
  console.log(`  Style hint:      "${simpleStyle}"`);
  console.log(`  Negative prompt: "${allExclusions}"`);
  console.log(`  FINAL PROMPT →   "${truncatedPrompt}"`);
  console.log(`================================================\n`);

  return truncatedPrompt;
}

function deriveImageDomainHints(
  originalPrompt: string,
  files: GeneratedFile[],
  siteTheme: SiteTheme,
): { context: string; avoid: string } {
  const corpus = `${originalPrompt} ${files
    .slice(0, 25)
    .map((f) => f.content.slice(0, 1500))
    .join(" ")}`
    .toLowerCase();

  const has = (re: RegExp) => re.test(corpus);

  if (has(/\b(pet|pets|dog|dogs|cat|cats|puppy|kitten|leash|harness|vet|pet care)\b/)) {
    return {
      context:
        "pet e-commerce visuals only: animals and pet products aligned to each section (dogs/cats/birds/small pets), no humans",
      avoid:
        "corporate headshots, office workers, business portraits, laptops, phones, app UI mockups, unrelated electronics",
    };
  }

  if (has(/\b(food|restaurant|meal|dish|menu|chef|kitchen|recipe|cuisine)\b/)) {
    return {
      context:
        "food and dining visuals with dishes, ingredients, chefs, kitchens, and restaurant environments",
      avoid:
        "corporate portraits, office scenes, unrelated consumer electronics",
    };
  }

  if (has(/\b(fashion|clothing|apparel|outfit|style|boutique)\b/)) {
    return {
      context:
        "fashion visuals with clothing, accessories, runway/editorial styling, and retail product photography",
      avoid:
        "food scenes, unrelated office setups, random electronics unless fashion-tech is explicit",
    };
  }

  if (has(/\b(education|course|learning|student|teacher|academy|tutorial)\b/)) {
    return {
      context:
        "education visuals with learning environments, students, teachers, course materials, and study spaces",
      avoid:
        "unrelated product catalog shots, generic corporate portraits, random luxury objects",
    };
  }

  if (has(/\b(saas|software|startup|platform|dashboard|analytics|api|developer|code)\b/)) {
    return {
      context:
        "modern software and product visuals aligned with technology platforms and digital products",
      avoid:
        "food plating, fashion runways, unrelated pet imagery, random office portraits",
    };
  }

  if (siteTheme === "food") {
    return {
      context: "food-centric visuals aligned with culinary products and dining experiences",
      avoid: "generic office portraits and unrelated electronics",
    };
  }

  if (siteTheme === "fashion") {
    return {
      context: "fashion-centric visuals aligned with apparel and style products",
      avoid: "food scenes and unrelated office portraiture",
    };
  }

  return {
    context:
      "visuals strictly aligned with the website's stated business domain and section purpose",
    avoid: "unrelated people portraits, unrelated electronics, and off-topic stock imagery",
  };
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
  text = text.replace(
    /\b(?:navbar|nav bar|footer|header|hero section|cta|button|menu|shop all|view all|add to cart|wishlist|checkout|card grid|product grid)\b/gi,
    "",
  );

  // Clean up extra whitespace
  text = text.replace(/\s+/g, " ").trim();

  // If we removed too much and lost the meaning, return a sensible default
  if (!text || text.length < 5) {
    return DEFAULT_PROMPT;
  }

  // Only strip leading prepositions if they DON'T form a meaningful phrase.
  // "For Dogs" → keep as-is (meaningful category label)
  // "for the website" → strip "for the"
  // Check: if after stripping "for", the rest is a concrete noun/subject, keep the whole thing.
  const leadingPrepMatch = text.match(/^(?:a|an|the|of|with|in|on|at)\s+/i);
  if (leadingPrepMatch) {
    text = text.slice(leadingPrepMatch[0].length);
  }
  // Special handling for "for" — only strip if followed by generic words
  const forMatch = text.match(/^for\s+/i);
  if (forMatch) {
    const rest = text.slice(forMatch[0].length);
    // If what follows "for" is a concrete subject (animals, products, people), keep it
    if (/\b(dog|cat|bird|pet|kid|baby|men|women|home|kitchen|garden|car|sport)/i.test(rest)) {
      // Keep "For Dogs" as "Dogs", which is the actual subject
      text = rest;
    } else {
      text = rest;
    }
  }

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
  globalContextHint?: string,
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
            resolvePrompt(
              source,
              altMatch?.[1],
              contextHint,
              siteTheme,
              isUserProvided,
              globalContextHint,
            ),
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
              globalContextHint,
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
              globalContextHint,
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
              globalContextHint,
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
  // Split on "NEVER generate:" to extract negative constraints
  const neverSplit = prompt.split("NEVER generate:");
  const positivePrompt = neverSplit[0].trim();
  const negativeContent = neverSplit.length > 1 ? neverSplit[1].trim() : "";

  const input: Record<string, unknown> = {
    width: DEFAULT_IMAGE_WIDTH,
    height: DEFAULT_IMAGE_HEIGHT,
    prompt: positivePrompt,
  };

  // Some models support negative_prompt as a separate field
  if (negativeContent) {
    input.negative_prompt = negativeContent;
  }

  console.log(`[Replicate API] Model: "${REPLICATE_MODEL}"`);
  console.log(`[Replicate API] Positive prompt: "${positivePrompt}"`);
  if (negativeContent) {
    console.log(`[Replicate API] Negative prompt: "${negativeContent}"`);
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
  const domainHints = deriveImageDomainHints(promptContext, nextFiles, siteTheme);

  console.log(`[Image Generation] Theme: "${siteTheme}" (${options?.detectedTheme ? 'from prompt' : 'from code'}), isUserProvided: ${isUserProvided}`);
  console.log(
    `[Image Generation] Domain context: "${domainHints.context}" | Avoid: "${domainHints.avoid}"`,
  );
  const refs = collectImageSources(
    nextFiles,
    siteTheme,
    isUserProvided,
    domainHints.context,
  );
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
        domainHints.context,
        domainHints.avoid,
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
            domainHints.context,
            domainHints.avoid,
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
