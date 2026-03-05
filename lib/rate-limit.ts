/**
 * Lightweight in-memory sliding window rate limiter.
 * Not suitable for multi-instance deployments without a shared store,
 * but sufficient for platform proxy usage.
 */

interface WindowEntry {
  timestamps: number[];
}

const store = new Map<string, WindowEntry>();

/**
 * Check whether a key is within the rate limit.
 * @param key      Unique key (e.g., projectId)
 * @param limit    Max requests allowed in the window
 * @param windowMs Window size in milliseconds
 * @returns { allowed: boolean; retryAfterMs: number }
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key) ?? { timestamps: [] };

  // Prune timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = windowMs - (now - oldest);
    store.set(key, entry);
    return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  entry.timestamps.push(now);
  store.set(key, entry);
  return { allowed: true, retryAfterMs: 0 };
}
