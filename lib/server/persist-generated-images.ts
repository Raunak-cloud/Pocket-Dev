import crypto from "node:crypto";
import Replicate from "replicate";
import { createAdminClient } from "@/lib/supabase/admin";

interface GeneratedFile {
  path: string;
  content: string;
}

type UrlOutput = {
  url: () => string | URL;
};

const REPLICATE_MODEL = "prunaai/z-image-turbo";
const DEFAULT_IMAGE_SIZE = 768;
const DEFAULT_PROMPT = "Professional website image with modern composition";
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

function resolvePrompt(source: string, altText?: string): string {
  const trimmedAlt = trimPrompt(altText || "");
  if (trimmedAlt) return trimmedAlt;
  if (PLACEHOLDER_RE.test(source)) return DEFAULT_PROMPT;
  return promptFromUrl(source);
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

function collectImageSources(files: GeneratedFile[]): Map<string, string> {
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
          refs.set(source, resolvePrompt(source, altMatch?.[1]));
        }
      }
      tagMatch = tagRe.exec(content);
    }

    const cssUrlRe = /url\(\s*["']?(https?:\/\/[^"')\s]+)["']?\s*\)/gi;
    let cssMatch: RegExpExecArray | null = cssUrlRe.exec(content);
    while (cssMatch) {
      const source = cssMatch[1];
      if (shouldReplaceSource(source, supabaseHost) && !refs.has(source)) {
        refs.set(source, resolvePrompt(source));
      }
      cssMatch = cssUrlRe.exec(content);
    }

    const placeholderRe = /REPLICATE_IMG_\d+/gi;
    let placeholderMatch: RegExpExecArray | null = placeholderRe.exec(content);
    while (placeholderMatch) {
      const source = placeholderMatch[0];
      if (!refs.has(source)) {
        refs.set(source, DEFAULT_PROMPT);
      }
      placeholderMatch = placeholderRe.exec(content);
    }

    const remoteUrlRe = /https?:\/\/[^\s"'`)<>\]}]+/g;
    let urlMatch: RegExpExecArray | null = remoteUrlRe.exec(content);
    while (urlMatch) {
      const source = urlMatch[0].replace(/[),.;]+$/, "");
      if (shouldReplaceSource(source, supabaseHost) && !refs.has(source)) {
        refs.set(source, resolvePrompt(source));
      }
      urlMatch = remoteUrlRe.exec(content);
    }
  }

  return refs;
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

async function generateReplicateImage(
  replicate: Replicate,
  prompt: string,
): Promise<string> {
  const output = await replicate.run(REPLICATE_MODEL, {
    input: {
      width: DEFAULT_IMAGE_SIZE,
      height: DEFAULT_IMAGE_SIZE,
      prompt,
    },
  });
  return getReplicateOutputUrl(output);
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
): Promise<GeneratedFile[]> {
  if (files.length === 0) return files;

  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) {
    throw new Error("REPLICATE_API_TOKEN is not configured");
  }

  const bucket =
    process.env.SUPABASE_GENERATED_IMAGES_BUCKET ||
    process.env.SUPABASE_STORAGE_BUCKET ||
    "generated-images";

  const refs = collectImageSources(files);
  if (refs.size === 0) return files;

  await ensureBucketExists(bucket);

  const replicate = new Replicate({ auth: apiKey });
  const replacements = new Map<string, string>();
  const promptCache = new Map<string, string>();
  const unresolved: string[] = [];

  let index = 0;
  for (const [source, prompt] of refs) {
    index++;
    try {
      const normalizedPrompt = trimPrompt(prompt) || DEFAULT_PROMPT;
      if (promptCache.has(normalizedPrompt)) {
        replacements.set(source, promptCache.get(normalizedPrompt)!);
        continue;
      }

      const replicateUrl = await generateReplicateImage(replicate, normalizedPrompt);
      const storedUrl = await uploadImageFromUrl({
        imageUrl: replicateUrl,
        userId,
        bucket,
        index,
      });
      replacements.set(source, storedUrl);
      promptCache.set(normalizedPrompt, storedUrl);
    } catch (error) {
      console.error(
        `[persistGeneratedImagesToStorage] Failed source "${source}":`,
        error,
      );
      unresolved.push(source);
    }
  }

  if (unresolved.length > 0) {
    throw new Error(
      `Failed to persist ${unresolved.length} generated image(s). First unresolved source: ${unresolved[0]}`,
    );
  }

  return applyReplacements(files, replacements);
}
