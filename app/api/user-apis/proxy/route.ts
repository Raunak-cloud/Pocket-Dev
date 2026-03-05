import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/crypto";
import { checkRateLimit } from "@/lib/rate-limit";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const MAX_BODY_LENGTH = 512 * 1024; // 512 KB
const MAX_PATH_LENGTH = 512;
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5 MB
const FETCH_TIMEOUT_MS = 10_000;
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

// Headers that must not be forwarded to the external API
const FORBIDDEN_REQUEST_HEADERS = new Set([
  "host",
  "authorization",
  "cookie",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
  "cf-connecting-ip",
  "cf-ray",
  "connection",
  "transfer-encoding",
  "te",
  "upgrade",
  "proxy-authorization",
  "proxy-connection",
]);

// Only forward these safe content headers from the client
const SAFE_CLIENT_HEADERS = new Set(["content-type", "accept", "accept-language", "accept-encoding"]);

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    // Parse body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
    }

    const { projectId, apiSlug, path, method, queryParams, body: requestBody, headers: clientHeaders } = body as {
      projectId?: string;
      apiSlug?: string;
      path?: string;
      method?: string;
      queryParams?: Record<string, string>;
      body?: string;
      headers?: Record<string, string>;
    };

    // ── Input validation ──────────────────────────────────────────────────
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "projectId is required" }, { status: 400, headers: corsHeaders });
    }
    if (!apiSlug || typeof apiSlug !== "string") {
      return NextResponse.json({ error: "apiSlug is required" }, { status: 400, headers: corsHeaders });
    }
    if (!path || typeof path !== "string") {
      return NextResponse.json({ error: "path is required" }, { status: 400, headers: corsHeaders });
    }
    if (!method || typeof method !== "string" || !ALLOWED_METHODS.has(method.toUpperCase())) {
      return NextResponse.json(
        { error: "method must be one of GET, POST, PUT, PATCH, DELETE" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Path safety
    if (!path.startsWith("/")) {
      return NextResponse.json({ error: "path must start with /" }, { status: 400, headers: corsHeaders });
    }
    if (path.includes("..")) {
      return NextResponse.json({ error: "path traversal detected" }, { status: 400, headers: corsHeaders });
    }
    if (path.length > MAX_PATH_LENGTH) {
      return NextResponse.json({ error: "path too long" }, { status: 400, headers: corsHeaders });
    }

    // Body length cap
    if (requestBody !== undefined && typeof requestBody === "string" && requestBody.length > MAX_BODY_LENGTH) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413, headers: corsHeaders });
    }

    // queryParams must be flat string record
    if (queryParams !== undefined) {
      if (typeof queryParams !== "object" || Array.isArray(queryParams)) {
        return NextResponse.json({ error: "queryParams must be an object" }, { status: 400, headers: corsHeaders });
      }
      for (const [k, v] of Object.entries(queryParams)) {
        if (typeof k !== "string" || typeof v !== "string") {
          return NextResponse.json({ error: "queryParams values must be strings" }, { status: 400, headers: corsHeaders });
        }
      }
    }

    // ── Rate limiting ─────────────────────────────────────────────────────
    const { allowed, retryAfterMs } = checkRateLimit(projectId, RATE_LIMIT, RATE_WINDOW_MS);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
          },
        }
      );
    }

    // ── DB lookup ─────────────────────────────────────────────────────────
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        customApis: {
          where: { slug: apiSlug },
          select: {
            id: true,
            baseUrl: true,
            authType: true,
            authHeaderName: true,
            authParamName: true,
            apiKey: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404, headers: corsHeaders });
    }

    const apiConfig = project.customApis[0];
    if (!apiConfig) {
      return NextResponse.json({ error: "API not found" }, { status: 404, headers: corsHeaders });
    }

    // ── Decrypt key ───────────────────────────────────────────────────────
    let plainApiKey: string | null = null;
    if (apiConfig.apiKey) {
      try {
        plainApiKey = decryptApiKey(apiConfig.apiKey);
      } catch {
        console.error("[user-apis/proxy] Failed to decrypt API key for", apiSlug);
        return NextResponse.json({ error: "API configuration error" }, { status: 500, headers: corsHeaders });
      }
    }

    // ── Build target URL ──────────────────────────────────────────────────
    const baseUrl = apiConfig.baseUrl.replace(/\/$/, "");
    const targetUrl = new URL(`${baseUrl}${path}`);

    // Apply query params from client
    if (queryParams) {
      for (const [k, v] of Object.entries(queryParams)) {
        targetUrl.searchParams.set(k, v);
      }
    }

    // Inject auth via query param
    if (apiConfig.authType === "query_param" && apiConfig.authParamName && plainApiKey) {
      targetUrl.searchParams.set(apiConfig.authParamName, plainApiKey);
    }

    // ── Build forwarded headers ───────────────────────────────────────────
    const forwardHeaders: Record<string, string> = {};

    // Forward only safe client headers
    if (clientHeaders && typeof clientHeaders === "object") {
      for (const [k, v] of Object.entries(clientHeaders)) {
        const lower = k.toLowerCase();
        if (SAFE_CLIENT_HEADERS.has(lower) && !FORBIDDEN_REQUEST_HEADERS.has(lower) && typeof v === "string") {
          forwardHeaders[k] = v;
        }
      }
    }

    // Inject auth headers
    if (plainApiKey) {
      if (apiConfig.authType === "api_key_header" && apiConfig.authHeaderName) {
        forwardHeaders[apiConfig.authHeaderName] = plainApiKey;
      } else if (apiConfig.authType === "bearer_token") {
        forwardHeaders["Authorization"] = `Bearer ${plainApiKey}`;
      }
    }

    // Ensure content-type for body requests
    if (requestBody !== undefined && !forwardHeaders["content-type"] && !forwardHeaders["Content-Type"]) {
      forwardHeaders["Content-Type"] = "application/json";
    }

    // ── Fetch with timeout ────────────────────────────────────────────────
    let externalResponse: Response;
    try {
      externalResponse = await fetch(targetUrl.toString(), {
        method: method.toUpperCase(),
        headers: forwardHeaders,
        ...(requestBody !== undefined
          ? { body: typeof requestBody === "string" ? requestBody : JSON.stringify(requestBody) }
          : {}),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        return NextResponse.json({ error: "Gateway timeout" }, { status: 504, headers: corsHeaders });
      }
      console.error("[user-apis/proxy] Fetch error:", err);
      return NextResponse.json({ error: "Failed to reach external API" }, { status: 502, headers: corsHeaders });
    }

    // ── Stream response with size cap ─────────────────────────────────────
    const contentType = externalResponse.headers.get("content-type") ?? "application/octet-stream";

    const responseBuffer = await externalResponse.arrayBuffer();
    if (responseBuffer.byteLength > MAX_RESPONSE_SIZE) {
      return NextResponse.json({ error: "Response too large" }, { status: 502, headers: corsHeaders });
    }

    return new NextResponse(responseBuffer, {
      status: externalResponse.status,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    console.error("[user-apis/proxy] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
