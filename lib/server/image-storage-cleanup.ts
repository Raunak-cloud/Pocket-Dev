import { createAdminClient } from "@/lib/supabase/admin";

interface GeneratedFile {
  path: string;
  content: string;
}

interface StorageObjectRef {
  bucket: string;
  objectPath: string;
}

const PUBLIC_OBJECT_PATH_RE = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i;
const URL_RE = /https?:\/\/[^\s"'`)<>\]}]+/g;

function getSupabaseHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function getAllowedGeneratedBuckets(): Set<string> {
  const buckets = new Set<string>(["generated-images", "uploads"]);
  const configured = [
    process.env.SUPABASE_GENERATED_IMAGES_BUCKET,
    process.env.SUPABASE_STORAGE_BUCKET,
  ];
  for (const bucket of configured) {
    if (bucket && bucket.trim()) {
      buckets.add(bucket.trim());
    }
  }
  return buckets;
}

function parsePublicStorageObject(
  url: string,
  supabaseHost: string | null,
  allowedBuckets: Set<string>,
): StorageObjectRef | null {
  if (!supabaseHost) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.toLowerCase() !== supabaseHost) return null;
    const match = parsed.pathname.match(PUBLIC_OBJECT_PATH_RE);
    if (!match) return null;

    const bucket = decodeURIComponent(match[1]);
    const objectPath = decodeURIComponent(match[2]);
    if (!allowedBuckets.has(bucket)) return null;
    if (!objectPath || objectPath.endsWith("/")) return null;

    return { bucket, objectPath };
  } catch {
    return null;
  }
}

function extractUrlsFromFiles(files: GeneratedFile[]): Set<string> {
  const urls = new Set<string>();
  for (const file of files) {
    let match: RegExpExecArray | null = URL_RE.exec(file.content);
    while (match) {
      const normalized = match[0].replace(/[),.;]+$/, "");
      urls.add(normalized);
      match = URL_RE.exec(file.content);
    }
    URL_RE.lastIndex = 0;
  }
  return urls;
}

function extractUrlsFromImageCache(imageCache: unknown): Set<string> {
  const urls = new Set<string>();
  if (!imageCache || typeof imageCache !== "object" || Array.isArray(imageCache)) {
    return urls;
  }
  for (const value of Object.values(imageCache)) {
    if (typeof value === "string" && /^https?:\/\//i.test(value)) {
      urls.add(value);
    }
  }
  return urls;
}

export function parseGeneratedFiles(input: unknown): GeneratedFile[] {
  if (!Array.isArray(input)) return [];
  const files: GeneratedFile[] = [];
  for (const entry of input) {
    if (
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as { path?: unknown }).path === "string" &&
      typeof (entry as { content?: unknown }).content === "string"
    ) {
      files.push({
        path: (entry as { path: string }).path,
        content: (entry as { content: string }).content,
      });
    }
  }
  return files;
}

export function collectGeneratedStorageUrlsFromProjectData(
  files: GeneratedFile[],
  imageCache?: unknown,
): Set<string> {
  const supabaseHost = getSupabaseHost();
  const allowedBuckets = getAllowedGeneratedBuckets();
  const urls = new Set<string>([
    ...extractUrlsFromFiles(files),
    ...extractUrlsFromImageCache(imageCache),
  ]);

  const filtered = new Set<string>();
  for (const url of urls) {
    if (parsePublicStorageObject(url, supabaseHost, allowedBuckets)) {
      filtered.add(url);
    }
  }
  return filtered;
}

export async function deleteGeneratedStorageUrls(urls: Iterable<string>): Promise<void> {
  const supabaseHost = getSupabaseHost();
  const allowedBuckets = getAllowedGeneratedBuckets();
  const byBucket = new Map<string, Set<string>>();

  for (const url of urls) {
    const parsed = parsePublicStorageObject(url, supabaseHost, allowedBuckets);
    if (!parsed) continue;
    const bucketSet = byBucket.get(parsed.bucket) ?? new Set<string>();
    bucketSet.add(parsed.objectPath);
    byBucket.set(parsed.bucket, bucketSet);
  }

  if (byBucket.size === 0) return;

  const supabase = createAdminClient();
  for (const [bucket, objectPathSet] of byBucket.entries()) {
    const paths = Array.from(objectPathSet);
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { error } = await supabase.storage.from(bucket).remove(chunk);
      if (error) {
        throw new Error(
          `Failed to delete generated image(s) from bucket "${bucket}": ${error.message}`,
        );
      }
    }
  }
}
