import crypto from "node:crypto";
import Replicate from "replicate";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SiteTheme } from "@/app/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface PersistImageOptions {
  previousFiles?: GeneratedFile[];
  preserveExistingImages?: boolean;
  isUserProvidedPrompt?: boolean;
  originalPrompt?: string;
  detectedTheme?: SiteTheme;
}

type UrlOutput = {
  url: () => string | URL;
};

type ReplicateModelName =
  | `${string}/${string}`
  | `${string}/${string}:${string}`;

export type AspectRatio = "square" | "landscape" | "portrait" | "wide";

export interface ImageReference {
  source: string;
  altText: string | null;
  filePath: string;
  surroundingContext: string;
  sourceType: "img-tag" | "css-url" | "placeholder" | "remote-url";
  index: number;
}

export interface ImagePromptResult {
  source: string;
  prompt: string;
  aspectRatio: AspectRatio;
}

export interface ImageGenConfig {
  replicateModel: ReplicateModelName;
  defaultWidth: number;
  defaultHeight: number;
  concurrencyLimit: number;
  enableLlmPromptEnhancement: boolean;
  maxRetries: number;
  retryDelayMs: number;
}

// ─── Regex Constants (kept for source detection) ─────────────────────────────

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

// ─── Configuration ───────────────────────────────────────────────────────────

export function resolveImageGenConfig(): ImageGenConfig {
  return {
    replicateModel: (process.env.REPLICATE_IMAGE_MODEL ||
      "prunaai/z-image-turbo") as ReplicateModelName,
    defaultWidth: parseInt(process.env.IMAGE_WIDTH || "1024", 10),
    defaultHeight: parseInt(process.env.IMAGE_HEIGHT || "1024", 10),
    concurrencyLimit: parseInt(process.env.IMAGE_CONCURRENCY_LIMIT || "4", 10),
    enableLlmPromptEnhancement:
      process.env.DISABLE_LLM_PROMPT_ENHANCEMENT !== "true",
    maxRetries: parseInt(process.env.IMAGE_MAX_RETRIES || "5", 10),
    retryDelayMs: parseInt(process.env.IMAGE_RETRY_DELAY_MS || "10000", 10),
  };
}

export function getAspectRatioDimensions(
  aspectRatio: AspectRatio,
  config: ImageGenConfig,
): { width: number; height: number } {
  switch (aspectRatio) {
    case "wide":
      return { width: 1216, height: 832 };
    case "landscape":
      return { width: 1152, height: 896 };
    case "portrait":
      return { width: 896, height: 1152 };
    case "square":
    default:
      return { width: config.defaultWidth, height: config.defaultHeight };
  }
}

// ─── Supabase Helpers ────────────────────────────────────────────────────────

function getSupabaseHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isSupabaseStorageUrl(
  source: string,
  supabaseHost: string | null,
): boolean {
  if (!supabaseHost || !REMOTE_URL_RE.test(source)) return false;
  try {
    const url = new URL(source);
    return url.hostname.toLowerCase() === supabaseHost;
  } catch {
    return false;
  }
}

// ─── Source Detection ────────────────────────────────────────────────────────

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

function shouldReplaceSource(
  source: string,
  supabaseHost: string | null,
): boolean {
  if (!source) return false;
  if (PLACEHOLDER_RE.test(source)) return true;
  // Treat /api/placeholder/... as a replaceable placeholder (AI sometimes generates these)
  if (source.startsWith("/api/placeholder")) return true;
  if (
    source.startsWith("/") ||
    source.startsWith("./") ||
    source.startsWith("../")
  ) {
    return false;
  }
  if (
    source.startsWith("data:") ||
    source.startsWith("blob:") ||
    source.startsWith("#")
  ) {
    return false;
  }
  if (!REMOTE_URL_RE.test(source)) return false;
  if (isSupabaseStorageUrl(source, supabaseHost)) return false;
  return isLikelyImageUrl(source);
}

// ─── Image Reference Collection (raw data, no prompt resolution) ─────────────

function extractSurroundingContext(
  content: string,
  matchIndex: number,
): string {
  const from = Math.max(0, matchIndex - 500);
  const to = Math.min(content.length, matchIndex + 500);
  return content.slice(from, to);
}

export function collectImageReferences(
  files: GeneratedFile[],
): ImageReference[] {
  const refs: ImageReference[] = [];
  const seenSources = new Set<string>();
  const supabaseHost = getSupabaseHost();
  let globalIndex = 0;

  for (const file of files) {
    const content = file.content;

    // Scan <img> and <Image> tags
    const tagRe = /<(?:img|Image)\b[^>]*>/gim;
    let tagMatch: RegExpExecArray | null = tagRe.exec(content);
    while (tagMatch) {
      const tag = tagMatch[0];
      const srcMatch = tag.match(/\bsrc\s*=\s*(?:\{)?["']([^"']+)["'](?:\})?/i);
      if (srcMatch) {
        const source = srcMatch[1].trim();
        if (
          shouldReplaceSource(source, supabaseHost) &&
          !seenSources.has(source)
        ) {
          seenSources.add(source);
          globalIndex++;
          const altMatch = tag.match(
            /\balt\s*=\s*(?:\{)?["']([^"']*)["'](?:\})?/i,
          );
          refs.push({
            source,
            altText: altMatch?.[1] ?? null,
            filePath: file.path,
            surroundingContext: extractSurroundingContext(
              content,
              tagMatch.index,
            ),
            sourceType: "img-tag",
            index: globalIndex,
          });
        }
      }
      tagMatch = tagRe.exec(content);
    }

    // Scan CSS url() references
    const cssUrlRe = /url\(\s*["']?(https?:\/\/[^"')\s]+)["']?\s*\)/gi;
    let cssMatch: RegExpExecArray | null = cssUrlRe.exec(content);
    while (cssMatch) {
      const source = cssMatch[1];
      if (
        shouldReplaceSource(source, supabaseHost) &&
        !seenSources.has(source)
      ) {
        seenSources.add(source);
        globalIndex++;
        refs.push({
          source,
          altText: null,
          filePath: file.path,
          surroundingContext: extractSurroundingContext(
            content,
            cssMatch.index,
          ),
          sourceType: "css-url",
          index: globalIndex,
        });
      }
      cssMatch = cssUrlRe.exec(content);
    }

    // Scan REPLICATE_IMG_N placeholders
    const placeholderRe = /REPLICATE_IMG_\d+/gi;
    let placeholderMatch: RegExpExecArray | null = placeholderRe.exec(content);
    while (placeholderMatch) {
      const source = placeholderMatch[0];
      if (!seenSources.has(source)) {
        seenSources.add(source);
        globalIndex++;
        refs.push({
          source,
          altText: null,
          filePath: file.path,
          surroundingContext: extractSurroundingContext(
            content,
            placeholderMatch.index,
          ),
          sourceType: "placeholder",
          index: globalIndex,
        });
      }
      placeholderMatch = placeholderRe.exec(content);
    }

    // Scan remaining remote URLs
    const remoteUrlRe = /https?:\/\/[^\s"'`)<>\]{}]+/g;
    let urlMatch: RegExpExecArray | null = remoteUrlRe.exec(content);
    while (urlMatch) {
      const source = urlMatch[0].replace(/[),.;]+$/, "");
      if (
        shouldReplaceSource(source, supabaseHost) &&
        !seenSources.has(source)
      ) {
        seenSources.add(source);
        globalIndex++;
        refs.push({
          source,
          altText: null,
          filePath: file.path,
          surroundingContext: extractSurroundingContext(
            content,
            urlMatch.index,
          ),
          sourceType: "remote-url",
          index: globalIndex,
        });
      }
      urlMatch = remoteUrlRe.exec(content);
    }
  }

  return refs;
}

// ─── LLM-Powered Prompt Generation ──────────────────────────────────────────

const IMAGE_PROMPT_SYSTEM = `You are an expert photography director and AI image prompt engineer. Your job is to create optimal prompts for an AI image generation model (SDXL-based) that will produce photorealistic images for a website.

CONTEXT:
You will receive information about a website being built, including:
- The user's original request describing what website they want
- A detected theme/category hint (may be "generic")
- A collection of images needed for the website, each with:
  - The image's alt text (written as a photographer's brief by another AI)
  - The surrounding HTML/code context showing where the image appears
  - The source type (img tag, CSS background, placeholder, etc.)

YOUR TASK:
For each image, generate a single, highly effective prompt for the SDXL image model. Also determine the best aspect ratio based on the image's role in the page.

PROMPT WRITING RULES:
1. Each prompt must be 30-80 words describing a single photorealistic image.
2. Structure: [Specific Subject] + [Scene/Setting] + [Photography Style] + [Lighting] + [Composition Details]
3. Be hyper-specific: materials, colors, textures, exact items, arrangement.
4. Include photography technique: lens type, depth of field, camera angle.
5. Include lighting direction: "warm golden hour", "soft diffused studio", etc.
6. Every image prompt must be UNIQUE — no two images should produce similar results.
7. The prompt must match the website's domain and the image's specific role on the page.
8. NEVER include text, logos, watermarks, UI elements, screenshots, or collages in prompts.
9. NEVER use generic terms like "professional photo" or "high quality image" as the main subject.
10. If the alt text is already a detailed photographer's brief (20+ words with specific subjects), enhance it but preserve its core intent.
11. If the alt text is generic or short, use the surrounding context and website purpose to infer what image would be most appropriate.
12. For tech/blockchain/SaaS/AI sites: use abstract conceptual visuals (glowing shields, data streams, geometric networks) rather than photographs of people for feature illustrations.
13. For food/restaurant sites: describe specific dishes with ingredients, plating style, and ambiance.
14. For e-commerce: describe exact products with material, color, shape, and lifestyle usage context.

ASPECT RATIO SELECTION:
- "square" (1024x1024): Product shots, profile photos, card images, icons, grid items
- "landscape" (1152x896): Standard sections, feature images, blog thumbnails
- "wide" (1216x832): Hero sections, banners, full-width backgrounds, cover images
- "portrait" (896x1152): Mobile-oriented content, tall cards, person-focused images

OUTPUT FORMAT:
Return a JSON array. Each element must have exactly these fields:
{
  "source": "<exact source string from input — copy it verbatim>",
  "prompt": "<your optimized image generation prompt>",
  "aspectRatio": "square" | "landscape" | "portrait" | "wide"
}

Return ONLY the JSON array, no other text.`;

export function buildSiteContentSample(files: GeneratedFile[]): string {
  const prioritized = [...files].sort((a, b) => {
    const priority = (path: string) => {
      if (path.includes("page.tsx") || path.includes("page.jsx")) return 0;
      if (path.includes("layout.tsx") || path.includes("layout.jsx")) return 1;
      if (path.includes("component")) return 2;
      return 3;
    };
    return priority(a.path) - priority(b.path);
  });

  const textContent = prioritized
    .slice(0, 10)
    .map((f) => {
      const textNodes: string[] = [];
      const textRe = />([^<]{5,200})</g;
      let m: RegExpExecArray | null;
      while ((m = textRe.exec(f.content)) !== null) {
        const text = m[1].trim();
        if (text.length >= 5 && !/^[{}\[\]()=><]/.test(text)) {
          textNodes.push(text);
        }
      }
      return textNodes.length > 0
        ? `[${f.path}]: ${textNodes.slice(0, 20).join(" | ")}`
        : "";
    })
    .filter(Boolean)
    .join("\n");

  return textContent.slice(0, 3000);
}

function buildImagePromptUserMessage(
  refs: ImageReference[],
  options: {
    originalPrompt: string;
    detectedTheme?: string;
    siteContentSample: string;
    isUserProvidedPrompt: boolean;
  },
): string {
  const imageDescriptions = refs
    .map((ref, i) => {
      const cleanContext = ref.surroundingContext
        .replace(/className\s*=\s*["'][^"']*["']/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 400);

      return `IMAGE ${i + 1}:
- Source: ${ref.source}
- Alt text: ${ref.altText || "(none)"}
- Found in: ${ref.filePath}
- Source type: ${ref.sourceType}
- Surrounding context: ${cleanContext}`;
    })
    .join("\n\n");

  return `WEBSITE PURPOSE:
${options.originalPrompt || "(not specified)"}

DETECTED THEME: ${options.detectedTheme || "generic"}

${options.isUserProvidedPrompt ? "NOTE: The user explicitly provided image descriptions. Preserve their intent closely while enhancing for image generation quality.\n" : ""}SITE CONTENT SAMPLE (for understanding overall design):
${options.siteContentSample}

IMAGES TO GENERATE (${refs.length} total):

${imageDescriptions}

Generate optimized prompts for each image. Return JSON array only.`;
}

export function fallbackPromptGeneration(
  refs: ImageReference[],
): ImagePromptResult[] {
  return refs.map((ref) => ({
    source: ref.source,
    prompt:
      ref.altText && ref.altText.length >= 10
        ? `${ref.altText}, photorealistic, professional photography, natural lighting`
        : "High-quality professional photograph, clean composition, natural lighting, well-lit scene",
    aspectRatio: "square" as const,
  }));
}

export async function generateImagePrompts(
  refs: ImageReference[],
  options: {
    originalPrompt: string;
    detectedTheme?: string;
    isUserProvidedPrompt: boolean;
    siteContentSample: string;
  },
): Promise<ImagePromptResult[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn(
      "[Image Pipeline] GEMINI_API_KEY not configured, using fallback prompts",
    );
    return fallbackPromptGeneration(refs);
  }

  // Batch large sets to avoid overwhelming the LLM context
  const BATCH_SIZE = 12;
  if (refs.length > BATCH_SIZE) {
    const allResults: ImagePromptResult[] = [];
    for (let i = 0; i < refs.length; i += BATCH_SIZE) {
      const batch = refs.slice(i, i + BATCH_SIZE);
      const batchResults = await generateImagePromptsBatch(
        batch,
        options,
        apiKey,
      );
      allResults.push(...batchResults);
    }
    return allResults;
  }

  return generateImagePromptsBatch(refs, options, apiKey);
}

async function generateImagePromptsBatch(
  refs: ImageReference[],
  options: {
    originalPrompt: string;
    detectedTheme?: string;
    isUserProvidedPrompt: boolean;
    siteContentSample: string;
  },
  apiKey: string,
): Promise<ImagePromptResult[]> {
  try {
    const gemini = new GoogleGenerativeAI(apiKey);
    const model = gemini.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    });

    const userMessage = buildImagePromptUserMessage(refs, options);

    console.log(
      `[Image Pipeline] Generating prompts for ${refs.length} images via Gemini...`,
    );

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: `${IMAGE_PROMPT_SYSTEM}\n\n${userMessage}` }],
        },
      ],
    });

    const responseText = result.response.text().trim();
    const parsed = JSON.parse(responseText) as Array<{
      source?: string;
      prompt?: string;
      aspectRatio?: string;
    }>;

    if (!Array.isArray(parsed)) {
      throw new Error("LLM response is not a JSON array");
    }

    // Validate and map results
    const validAspectRatios = new Set<string>([
      "square",
      "landscape",
      "portrait",
      "wide",
    ]);
    const resultMap = new Map<string, ImagePromptResult>();

    for (const item of parsed) {
      if (!item.source || !item.prompt) continue;
      resultMap.set(item.source, {
        source: item.source,
        prompt: item.prompt.slice(0, 500),
        aspectRatio: validAspectRatios.has(item.aspectRatio || "")
          ? (item.aspectRatio as AspectRatio)
          : "square",
      });
    }

    // Fill in any missing images with fallback
    const results: ImagePromptResult[] = [];
    for (const ref of refs) {
      const llmResult = resultMap.get(ref.source);
      if (llmResult) {
        results.push(llmResult);
      } else {
        console.warn(
          `[Image Pipeline] LLM missed source "${ref.source}", using fallback`,
        );
        results.push(fallbackPromptGeneration([ref])[0]);
      }
    }

    console.log(
      `[Image Pipeline] LLM generated ${resultMap.size}/${refs.length} prompts successfully`,
    );
    return results;
  } catch (error) {
    console.error("[Image Pipeline] LLM prompt generation failed:", error);
    console.warn("[Image Pipeline] Falling back to raw alt text prompts");
    return fallbackPromptGeneration(refs);
  }
}

// ─── Concurrency Limiter ─────────────────────────────────────────────────────

function createConcurrencyLimiter(limit: number) {
  let activeCount = 0;
  const queue: Array<() => void> = [];

  return function <T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const execute = async () => {
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        } finally {
          activeCount--;
          if (queue.length > 0) {
            activeCount++;
            queue.shift()!();
          }
        }
      };

      if (activeCount < limit) {
        activeCount++;
        execute();
      } else {
        queue.push(execute);
      }
    });
  };
}

// ─── Replicate Image Generation ──────────────────────────────────────────────

function isUrlOutput(value: unknown): value is UrlOutput {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof (value as { url?: unknown }).url === "function"
  );
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
  options: {
    width: number;
    height: number;
    model: ReplicateModelName;
  },
): Promise<string> {
  const input: Record<string, unknown> = {
    width: options.width,
    height: options.height,
    prompt,
  };

  console.log(
    `[Replicate API] Model: "${options.model}" (${options.width}x${options.height})`,
  );
  console.log(`[Replicate API] Prompt: "${prompt.slice(0, 150)}..."`);

  const output = await replicate.run(options.model, { input });
  return getReplicateOutputUrl(output);
}

export async function generateReplicateImageWithRetry(args: {
  replicate: Replicate;
  prompt: string;
  source: string;
  width: number;
  height: number;
  model: ReplicateModelName;
  maxRetries: number;
  retryDelayMs: number;
}): Promise<string> {
  const {
    replicate,
    prompt,
    source,
    width,
    height,
    model,
    maxRetries,
    retryDelayMs,
  } = args;

  let attempt = 0;
  while (true) {
    try {
      return await generateReplicateImage(replicate, prompt, {
        width,
        height,
        model,
      });
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= maxRetries) {
        throw error;
      }

      attempt++;
      const backoffMs =
        retryDelayMs * Math.pow(1.5, attempt) + Math.random() * 3000;
      console.warn(
        `[Image Pipeline] Rate limited for "${source}" (retry ${attempt}/${maxRetries}) - waiting ${Math.round(backoffMs / 1000)}s...`,
      );
      await sleep(backoffMs);
    }
  }
}

// ─── Parallel Image Generation ───────────────────────────────────────────────

async function generateImagesInParallel(
  prompts: ImagePromptResult[],
  config: ImageGenConfig,
  userId: string,
  bucket: string,
): Promise<Map<string, string>> {
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });
  const replacements = new Map<string, string>();
  const limiter = createConcurrencyLimiter(config.concurrencyLimit);

  const results = await Promise.allSettled(
    prompts.map((item, i) =>
      limiter(async () => {
        const dimensions = getAspectRatioDimensions(item.aspectRatio, config);

        console.log(
          `[Image Pipeline] Generating ${i + 1}/${prompts.length}: ${item.source} (${item.aspectRatio})`,
        );

        const replicateUrl = await generateReplicateImageWithRetry({
          replicate,
          prompt: item.prompt,
          source: item.source,
          width: dimensions.width,
          height: dimensions.height,
          model: config.replicateModel,
          maxRetries: config.maxRetries,
          retryDelayMs: config.retryDelayMs,
        });

        const storedUrl = await uploadImageFromUrl({
          imageUrl: replicateUrl,
          userId,
          bucket,
          index: i + 1,
        });

        return { source: item.source, url: storedUrl };
      }),
    ),
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      replacements.set(result.value.source, result.value.url);
      console.log(`[Image Pipeline] Generated ${i + 1}/${prompts.length}`);
    } else {
      console.error(
        `[Image Pipeline] Failed ${i + 1}/${prompts.length} for "${prompts[i].source}":`,
        result.reason,
      );
      replacements.set(
        prompts[i].source,
        createFallbackImageDataUri(prompts[i].source, prompts[i].prompt, i + 1),
      );
    }
  }

  return replacements;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

function extensionFromContentType(contentType: string): string {
  const lower = contentType.toLowerCase();
  if (lower.includes("png")) return "png";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("gif")) return "gif";
  if (lower.includes("svg")) return "svg";
  if (lower.includes("avif")) return "avif";
  return "jpg";
}

export async function ensureBucketExists(bucket: string) {
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
    throw new Error(
      `Failed to create bucket "${bucket}": ${createError.message}`,
    );
  }
}

export async function uploadImageFromUrl(args: {
  imageUrl: string;
  userId: string;
  bucket: string;
  index: number;
}): Promise<string> {
  const { imageUrl, userId, bucket, index } = args;
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(
      `Failed to download image: ${res.status} ${res.statusText}`,
    );
  }

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const ext = extensionFromContentType(contentType);
  const bytes = Buffer.from(await res.arrayBuffer());
  const objectPath = `${userId}/generated/${Date.now()}-${index}-${crypto.randomUUID()}.${ext}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, bytes, {
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

// ─── Fallback SVG ────────────────────────────────────────────────────────────

export function createFallbackImageDataUri(
  source: string,
  prompt: string,
  index: number,
): string {
  const seed = `${source}:${index}:${prompt}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }

  const hueA = Math.abs(hash) % 360;
  const hueB = (hueA + 72) % 360;
  const hueC = (hueA + 144) % 360;
  const label = (prompt || `Image ${index}`)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
  const safeLabel = label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

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

// ─── Edit Preservation ───────────────────────────────────────────────────────

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

function extractStablePreviousImageSources(
  previousFiles: GeneratedFile[],
): string[] {
  const sources = collectOrderedImgSources(previousFiles);
  const result: string[] = [];
  for (const src of sources) {
    if (!src) continue;
    if (PLACEHOLDER_RE.test(src)) continue;
    if (src.startsWith("data:") || src.startsWith("blob:")) continue;
    if (src.startsWith("./") || src.startsWith("../") || src.startsWith("/"))
      continue;
    result.push(src);
  }
  return result;
}

export function lockExistingImageSourcesOnEdit(
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
      const fallback =
        previousSources[Math.min(rollingIndex, previousSources.length - 1)];
      rollingIndex++;
      return fallback;
    }

    if (shouldReplaceSource(source, supabaseHost)) {
      const fallback =
        previousSources[Math.min(rollingIndex, previousSources.length - 1)];
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

/**
 * Variant of lockExistingImageSourcesOnEdit that accepts pre-extracted URLs
 * instead of full GeneratedFile[]. Used when previous URLs are extracted
 * client-side and passed through the Inngest event.
 */
export function lockExistingImageSourcesFromUrls(
  nextFiles: GeneratedFile[],
  previousImageUrls: string[],
): GeneratedFile[] {
  if (previousImageUrls.length === 0) return nextFiles;
  const supabaseHost = getSupabaseHost();

  let rollingIndex = 0;
  const replaceToken = (source: string): string => {
    const placeholderMatch = source.match(/^REPLICATE_IMG_(\d+)$/i);
    if (placeholderMatch) {
      const idx = Number.parseInt(placeholderMatch[1], 10) - 1;
      if (idx >= 0 && idx < previousImageUrls.length) {
        return previousImageUrls[idx];
      }
      const fallback =
        previousImageUrls[Math.min(rollingIndex, previousImageUrls.length - 1)];
      rollingIndex++;
      return fallback;
    }

    if (shouldReplaceSource(source, supabaseHost)) {
      const fallback =
        previousImageUrls[Math.min(rollingIndex, previousImageUrls.length - 1)];
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

// ─── File Replacement ────────────────────────────────────────────────────────

export function applyReplacements(
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

// ─── Main Orchestrator ───────────────────────────────────────────────────────

export async function persistGeneratedImagesToStorage(
  files: GeneratedFile[],
  userId: string,
  options?: PersistImageOptions,
): Promise<GeneratedFile[]> {
  if (files.length === 0) return files;

  // 1. Edit preservation — lock existing image sources
  let nextFiles = files;
  if (options?.preserveExistingImages && options.previousFiles?.length) {
    nextFiles = lockExistingImageSourcesOnEdit(
      nextFiles,
      options.previousFiles,
    );
  }

  // 2. Collect raw image references (no prompt resolution)
  const refs = collectImageReferences(nextFiles);
  if (refs.length === 0) return nextFiles;
  console.log(`[Image Pipeline] Found ${refs.length} images to generate`);

  // 3. Check for Replicate API key
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) {
    console.warn(
      "[Image Pipeline] REPLICATE_API_TOKEN not configured. Using SVG fallbacks.",
    );
    const fallbackReplacements = new Map<string, string>();
    refs.forEach((ref, i) => {
      fallbackReplacements.set(
        ref.source,
        createFallbackImageDataUri(ref.source, ref.altText || "", i + 1),
      );
    });
    return applyReplacements(nextFiles, fallbackReplacements);
  }

  // 4. Resolve configuration from environment
  const config = resolveImageGenConfig();

  // 5. Generate prompts via LLM or fallback
  let prompts: ImagePromptResult[];
  if (config.enableLlmPromptEnhancement) {
    const siteContentSample = buildSiteContentSample(nextFiles);
    prompts = await generateImagePrompts(refs, {
      originalPrompt: options?.originalPrompt || "",
      detectedTheme: options?.detectedTheme,
      isUserProvidedPrompt: options?.isUserProvidedPrompt ?? false,
      siteContentSample,
    });
  } else {
    prompts = fallbackPromptGeneration(refs);
  }

  console.log(`[Image Pipeline] Generated ${prompts.length} prompts`);
  for (const p of prompts) {
    console.log(
      `[Image Pipeline]   ${p.source} -> "${p.prompt.slice(0, 100)}..." (${p.aspectRatio})`,
    );
  }

  // 6. Ensure storage bucket exists
  const bucket =
    process.env.SUPABASE_GENERATED_IMAGES_BUCKET ||
    process.env.SUPABASE_STORAGE_BUCKET ||
    "generated-images";
  await ensureBucketExists(bucket);

  // 7. Generate and upload images in parallel
  const replacements = await generateImagesInParallel(
    prompts,
    config,
    userId,
    bucket,
  );

  // 8. Report results
  const totalImages = refs.length;
  const fallbackCount = Array.from(replacements.values()).filter((u) =>
    u.startsWith("data:image/svg"),
  ).length;
  console.log(
    `[Image Pipeline] Complete: ${replacements.size}/${totalImages} generated (${fallbackCount} fallbacks)`,
  );

  return applyReplacements(nextFiles, replacements);
}
