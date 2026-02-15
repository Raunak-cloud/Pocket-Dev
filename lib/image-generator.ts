/**
 * Replicate AI image generation using prunaai/z-image-turbo.
 *
 * Pipeline:
 *   1. Templates emit <img src="REPLICATE_IMG_N" alt="detailed prompt …">
 *   2. After compilation, `resolveImagePlaceholders` / `injectImages`
 *      extracts every placeholder, fetches real images from Replicate
 *      sequentially, and replaces each src with the direct Replicate URL.
 *   3. Before an edit round-trip back to the LLM, `stripImagesForEdit`
 *      converts the Replicate URLs back to REPLICATE_IMG_N so the
 *      payload stays within token limits. The alt texts (which carry
 *      the generation prompt) are left untouched.
 */

import Replicate from "replicate";

const REPLICATE_MODEL = "prunaai/z-image-turbo";
const DEFAULT_IMAGE_SIZE = 768;

type UrlOutput = {
  url: () => string | URL;
};

function isUrlOutput(value: unknown): value is UrlOutput {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof (value as { url?: unknown }).url === "function"
  );
}

/** Gradient SVG used as a fallback when Replicate fails for one image. */
const FALLBACK_IMG =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">' +
      '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" stop-color="#667eea"/>' +
      '<stop offset="100%" stop-color="#764ba2"/>' +
      "</linearGradient></defs>" +
      '<rect width="800" height="600" fill="url(#g)"/>' +
      "</svg>",
  );

// ── prompt helper ─────────────────────────────────────────────

function enhancePrompt(raw: string): string {
  return `A photo of ${raw}, high quality, detailed, vibrant, professional photography`;
}

// ── logo generation ──────────────────────────────────────────

/**
 * Generate a professional logo for a business using Replicate.
 * Returns the image URL or null if generation fails.
 */
export async function generateLogo(
  businessName: string,
  industry: string,
  primaryColor: string,
): Promise<string | null> {
  const prompt =
    `Minimalist professional logo mark for "${businessName}", a ${industry} brand. ` +
    `Clean vector-style icon, ${primaryColor} color palette, flat design, ` +
    `transparent background, centered composition, modern and sleek, ` +
    `no text, no words, no letters, symbol only, logo design, high resolution`;

  console.log(`🎨 Generating logo for "${businessName}"...`);
  try {
    const url = await fetchImage(prompt);
    console.log(`✅ Logo generated: ${url.substring(0, 80)}...`);
    return url;
  } catch (err) {
    console.error(`⚠️ Logo generation failed:`, err);
    return null;
  }
}

// ── single image fetch ────────────────────────────────────────

/** Call Replicate prunaai/z-image-turbo and return the image URL. */
async function fetchImage(prompt: string): Promise<string> {
  const apiKey = process.env.REPLICATE_API_TOKEN;

  if (!apiKey) {
    console.error("REPLICATE_API_TOKEN not found! Cannot generate image.");
    throw new Error("REPLICATE_API_TOKEN not found");
  }

  const replicate = new Replicate({ auth: apiKey });
  const enhancedPrompt = enhancePrompt(prompt);

  console.log(
    `🎨 Generating image with prompt: "${enhancedPrompt.substring(0, 100)}..."`,
  );

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const output = await replicate.run(REPLICATE_MODEL, {
        input: {
          height: DEFAULT_IMAGE_SIZE,
          width: DEFAULT_IMAGE_SIZE,
          prompt: enhancedPrompt,
        },
      });

      // z-image-turbo returns a FileOutput with .url() method
      if (isUrlOutput(output)) {
        const url = String(output.url());
        console.log(`✅ Generated image: ${url.substring(0, 100)}...`);
        return url;
      }

      // Fallback: single string URL
      if (typeof output === "string" && (output as string).startsWith("http")) {
        console.log(`✅ Generated image: ${(output as string).substring(0, 100)}...`);
        return output as string;
      }

      // Fallback: array of URLs
      if (Array.isArray(output) && output.length > 0) {
        const url = String(output[0]);
        console.log(`✅ Generated image: ${url.substring(0, 100)}...`);
        return url;
      }

      console.error("Unexpected output format from Replicate:", typeof output);
      throw new Error(`Unexpected output format: ${typeof output}`);
    } catch (error: unknown) {
      // Retry on rate limit (429)
      const message =
        error instanceof Error ? error.message : String(error || "");
      if (message.includes("429") && attempt < maxRetries) {
        const waitSec = 10 * attempt;
        console.log(`⏳ Rate limited, waiting ${waitSec}s before retry ${attempt + 1}/${maxRetries}...`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        continue;
      }
      console.error(`Replicate generation error: ${message}`);
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

// ── placeholder extraction ───────────────────────────────────

interface Placeholder {
  key: string; // "REPLICATE_IMG_3"
  alt: string; // the detailed prompt text
}

/**
 * Walk every <img> tag in the HTML. Return one entry per unique
 * REPLICATE_IMG_N key, in document order.
 */
function extractPlaceholders(html: string): Placeholder[] {
  const imgRe = /<img[^>]*>/gi;
  const seen = new Set<string>();
  const out: Placeholder[] = [];
  let tag;

  while ((tag = imgRe.exec(html)) !== null) {
    const srcM = tag[0].match(/src=["'](REPLICATE_IMG_\d+)["']/i);
    if (!srcM || seen.has(srcM[1])) continue;
    seen.add(srcM[1]);

    const altM = tag[0].match(/alt=["']([^"']*)["']/i);
    out.push({
      key: srcM[1],
      alt: altM ? altM[1] : "a professional photograph",
    });
  }

  return out;
}

// ── public API ────────────────────────────────────────────────

/**
 * Given a list of {key, alt} pairs, generate images in parallel
 * and return a Map of key → image URL. Failed images get a
 * gradient SVG fallback.
 */
export async function resolveImagePlaceholders(
  placeholders: { key: string; alt: string }[],
  existingCache?: Record<string, string>,
): Promise<Map<string, string>> {
  if (placeholders.length === 0) return new Map();

  console.log(`🎨 Resolving ${placeholders.length} image placeholders via Replicate (sequential)`);

  const urlMap = new Map<string, string>();

  // Generate images sequentially to avoid rate limits
  for (let i = 0; i < placeholders.length; i++) {
    const { key, alt } = placeholders[i];

    // Check cache first — skip Replicate if description unchanged
    if (existingCache && existingCache[alt]) {
      console.log(`🎨 Image ${i + 1}/${placeholders.length}: ${key} — cached ✅`);
      urlMap.set(key, existingCache[alt]);
      continue;
    }

    console.log(`🎨 Image ${i + 1}/${placeholders.length}: ${key}`);
    try {
      const url = await fetchImage(alt);
      urlMap.set(key, url);
    } catch {
      console.log(`⚠️ Failed to generate ${key}, using fallback`);
      urlMap.set(key, FALLBACK_IMG);
    }
  }

  return urlMap;
}

/**
 * Find every REPLICATE_IMG_N placeholder, generate images in
 * parallel via Replicate, and return the HTML with every
 * placeholder replaced by the direct Replicate URL.
 * Images that fail individually fall back to a gradient SVG —
 * the rest of the page is unaffected.
 */
export async function injectImages(html: string): Promise<string> {
  console.log("🔍 Checking for image placeholders in HTML...");
  const placeholders = extractPlaceholders(html);

  if (placeholders.length === 0) {
    console.warn("⚠️  No REPLICATE_IMG placeholders found in HTML!");
    console.warn(
      "💡 Gemini may not have included images. Check if HTML has <img> tags.",
    );

    // Check if there are any img tags at all
    const hasImgTags = /<img[^>]*>/i.test(html);
    if (!hasImgTags) {
      console.warn("❌ No <img> tags found in HTML at all!");
    } else {
      console.warn(
        "⚠️  Found <img> tags but they don't use REPLICATE_IMG placeholders",
      );
      // Log what src values are being used
      const imgTags = html.match(/<img[^>]*src=["']([^"']*)["'][^>]*>/gi);
      if (imgTags) {
        console.log("Found img tags with these src values:");
        imgTags.forEach((tag, i) => {
          const srcMatch = tag.match(/src=["']([^"']*)["']/);
          if (srcMatch) {
            console.log(`  ${i + 1}. src="${srcMatch[1]}"`);
          }
        });
      }
    }
    return html;
  }

  console.log(`🎨 Found ${placeholders.length} REPLICATE_IMG placeholders:`);
  placeholders.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.key} - "${p.alt.substring(0, 80)}..."`);
  });
  console.log(`🎨 Generating images with Replicate...`);

  // Sequential fetch to avoid rate limits — failures fall back per-image
  const imageUrls: string[] = [];
  for (const { alt } of placeholders) {
    try {
      imageUrls.push(await fetchImage(alt));
    } catch {
      imageUrls.push(FALLBACK_IMG);
    }
  }

  // Replace in the HTML. split/join avoids the $ special-char
  // pitfalls of String.replace with dynamic replacement strings.
  let out = html;
  placeholders.forEach(({ key }, i) => {
    out = out.split(`src="${key}"`).join(`src="${imageUrls[i]}"`);
    out = out.split(`src='${key}'`).join(`src="${imageUrls[i]}"`);
  });

  return out;
}

/**
 * Reverse of injectImages: replace every Replicate URL
 * back to a sequentially-numbered REPLICATE_IMG_N placeholder.
 * Alt attributes (which carry the generation prompt) are left intact.
 * Use this before sending HTML back to Claude for an edit so the
 * payload doesn't blow the token budget.
 */
export function stripImagesForEdit(html: string): Promise<string> {
  let n = 1;
  const stripped = html.replace(
    /src=["'](https:\/\/(?:replicate\.delivery|pbxt\.replicate\.delivery)[^"']+)["']/gi,
    () => {
      return `src="REPLICATE_IMG_${n++}"`;
    },
  );
  return Promise.resolve(stripped);
}
