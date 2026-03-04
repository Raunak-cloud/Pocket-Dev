const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

type UrlCandidate = {
  source: string;
  raw: string;
  normalized: string | null;
  skippedReason?: string;
};

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).origin.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function collectUrlCandidates(): UrlCandidate[] {
  const candidates: UrlCandidate[] = [];

  const explicitCandidates: Array<{ source: string; value?: string }> = [
    { source: "INTERNAL_APP_URL", value: process.env.INTERNAL_APP_URL },
    { source: "APP_URL", value: process.env.APP_URL },
    { source: "NEXT_PUBLIC_APP_URL", value: process.env.NEXT_PUBLIC_APP_URL },
    {
      source: "NEXT_PUBLIC_PRODUCTION_URL",
      value: process.env.NEXT_PUBLIC_PRODUCTION_URL,
    },
  ];

  for (const candidate of explicitCandidates) {
    if (typeof candidate.value !== "string" || !candidate.value.trim()) {
      continue;
    }
    candidates.push({
      source: candidate.source,
      raw: candidate.value,
      normalized: normalizeUrl(candidate.value),
    });
  }

  if (
    typeof process.env.VERCEL_URL === "string" &&
    process.env.VERCEL_URL.trim()
  ) {
    const value = `https://${process.env.VERCEL_URL.trim()}`;
    candidates.push({
      source: "VERCEL_URL",
      raw: value,
      normalized: normalizeUrl(value),
    });
  }

  if (
    typeof process.env.VERCEL_PROJECT_PRODUCTION_URL === "string" &&
    process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()
  ) {
    const value = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`;
    candidates.push({
      source: "VERCEL_PROJECT_PRODUCTION_URL",
      raw: value,
      normalized: normalizeUrl(value),
    });
  }

  return candidates;
}

function resolveServerAppBaseUrl() {
  const isProduction = process.env.NODE_ENV === "production";
  const candidates = collectUrlCandidates();
  let selectedSource: string | null = null;
  let selectedBaseUrl: string | null = null;

  for (const candidate of candidates) {
    const normalized = candidate.normalized;
    if (!normalized) {
      candidate.skippedReason = "invalid_url";
      continue;
    }

    try {
      const parsed = new URL(normalized);
      if (isProduction && LOCAL_HOSTNAMES.has(parsed.hostname)) {
        candidate.skippedReason = "localhost_blocked_in_production";
        continue;
      }
      selectedSource = candidate.source;
      selectedBaseUrl = normalized;
      break;
    } catch {
      candidate.skippedReason = "parse_error";
      continue;
    }
  }

  if (!selectedBaseUrl && !isProduction) {
    selectedSource = "dev_default";
    selectedBaseUrl = "http://localhost:3000";
  }

  return {
    isProduction,
    selectedSource,
    selectedBaseUrl,
    candidates,
  };
}

export function getServerAppBaseUrl(): string {
  const resolution = resolveServerAppBaseUrl();
  if (resolution.selectedBaseUrl) {
    return resolution.selectedBaseUrl;
  }

  throw new Error(
    "Unable to resolve app base URL for server-side callbacks. Set APP_URL or INTERNAL_APP_URL (or ensure VERCEL_URL is available).",
  );
}

export function getInngestStatusApiUrl(): string {
  return `${getServerAppBaseUrl()}/api/inngest/status`;
}

export function getServerAppBaseUrlDebug() {
  const resolution = resolveServerAppBaseUrl();
  const error = resolution.selectedBaseUrl
    ? null
    : "Unable to resolve app base URL for server-side callbacks.";
  const statusApiUrl = resolution.selectedBaseUrl
    ? `${resolution.selectedBaseUrl}/api/inngest/status`
    : null;

  return {
    ...resolution,
    statusApiUrl,
    error,
  };
}
