/**
 * Pollinations AI image generation.
 *
 * Pipeline:
 *   1. Claude emits <img src="POLLINATIONS_IMG_N" alt="detailed prompt …">
 *   2. After linting passes, `injectImages` extracts every placeholder,
 *      fetches real images from Pollinations in parallel, and replaces
 *      each src with an inline base64 data-URL so the HTML stays
 *      fully self-contained.
 *   3. Before an edit round-trip back to Claude, `stripImagesForEdit`
 *      converts the base64 URLs back to POLLINATIONS_IMG_N so the
 *      payload stays within token limits.  The alt texts (which carry
 *      the generation prompt) are left untouched.
 */

const POLLINATIONS_BASE = "https://gen.pollinations.ai/image";

/** Gradient SVG used as a fallback when Pollinations fails for one image. */
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
  return `${raw}, high quality, detailed, vibrant`;
}

// ── single image fetch ────────────────────────────────────────

/** Call Pollinations and return the image as a base64 data-URL. */
async function fetchImage(prompt: string): Promise<string> {
  const url =
    POLLINATIONS_BASE +
    "/" +
    encodeURIComponent(enhancePrompt(prompt)) +
    "?model=flux";

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}` },
  });

  if (!res.ok) throw new Error(`Pollinations ${res.status}`);

  const buf = await res.arrayBuffer();
  const mime = (res.headers.get("content-type") || "image/png").split(";")[0];
  return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
}

// ── placeholder extraction ───────────────────────────────────

interface Placeholder {
  key: string; // "POLLINATIONS_IMG_3"
  alt: string; // the detailed prompt text
}

/**
 * Walk every <img> tag in the HTML.  Return one entry per unique
 * POLLINATIONS_IMG_N key, in document order.
 */
function extractPlaceholders(html: string): Placeholder[] {
  const imgRe = /<img[^>]*>/gi;
  const seen = new Set<string>();
  const out: Placeholder[] = [];
  let tag;

  while ((tag = imgRe.exec(html)) !== null) {
    const srcM = tag[0].match(/src=["'](POLLINATIONS_IMG_\d+)["']/i);
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
 * Find every POLLINATIONS_IMG_N placeholder, generate images in
 * parallel via Pollinations, and return the HTML with every
 * placeholder replaced by an inline base64 data-URL.
 * Images that fail individually fall back to a gradient SVG —
 * the rest of the page is unaffected.
 */
export async function injectImages(html: string): Promise<string> {
  const placeholders = extractPlaceholders(html);
  if (placeholders.length === 0) return html;

  // Parallel fetch — failures are caught per-image
  const dataUrls = await Promise.all(
    placeholders.map(({ alt }) => fetchImage(alt).catch(() => FALLBACK_IMG)),
  );

  // Replace in the HTML.  split/join avoids the $ special-char
  // pitfalls of String.replace with dynamic replacement strings.
  let out = html;
  placeholders.forEach(({ key }, i) => {
    out = out.split(`src="${key}"`).join(`src="${dataUrls[i]}"`);
    out = out.split(`src='${key}'`).join(`src="${dataUrls[i]}"`);
  });

  return out;
}

/**
 * Reverse of injectImages: replace every inline base64 image src
 * back to a sequentially-numbered POLLINATIONS_IMG_N placeholder.
 * Alt attributes (which carry the generation prompt) are left intact.
 * Use this before sending HTML back to Claude for an edit so the
 * payload doesn't blow the token budget.
 */
export function stripImagesForEdit(html: string): string {
  let n = 1;
  return html.replace(/src=["']data:image[^"']*["']/gi, () => {
    return `src="POLLINATIONS_IMG_${n++}"`;
  });
}
