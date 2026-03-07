/**
 * Gemini Context Cache
 *
 * Creates and manages session-scoped cached content so edit requests
 * don't need to resend the full codebase every time.
 *
 * Falls back gracefully if the model doesn't support caching or the
 * project is too small to benefit.
 */

import { GoogleAICacheManager } from "@google/generative-ai/server";

// Use the stable model prefix required by the caching API.
// We try the project's primary model first; on failure we fall back to 1.5-flash.
const CACHE_MODEL_PRIMARY = "models/gemini-2.0-flash";
const CACHE_MODEL_FALLBACK = "models/gemini-1.5-flash";
const CACHE_TTL_SECONDS = 3600; // 1 hour
// Skip caching for tiny projects — the overhead isn't worth it.
const MIN_CACHE_CHARS = 8_000;

function getCacheManager(): GoogleAICacheManager {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not found");
  return new GoogleAICacheManager(apiKey);
}

function buildFileContext(files: Array<{ path: string; content: string }>): string {
  return files.map((f) => `=== FILE: ${f.path} ===\n${f.content}`).join("\n\n");
}

async function tryCreateCache(
  cacheManager: GoogleAICacheManager,
  model: string,
  fileContext: string,
): Promise<string | null> {
  const cache = await cacheManager.create({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You have the complete Next.js project codebase below. When asked to make edits, analyse the existing code and return ONLY the files you modified.\n\n${fileContext}`,
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: "Understood. I have the full project context and am ready for your edit requests. I will return only the modified files.",
          },
        ],
      },
    ],
    ttlSeconds: CACHE_TTL_SECONDS,
  });

  return cache.name ?? null;
}

/**
 * Creates a Gemini context cache for the given project files.
 * Returns the cache name (e.g. "cachedContents/abc123") or null if
 * caching is unavailable/unsupported.
 */
export async function createProjectCache(
  files: Array<{ path: string; content: string }>,
): Promise<string | null> {
  try {
    const fileContext = buildFileContext(files);
    if (fileContext.length < MIN_CACHE_CHARS) {
      console.log("[GeminiCache] Project too small — skipping cache");
      return null;
    }

    const cacheManager = getCacheManager();

    // Try primary model first, fall back to 1.5-flash
    try {
      const name = await tryCreateCache(cacheManager, CACHE_MODEL_PRIMARY, fileContext);
      console.log(`[GeminiCache] Created (${CACHE_MODEL_PRIMARY}): ${name}`);
      return name;
    } catch (primaryErr) {
      console.warn(`[GeminiCache] Primary model failed, trying fallback:`, primaryErr);
      const name = await tryCreateCache(cacheManager, CACHE_MODEL_FALLBACK, fileContext);
      console.log(`[GeminiCache] Created (${CACHE_MODEL_FALLBACK}): ${name}`);
      return name;
    }
  } catch (err) {
    console.warn("[GeminiCache] Cache creation failed — will use standard generation:", err);
    return null;
  }
}

/**
 * Deletes an existing cache. Best-effort; errors are swallowed.
 */
export async function deleteProjectCache(cacheName: string): Promise<void> {
  try {
    const cacheManager = getCacheManager();
    await cacheManager.delete(cacheName);
    console.log(`[GeminiCache] Deleted: ${cacheName}`);
  } catch (err) {
    console.warn("[GeminiCache] Delete failed (likely already expired):", err);
  }
}

/**
 * Fetches the cached content metadata by name.
 * Used by the Inngest worker to get the CachedContent object.
 */
export async function getProjectCache(cacheName: string) {
  const cacheManager = getCacheManager();
  return cacheManager.get(cacheName);
}
