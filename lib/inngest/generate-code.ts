/**
 * Inngest Function: AI Code Generation
 *
 * Generates complete Next.js 15 projects with Gemini 3 Flash Preview
 * Uses step functions for durable execution and automatic retries
 */

import { inngest } from "@/lib/inngest-client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { lintCode } from "@/lib/eslint-lint";
import { ensureProviderGuardsForGeneratedFiles } from "@/lib/provider-guards";
import {
  acquireAuthConfigForBindingKey,
  applySqlToManagedProject,
  type ManagedSupabaseAuthConfig,
} from "@/lib/supabase-project-pool";
import ts from "typescript";
import {
  SYSTEM_PROMPT,
  DASHBOARD_SYSTEM_PROMPT,
  REPAIR_SYSTEM_PROMPT,
  PROJECT_TYPE_DETECTION_PROMPT,
  THEME_DETECTION_PROMPT,
  buildJsonRepairPrompt,
  buildShapeRepairPrompt,
  buildLintRepairPrompt,
} from "@/lib/prompts";

const MODEL = "gemini-3-flash-preview";
const MAX_TOKENS = 32768;
const MAX_LINT_REPAIR_ATTEMPTS = 2;
const MAX_SYNTAX_REPAIR_ATTEMPTS = 2;
const MAX_JSON_REPAIR_ATTEMPTS = 2;
const MAX_STRUCTURE_REPAIR_ATTEMPTS = 2;
const MAX_UX_REPAIR_ATTEMPTS = 3;
const MAX_SCHEMA_REPAIR_ATTEMPTS = 2;
const MAX_NEXTJS_REPAIR_ATTEMPTS = 2;
const MAX_FILE_COUNT = 300;
const MAX_FILE_CONTENT_LENGTH = 300_000;

interface GeneratedFile {
  path: string;
  content: string;
}

interface ParsedAIResponse {
  files?: unknown;
  dependencies?: unknown;
  _checks?: Record<string, unknown>;
}

interface LintIssue {
  path: string;
  line: number;
  column: number;
  rule: string | null;
  message: string;
}

type IntegrationRequirements = {
  requiresAuth: boolean;
  requiresDatabase: boolean;
  requiresGoogleOAuth: boolean;
  requiresPasswordAuth: boolean;
};

type ProjectType = "website" | "dashboard";

// Keywords that strongly indicate a dashboard/app rather than a marketing website.
// Checked before calling Gemini for instant classification.
const DASHBOARD_KEYWORDS = [
  "dashboard",
  "admin panel",
  "admin dashboard",
  "control panel",
  "admin interface",
  "management system",
  "management app",
  "crm",
  "erp",
  "analytics dashboard",
  "monitoring dashboard",
  "reporting dashboard",
  "metrics dashboard",
  "kanban",
  "kanban board",
  "project management app",
  "task manager app",
  "task management app",
  "inventory management",
  "order management",
  "user management",
  "internal tool",
  "backoffice",
  "back office",
  "data visualization app",
  "saas dashboard",
  "business intelligence",
  "portal app",
  "ops dashboard",
];

function detectProjectTypeFromKeywords(prompt: string): ProjectType | null {
  const lower = prompt.toLowerCase();
  for (const kw of DASHBOARD_KEYWORDS) {
    if (lower.includes(kw)) return "dashboard";
  }
  return null;
}

async function detectProjectTypeWithGemini(
  userPrompt: string,
): Promise<ProjectType> {
  const gemini = getGeminiClient();
  const model = gemini.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens: 10, temperature: 0.1 },
  });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${PROJECT_TYPE_DETECTION_PROMPT}\n\nUser request: "${userPrompt}"\n\nType:`,
          },
        ],
      },
    ],
  });

  const text = result.response.text().trim().toLowerCase();
  if (text === "dashboard" || text === "website") return text;
  throw new Error(`Invalid project type returned: ${text}`);
}

async function extractProjectType(prompt: string): Promise<ProjectType> {
  // Fast path: keyword detection avoids an extra Gemini call for obvious cases.
  const fromKeywords = detectProjectTypeFromKeywords(prompt);
  if (fromKeywords) {
    console.log(`[ProjectType] Keyword match: ${fromKeywords}`);
    return fromKeywords;
  }

  // Slow path: ask Gemini for ambiguous prompts.
  try {
    const aiType = await detectProjectTypeWithGemini(prompt);
    console.log(`[ProjectType] Gemini detected: ${aiType}`);
    return aiType;
  } catch (error) {
    console.warn("[ProjectType] Gemini detection failed, defaulting to website:", error);
    return "website";
  }
}

type SiteTheme =
  | "food"
  | "fashion"
  | "interior"
  | "automotive"
  | "people"
  | "generic";

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not found");
  }
  return new GoogleGenerativeAI(apiKey);
}

function isValidSiteTheme(value: string): value is SiteTheme {
  return [
    "food",
    "fashion",
    "interior",
    "automotive",
    "people",
    "generic",
  ].includes(value);
}

function detectIntegrationRequirements(
  promptText: string,
): IntegrationRequirements {
  const text = promptText.toLowerCase();
  // Prefer explicit markers from our UI prompts. Broad keyword detection on full
  // edit prompts can create false positives because the prompt includes code context.
  const explicitAuthMarker = text.includes("🔐 authentication requirement");
  const explicitDbMarker = text.includes("🗄️ database requirement");
  const requiresAuth =
    explicitAuthMarker ||
    /\badd a complete backend\b|\bbackend \(authentication \+ database\)\b/.test(
      text,
    );
  const requiresDatabase =
    explicitDbMarker ||
    /\badd a complete backend\b|\bbackend \(authentication \+ database\)\b/.test(
      text,
    );

  return {
    requiresAuth,
    requiresDatabase,
    requiresGoogleOAuth:
      /\bgoogle oauth\b|\bsign in with google\b|\bprovider\s*:\s*google\b/.test(
        text,
      ),
    requiresPasswordAuth:
      /\busername\/password\b|\bpassword\b|\bforgot password\b|\breset password\b/.test(
        text,
      ),
  };
}

function normalizeIntegrationRequirements(
  input: unknown,
): IntegrationRequirements | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  return {
    requiresAuth: raw.requiresAuth === true,
    requiresDatabase: raw.requiresDatabase === true,
    requiresGoogleOAuth: raw.requiresGoogleOAuth === true,
    requiresPasswordAuth: raw.requiresPasswordAuth === true,
  };
}

function projectNeedsManagedSupabase(
  files: GeneratedFile[],
  dependencies: Record<string, string>,
  requirements: IntegrationRequirements,
): boolean {
  // Managed Supabase should only be allocated when backend integration is
  // explicitly requested. Do not infer it from accidental model output.
  if (requirements.requiresAuth || requirements.requiresDatabase) {
    return true;
  }

  void files;
  void dependencies;
  return false;
}

async function detectThemeWithGemini(userPrompt: string): Promise<SiteTheme> {
  const gemini = getGeminiClient();
  const model = gemini.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      maxOutputTokens: 10,
      temperature: 0.1,
    },
  });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${THEME_DETECTION_PROMPT}\n\nUser request: "${userPrompt}"\n\nTheme:`,
          },
        ],
      },
    ],
  });

  const text = result.response.text().trim().toLowerCase();

  // Validate response is a valid theme
  if (isValidSiteTheme(text)) {
    return text;
  }

  throw new Error(`Invalid theme returned: ${text}`);
}

async function extractThemeFromPrompt(prompt: string): Promise<SiteTheme> {
  try {
    // Use AI detection with Gemini
    const aiTheme = await detectThemeWithGemini(prompt);
    if (aiTheme && isValidSiteTheme(aiTheme)) {
      console.log(`[Theme] AI detected: ${aiTheme}`);
      return aiTheme;
    }
  } catch (error) {
    console.warn(
      "[Theme] AI detection failed, will use code analysis fallback:",
      error,
    );
  }

  // Will fall back to code analysis later in the pipeline
  return "generic";
}

async function generateWithGemini(systemPrompt: string, userPrompt: string) {
  const gemini = getGeminiClient();
  const model = gemini.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      maxOutputTokens: MAX_TOKENS,
      temperature: 0.7,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
      },
    ],
  });

  return result.response.text();
}

async function sendProgress(projectId: string, message: string) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/inngest/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        event: "progress",
        progress: message,
      }),
    });
  } catch (err) {
    console.error("Failed to send progress:", err);
  }
}

async function sendFailure(projectId: string, error: string) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/inngest/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        failed: true,
        error,
      }),
    });
  } catch (err) {
    console.error("Failed to send failure notification:", err);
  }
}

async function checkIfCancelled(projectId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/inngest/status?projectId=${projectId}&event=generate.completed`,
    );

    if (response.ok) {
      const data = await response.json();
      if (data.cancelled) {
        console.log(`[Inngest] Job ${projectId} was cancelled`);
        return true;
      }
    }
  } catch (err) {
    console.error("Failed to check cancellation status:", err);
  }
  return false;
}

function getDefaultDependencies(): Record<string, string> {
  return {
    next: "^15.0.0",
    react: "^19.0.0",
    "react-dom": "^19.0.0",
    "framer-motion": "^11.11.17",
    "lucide-react": "^0.468.0",
    "react-scroll-parallax": "^3.4.5",
    "@radix-ui/react-slot": "^1.0.2",
    "class-variance-authority": "^0.7.0",
    clsx: "^2.0.0",
    "tailwind-merge": "^2.2.0",
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeDependencyMap(value: unknown): Record<string, string> {
  const defaults = getDefaultDependencies();
  if (!isPlainObject(value)) {
    return defaults;
  }

  const normalized: Record<string, string> = {};
  for (const [name, version] of Object.entries(value)) {
    const pkg = name.trim();
    if (!pkg || typeof version !== "string") continue;
    const trimmedVersion = version.trim();
    if (!trimmedVersion) continue;
    normalized[pkg] = trimmedVersion;
  }

  return { ...defaults, ...normalized };
}

function normalizeFilePath(pathValue: string): string | null {
  let next = pathValue.trim().replace(/\\/g, "/");
  next = next.replace(/^\.\/+/, "");

  if (!next) return null;
  if (next.startsWith("/") || /^[A-Za-z]:\//.test(next)) return null;
  if (next.includes("..")) return null;
  if (next.includes("\0")) return null;
  if (/\r|\n/.test(next)) return null;
  if (/^(node_modules|\.next)\//.test(next)) return null;
  if (/package-lock\.json$|yarn\.lock$|pnpm-lock\.yaml$/i.test(next)) {
    return null;
  }

  return next;
}

function normalizeGeneratedFilesOrThrow(value: unknown): GeneratedFile[] {
  if (!Array.isArray(value)) {
    throw new Error("AI response has invalid shape: files must be an array.");
  }

  const byPath = new Map<string, string>();
  for (const item of value) {
    if (!isPlainObject(item)) continue;
    if (typeof item.path !== "string" || typeof item.content !== "string") {
      continue;
    }

    const normalizedPath = normalizeFilePath(item.path);
    if (!normalizedPath) continue;
    if (item.content.length > MAX_FILE_CONTENT_LENGTH) {
      throw new Error(
        `AI response has an oversized file: ${normalizedPath} exceeds ${MAX_FILE_CONTENT_LENGTH} characters.`,
      );
    }

    byPath.set(normalizedPath, item.content.replace(/^\uFEFF/, ""));
    if (byPath.size > MAX_FILE_COUNT) {
      throw new Error(
        `AI response contains too many files (>${MAX_FILE_COUNT}).`,
      );
    }
  }

  const files = Array.from(byPath.entries()).map(([path, content]) => ({
    path,
    content,
  }));

  if (files.length === 0) {
    throw new Error("AI response did not include any usable files.");
  }

  return files;
}

function normalizeParsedProjectOrThrow(parsed: ParsedAIResponse): {
  files: GeneratedFile[];
  dependencies: Record<string, string>;
} {
  if (!isPlainObject(parsed)) {
    throw new Error("AI response root must be a JSON object.");
  }

  const files = normalizeGeneratedFilesOrThrow(parsed.files);
  const dependencies = normalizeDependencyMap(parsed.dependencies);
  return { files, dependencies };
}

function validateProjectStructureOrThrow(files: GeneratedFile[]) {
  const required = new Set([
    "app/layout.tsx",
    "app/page.tsx",
    "app/loading.tsx",
    "app/globals.css",
  ]);
  const existing = new Set(files.map((f) => f.path));
  const missing = Array.from(required).filter((path) => !existing.has(path));

  if (missing.length > 0) {
    throw new Error(
      `Generated project is missing required files: ${missing.join(", ")}`,
    );
  }
}

function extractLikelyJSONObject(input: string): string {
  const firstBrace = input.indexOf("{");
  const lastBrace = input.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return input;
  }
  return input.slice(firstBrace, lastBrace + 1);
}

function escapeControlCharsInJSONStringValues(input: string): string {
  let out = "";
  let inString = false;
  let escaping = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const code = ch.charCodeAt(0);

    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }

    if (escaping) {
      out += ch;
      escaping = false;
      continue;
    }

    if (ch === "\\") {
      out += ch;
      escaping = true;
      continue;
    }

    if (ch === '"') {
      out += ch;
      inString = false;
      continue;
    }

    if (ch === "\n") {
      out += "\\n";
      continue;
    }
    if (ch === "\r") {
      out += "\\r";
      continue;
    }
    if (ch === "\t") {
      out += "\\t";
      continue;
    }

    if (code < 0x20) {
      out += `\\u${code.toString(16).padStart(4, "0")}`;
      continue;
    }

    out += ch;
  }

  return out;
}

function normalizeEscapedTokensOutsideStrings(input: string): string {
  let out = "";
  let inString = false;
  let escapingInString = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (!inString) {
      if (ch === "\\") {
        if (next === "n" || next === "r" || next === "t") {
          out += " ";
          i++;
          continue;
        }
        if (next === '"') {
          out += '"';
          i++;
          inString = true;
          continue;
        }
      }

      out += ch;
      if (ch === '"') {
        inString = true;
      }
      continue;
    }

    if (escapingInString) {
      out += ch;
      escapingInString = false;
      continue;
    }

    if (ch === "\\") {
      out += ch;
      escapingInString = true;
      continue;
    }

    if (ch === '"') {
      out += ch;
      inString = false;
      continue;
    }

    out += ch;
  }

  return out;
}

function tryParsePossiblyDoubleEncodedJSON(
  input: string,
): ParsedAIResponse | null {
  const trimmed = input.trim();
  if (!(trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return null;
  }

  try {
    const unwrapped = JSON.parse(trimmed);
    if (typeof unwrapped !== "string") {
      return null;
    }
    return JSON.parse(unwrapped);
  } catch {
    return null;
  }
}

function logParseErrorContext(input: string, error: unknown) {
  const syntaxError = error as SyntaxError;
  const message = syntaxError.message || String(error);
  const match = message.match(/position (\d+)/);

  if (match) {
    const pos = Number.parseInt(match[1], 10);
    const start = Math.max(0, pos - 120);
    const end = Math.min(input.length, pos + 120);
    console.error("JSON parse error near:", input.slice(start, end));
  }

  console.error("Failed to parse AI response as JSON:", message);
  console.error("First 500 chars:", input.slice(0, 500));
  console.error(
    "Last 500 chars:",
    input.slice(Math.max(0, input.length - 500)),
  );
}

function parseAIGeneratedJSON(text: string): ParsedAIResponse {
  let jsonText = text.trim();

  // Remove markdown code fences if present.
  if (jsonText.startsWith("```")) {
    const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) jsonText = match[1].trim();
  }

  const extracted = extractLikelyJSONObject(jsonText);
  const candidates = Array.from(new Set([jsonText, extracted]));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue to repair attempts.
    }

    const unwrapped = tryParsePossiblyDoubleEncodedJSON(candidate);
    if (unwrapped) {
      return unwrapped;
    }
  }

  console.warn("Initial JSON parse failed, attempting repairs...");

  let fixedText = extracted.replace(/,\s*([}\]])/g, "$1");
  try {
    return JSON.parse(fixedText);
  } catch {
    // Continue to control character repair.
  }

  fixedText = escapeControlCharsInJSONStringValues(fixedText);
  try {
    return JSON.parse(fixedText);
  } catch {
    // Continue to escaped-token normalization.
  }

  fixedText = normalizeEscapedTokensOutsideStrings(fixedText);
  try {
    return JSON.parse(fixedText);
  } catch (error) {
    const unwrapped = tryParsePossiblyDoubleEncodedJSON(fixedText);
    if (unwrapped) return unwrapped;

    logParseErrorContext(fixedText, error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse AI response: ${message}`);
  }
}

function parseAndNormalizeProjectFromTextOrThrow(text: string): {
  files: GeneratedFile[];
  dependencies: Record<string, string>;
} {
  const parsed = parseAIGeneratedJSON(text);
  return normalizeParsedProjectOrThrow(parsed);
}

async function repairMalformedJSONWithGemini(rawText: string): Promise<string> {
  return generateWithGemini(
    "Return strict JSON only. Do not include markdown fences.",
    buildJsonRepairPrompt(rawText),
  );
}

async function repairProjectShapeWithGemini(args: {
  originalPrompt: string;
  parseError: string;
  parsedResponse: ParsedAIResponse;
}): Promise<string> {
  return generateWithGemini(
    "Return strict JSON only. No markdown.",
    buildShapeRepairPrompt(args),
  );
}

async function repairProjectFromLintFeedback(args: {
  originalPrompt: string;
  files: GeneratedFile[];
  dependencies: Record<string, string>;
  lintIssues: LintIssue[];
  requirements?: IntegrationRequirements;
  managedAuthConfig?: ManagedSupabaseAuthConfig | null;
  systemPrompt?: string;
}) {
  const {
    originalPrompt,
    files,
    dependencies,
    lintIssues,
    requirements,
    managedAuthConfig,
    systemPrompt = SYSTEM_PROMPT,
  } = args;

  const repairPrompt = buildLintRepairPrompt({
    originalPrompt,
    files,
    dependencies,
    lintIssues,
  });

  const text = await generateWithGemini(systemPrompt, repairPrompt);
  const { dependencies: repairedDependencies, files: parsedFiles } =
    parseAndNormalizeProjectFromTextOrThrow(text);
  let repairedFiles = parsedFiles;
  repairedFiles = ensureRequiredFiles(
    repairedFiles,
    repairedDependencies,
    requirements,
    managedAuthConfig,
  );
  validateProjectStructureOrThrow(repairedFiles);
  validateSyntaxOrThrow(repairedFiles);

  return { files: repairedFiles, dependencies: repairedDependencies };
}

function ensureRequiredFiles(
  files: GeneratedFile[],
  dependencies: Record<string, string>,
  requirements?: IntegrationRequirements,
  managedAuthConfig?: ManagedSupabaseAuthConfig | null,
): GeneratedFile[] {
  const requested: IntegrationRequirements = requirements || {
    requiresAuth: false,
    requiresDatabase: false,
    requiresGoogleOAuth: false,
    requiresPasswordAuth: false,
  };
  function parseEnvContent(content: string): Map<string, string> {
    const vars = new Map<string, string>();
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      vars.set(key, value);
    }
    return vars;
  }

  function buildEnvContent(
    existing?: string,
    required?: Record<string, string>,
  ): string {
    const env = parseEnvContent(existing || "");
    for (const [key, value] of Object.entries(required || {})) {
      if (value !== undefined && value !== null) {
        env.set(key, value);
      }
    }

    const lines = Array.from(env.entries()).map(
      ([key, value]) => `${key}=${value}`,
    );
    return `${lines.join("\n")}\n`;
  }

  function isSupabaseDatabaseUrl(value: string): boolean {
    const url = (value || "").toLowerCase();
    if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
      return false;
    }
    return url.includes("supabase.co") || url.includes("supabase.com");
  }

  function resolveSharedSupabaseDatabaseUrl(
    existingEnv: Map<string, string>,
  ): string {
    const configuredShared =
      existingEnv.get("SUPABASE_SHARED_DATABASE_URL") ||
      process.env.SUPABASE_SHARED_DATABASE_URL ||
      "";
    if (configuredShared) {
      return configuredShared;
    }

    const existingDatabaseUrl = existingEnv.get("DATABASE_URL") || "";
    if (isSupabaseDatabaseUrl(existingDatabaseUrl)) {
      return existingDatabaseUrl;
    }

    return "";
  }

  function stripBackendScaffoldForPublicApps(
    sourceFiles: GeneratedFile[],
  ): GeneratedFile[] {
    const removablePathPatterns: RegExp[] = [
      /^middleware\.(ts|js)$/i,
      /^lib\/supabase\/.+/i,
      /^app\/auth\/callback\/route\.(ts|js)$/i,
      /^app\/api\/auth\/.+/i,
      /^src\/lib\/supabase\/.+/i,
      /^src\/app\/auth\/callback\/route\.(ts|js)$/i,
      /^src\/app\/api\/auth\/.+/i,
      /^supabase\/schema\.sql$/i,
    ];

    return sourceFiles.filter((file) => {
      const normalized = file.path.replace(/\\/g, "/");
      if (removablePathPatterns.some((re) => re.test(normalized))) {
        return false;
      }

      // Remove middleware only when it is Supabase-auth specific.
      if (
        /(?:^|\/)middleware\.(ts|js)$/i.test(normalized) &&
        /@supabase\/ssr|createServerClient|NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY/i.test(
          file.content,
        )
      ) {
        return false;
      }

      return true;
    });
  }

  function stripSupabaseDepsForPublicApps(
    deps: Record<string, string>,
  ): Record<string, string> {
    delete deps["@supabase/supabase-js"];
    delete deps["@supabase/ssr"];
    return deps;
  }

  function stripSupabaseEnvForPublicApps(
    sourceFiles: GeneratedFile[],
  ): GeneratedFile[] {
    return sourceFiles.map((file) => {
      if (file.path !== ".env.local") return file;
      const filtered = file.content
        .split(/\r?\n/)
        .filter((line) => {
          const key = line.split("=")[0]?.trim() || "";
          if (!key) return true;
          return ![
            "NEXT_PUBLIC_SUPABASE_URL",
            "SUPABASE_URL",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY",
            "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
          ].includes(key);
        })
        .join("\n")
        .trim();
      return {
        ...file,
        content: filtered ? `${filtered}\n` : "",
      };
    });
  }

  function buildBrowserSupabaseClientContent(useSsr: boolean): string {
    if (useSsr) {
      return `import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function createClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
`;
    }

    return `import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function createClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createSupabaseClient(supabaseUrl, supabasePublishableKey);
}
`;
  }

  function buildServerSupabaseClientContent(): string {
    return `import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function createClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  let cookieStore: Awaited<ReturnType<typeof cookies>> | null = null;
  try {
    cookieStore = await cookies();
  } catch {
    // Called outside request scope (build/static tooling): return stateless client.
    cookieStore = null;
  }

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore?.getAll() ?? [];
      },
      setAll(cookiesToSet) {
        if (!cookieStore) return;
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll can be called from a Server Component where cookie mutation is not allowed.
        }
      },
    },
  });
}
`;
  }

  function normalizeMiddlewareSupabaseEnv(content: string): string {
    if (!/createServerClient/.test(content)) return content;

    let patched = content;

    const canonicalSupabaseUrlDecl = `const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;`;
    const canonicalSupabaseAnonDecl = `const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;`;

    const hasSupabaseUrlDecl = /\b(?:const|let|var)\s+supabaseUrl\b/.test(
      patched,
    );
    const hasSupabaseAnonDecl = /\b(?:const|let|var)\s+supabaseAnonKey\b/.test(
      patched,
    );

    if (!hasSupabaseUrlDecl || !hasSupabaseAnonDecl) {
      patched = patched.replace(
        /(import\s+\{\s*NextResponse\s*\}\s+from\s+["']next\/server["'];?\s*\n)/,
        `$1${canonicalSupabaseUrlDecl}
${canonicalSupabaseAnonDecl}
`,
      );
    }

    patched = patched
      .replace(/process\.env\.NEXT_PUBLIC_SUPABASE_URL!?/g, "supabaseUrl")
      .replace(/process\.env\.SUPABASE_URL!?/g, "supabaseUrl")
      .replace(
        /process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY!?/g,
        "supabaseAnonKey",
      )
      .replace(
        /process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!?/g,
        "supabaseAnonKey",
      );

    // Canonicalize declarations even if they currently self-reference or use legacy keys.
    patched = patched
      .replace(
        /\b(?:const|let|var)\s+supabaseUrl(?:\s*:\s*[^=]+)?\s*=\s*[^;\n]+;?/g,
        canonicalSupabaseUrlDecl,
      )
      .replace(
        /\b(?:const|let|var)\s+supabaseAnonKey(?:\s*:\s*[^=]+)?\s*=\s*[^;\n]+;?/g,
        canonicalSupabaseAnonDecl,
      );

    // Clean up stray statements produced by partial env replacement.
    patched = patched.replace(/^\s*supabase(?:Url|AnonKey)\s*;\s*$/gm, "");

    if (!/if\s*\(!supabaseUrl\s*\|\|\s*!supabaseAnonKey\)/.test(patched)) {
      patched = patched
        .replace(
          /export\s+async\s+function\s+middleware\s*\([^)]*\)\s*\{/,
          (m) =>
            `${m}\n  if (!supabaseUrl || !supabaseAnonKey) {\n    return NextResponse.next();\n  }`,
        )
        .replace(
          /export\s+function\s+middleware\s*\([^)]*\)\s*\{/,
          (m) =>
            `${m}\n  if (!supabaseUrl || !supabaseAnonKey) {\n    return NextResponse.next();\n  }`,
        );
    }

    return patched;
  }

  function ensureMobileOverflowGuard(content: string): string {
    if (/overflow-x\s*:\s*hidden/i.test(content)) {
      return content;
    }

    const guardRule = `html, body {
  max-width: 100%;
  overflow-x: hidden;
}`;

    return `${content.trim()}\n\n${guardRule}\n`;
  }

  function ensureTailwindLayerDirectives(content: string): string {
    const stripUnsupportedApplyUtilities = (css: string): string =>
      // Tailwind can hard-fail build on unknown @apply tokens (e.g. custom font-* utilities).
      // To keep generated projects compile-safe, remove @apply directives entirely.
      css.replace(/^\s*@apply\s+[^;]+;\s*$/gm, "");

    const hasLayerBase = /@layer\s+base\b/.test(content);
    const hasLayerComponents = /@layer\s+components\b/.test(content);
    const hasLayerUtilities = /@layer\s+utilities\b/.test(content);

    const hasTailwindBase = /@tailwind\s+base\s*;/.test(content);
    const hasTailwindComponents = /@tailwind\s+components\s*;/.test(content);
    const hasTailwindUtilities = /@tailwind\s+utilities\s*;/.test(content);

    const missing: string[] = [];
    if (hasLayerBase && !hasTailwindBase) missing.push("@tailwind base;");
    if (hasLayerComponents && !hasTailwindComponents) {
      missing.push("@tailwind components;");
    }
    if (hasLayerUtilities && !hasTailwindUtilities) {
      missing.push("@tailwind utilities;");
    }

    const normalized =
      missing.length === 0 ? content : `${missing.join("\n")}\n\n${content}`;
    return ensureMobileOverflowGuard(
      stripUnsupportedApplyUtilities(normalized),
    );
  }

  const fileMap = new Map(files.map((f) => [f.path, f]));
  const upsertFile = (path: string, content: string) => {
    const idx = files.findIndex((f) => f.path === path);
    if (idx >= 0) {
      files[idx] = { path, content };
      return;
    }
    files.push({ path, content });
  };
  const backendExplicitlyRequested =
    requested.requiresAuth || requested.requiresDatabase;
  const hasAuthIntegration = backendExplicitlyRequested;
  const hasDatabaseIntegration = requested.requiresDatabase;

  if (!backendExplicitlyRequested) {
    files = stripBackendScaffoldForPublicApps(files);
    dependencies = stripSupabaseDepsForPublicApps(dependencies);
    files = stripSupabaseEnvForPublicApps(files);
  }

  if (!fileMap.has("package.json")) {
    if (hasAuthIntegration) {
      dependencies["@supabase/supabase-js"] =
        dependencies["@supabase/supabase-js"] || "^2.57.4";
      dependencies["@supabase/ssr"] = dependencies["@supabase/ssr"] || "^0.7.0";
    }

    files.push({
      path: "package.json",
      content: JSON.stringify(
        {
          name: "generated-nextjs-app",
          version: "0.1.0",
          private: true,
          scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
            lint: "next lint",
          },
          dependencies,
          devDependencies: {
            "@types/node": "^20",
            "@types/react": "^19",
            "@types/react-dom": "^19",
            typescript: "^5",
            tailwindcss: "^4",
            "@tailwindcss/postcss": "^4",
          },
        },
        null,
        2,
      ),
    });
  } else if (hasAuthIntegration) {
    dependencies["@supabase/supabase-js"] =
      dependencies["@supabase/supabase-js"] || "^2.57.4";
    dependencies["@supabase/ssr"] = dependencies["@supabase/ssr"] || "^0.7.0";
  }

  if (!fileMap.has("tailwind.config.ts")) {
    files.push({
      path: "tailwind.config.ts",
      content: `import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
      },
    },
  },
  plugins: [],
};

export default config;`,
    });
  }

  if (!fileMap.has("app/globals.css")) {
    files.push({
      path: "app/globals.css",
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
  }
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
  }
}

html, body {
  max-width: 100%;
  overflow-x: hidden;
}`,
    });
  } else {
    files = files.map((file) => {
      if (file.path !== "app/globals.css") {
        return file;
      }

      return {
        ...file,
        content: ensureTailwindLayerDirectives(file.content),
      };
    });
  }

  if (!fileMap.has("app/loading.tsx")) {
    files.push({
      path: "app/loading.tsx",
      content: `export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      {/* Loading spinner */}
      <div className="text-center relative z-10">
        <div className="relative w-16 h-16 mx-auto mb-4">
          {/* Outer ring */}
          <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full"></div>
          {/* Spinning gradient ring */}
          <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 border-r-violet-500 rounded-full animate-spin"></div>
          {/* Middle ring */}
          <div
            className="absolute inset-2 border-4 border-transparent border-b-blue-400 border-l-violet-400 rounded-full animate-spin"
            style={{
              animationDirection: "reverse",
              animationDuration: "1.5s",
            }}
          ></div>
          {/* Inner dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-violet-500 rounded-full animate-pulse"></div>
          </div>
        </div>
        <p className="text-sm text-foreground/60">Loading...</p>
      </div>
    </div>
  );
}`,
    });
  }

  // Remove deprecated tenant-specific scaffolding.
  files = files.filter((file) => {
    const normalizedPath = file.path.replace(/\\/g, "/").toLowerCase();
    return (
      normalizedPath !== "lib/supabase/tenant.ts" &&
      normalizedPath !== "app/unauthorized/page.tsx"
    );
  });

  if (hasAuthIntegration) {
    upsertFile(
      "lib/supabase/client.ts",
      buildBrowserSupabaseClientContent(true),
    );
  }

  if (hasAuthIntegration) {
    upsertFile("lib/supabase/server.ts", buildServerSupabaseClientContent());
  }

  // Auth middleware, sign-in/signup pages, and API auth routes are now
  // generated by the AI model so they match the app's design and requirements.

  // Keep only the auth callback route (infra-level OAuth redirect handler).
  // All other auth routes/pages are AI-generated to match the app's design.
  if (hasAuthIntegration) {
    upsertFile(
      "app/auth/callback/route.ts",
      `import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const redirectUrl = new URL(next, origin);
  const response = NextResponse.redirect(redirectUrl);

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  if (code) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });
    await supabase.auth.exchangeCodeForSession(code);
  }

  return response;
}
`,
    );

    // signin/signup/signout/me/oauth API routes, middleware, auth-form-theme,
    // and sign-in/signup pages are intentionally NOT scaffolded here — the AI
    // model generates them as part of the project so they match the app's
    // design and requirements.
  }

  // --- REMOVED: hardcoded auth scaffolding ---
  // The following were removed so the AI generates them instead:
  // - app/api/auth/signin/route.ts
  // - app/api/auth/signup/route.ts
  // - app/api/auth/signout/route.ts
  // - app/api/auth/me/route.ts
  // - app/api/auth/oauth/route.ts
  // - lib/auth-form-theme.ts
  // - app/sign-in/page.tsx
  // - app/signup/page.tsx
  // - middleware.ts

  /* REMOVED: ~700 lines of hardcoded auth route scaffolding (signin, signup,
     signout, me, oauth API routes + sign-in/signup pages + auth-form-theme +
     middleware). The AI model now generates these files as part of the project
     so they match the app's design and brand. Only lib/supabase/client.ts,
     lib/supabase/server.ts, and app/auth/callback/route.ts are still
     scaffolded above since they are infrastructure-level plumbing. */

  if (
    (hasAuthIntegration || hasDatabaseIntegration) &&
    !fileMap.has("supabase/schema.sql")
  ) {
    files.push({
      path: "supabase/schema.sql",
      content: `-- No default SQL bootstrap is required for app-scoped auth.
-- Add your own schema here only when your app needs custom tables.
`,
    });
  }

  files = files.map((file) => {
    const normalizedPath = file.path.replace(/\\/g, "/").toLowerCase();
    if (normalizedPath === "lib/supabase/client.ts") {
      const useSsr = /@supabase\/ssr/.test(file.content);
      return { ...file, content: buildBrowserSupabaseClientContent(useSsr) };
    }
    if (normalizedPath === "lib/supabase/client.js") {
      const useSsr = /@supabase\/ssr/.test(file.content);
      return { ...file, content: buildBrowserSupabaseClientContent(useSsr) };
    }
    if (
      normalizedPath === "lib/supabase/server.ts" &&
      /@supabase\/ssr/.test(file.content)
    ) {
      return { ...file, content: buildServerSupabaseClientContent() };
    }
    if (
      normalizedPath === "lib/supabase/server.js" &&
      /@supabase\/ssr/.test(file.content)
    ) {
      return { ...file, content: buildServerSupabaseClientContent() };
    }
    if (
      normalizedPath === "middleware.ts" ||
      normalizedPath === "middleware.js"
    ) {
      return { ...file, content: normalizeMiddlewareSupabaseEnv(file.content) };
    }
    if (
      normalizedPath === "supabase/schema.sql" &&
      /user_tenants/i.test(file.content)
    ) {
      return {
        ...file,
        content: `-- No default SQL bootstrap is required for app-scoped auth.
-- This file intentionally omits tenant membership tables.
`,
      };
    }
    return file;
  });

  if (hasAuthIntegration || hasDatabaseIntegration) {
    const envValues: Record<string, string> = {};
    const existingEnvFile = files.find((f) => f.path === ".env.local");
    const existingEnv = parseEnvContent(existingEnvFile?.content || "");

    if (hasAuthIntegration) {
      const supabaseUrl =
        managedAuthConfig?.supabaseUrl ||
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.SUPABASE_URL ||
        "";
      const supabasePublishable =
        managedAuthConfig?.anonKey ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        "";

      if (supabaseUrl) {
        envValues.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
        envValues.SUPABASE_URL = supabaseUrl;
      }
      if (supabasePublishable) {
        envValues.NEXT_PUBLIC_SUPABASE_ANON_KEY = supabasePublishable;
        envValues.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = supabasePublishable;
      }
    }

    if (hasDatabaseIntegration) {
      const sharedSupabaseDatabaseUrl =
        resolveSharedSupabaseDatabaseUrl(existingEnv);
      if (!sharedSupabaseDatabaseUrl) {
        throw new Error(
          "Database integration requires Supabase Postgres. Set SUPABASE_SHARED_DATABASE_URL to your shared Supabase connection string.",
        );
      }

      envValues.DATABASE_URL = sharedSupabaseDatabaseUrl;
    }

    if (Object.keys(envValues).length > 0) {
      const envIndex = files.findIndex((f) => f.path === ".env.local");
      if (envIndex >= 0) {
        files[envIndex] = {
          ...files[envIndex],
          content: buildEnvContent(files[envIndex].content, envValues),
        };
      } else {
        files.push({
          path: ".env.local",
          content: buildEnvContent("", envValues),
        });
      }
    }
  }

  files = ensureProviderGuardsForGeneratedFiles(files);

  // Inject a pre-built not-found.tsx for all projects — saves AI tokens
  // and ensures a consistent, branded 404 page.
  upsertFile(
    "app/not-found.tsx",
    `import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      <div className="text-center max-w-md">
        <p className="text-8xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          404
        </p>
        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
          Page not found
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
          Sorry, the page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-gray-900 dark:bg-white px-5 py-2.5 text-sm font-medium text-white dark:text-gray-900 transition-all hover:opacity-90"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          Back to Home
        </Link>
      </div>
    </div>
  );
}
`,
  );

  return files;
}

function collectSyntaxIssues(files: GeneratedFile[]): LintIssue[] {
  const sourceFiles = files.filter((f) =>
    /\.(tsx|ts|jsx|js)$/.test(f.path.toLowerCase()),
  );

  const syntaxIssues: LintIssue[] = [];

  for (const file of sourceFiles) {
    const lower = file.path.toLowerCase();
    const scriptKind = lower.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : lower.endsWith(".ts")
        ? ts.ScriptKind.TS
        : lower.endsWith(".jsx")
          ? ts.ScriptKind.JSX
          : ts.ScriptKind.JS;

    const sf = ts.createSourceFile(
      file.path,
      file.content,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    const parseDiagnostics =
      (sf as unknown as { parseDiagnostics?: ts.Diagnostic[] })
        .parseDiagnostics || [];
    if (parseDiagnostics.length === 0) continue;

    const first = parseDiagnostics[0];
    const message = ts.flattenDiagnosticMessageText(first.messageText, "\n");
    const pos = first.start ?? 0;
    const lineCol = sf.getLineAndCharacterOfPosition(pos);
    syntaxIssues.push({
      path: file.path,
      line: lineCol.line + 1,
      column: lineCol.character + 1,
      rule: "typescript/parse",
      message,
    });
  }

  return syntaxIssues;
}

function hasUseClientDirective(content: string): boolean {
  const withoutBom = content.replace(/^\uFEFF/, "");
  const useClientRe =
    /^\s*(?:(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)\s*)*["']use client["']\s*;/;
  return useClientRe.test(withoutBom);
}

function lineColumnAt(
  content: string,
  index: number,
): { line: number; column: number } {
  const before = content.slice(0, Math.max(0, index));
  const lines = before.split("\n");
  return {
    line: lines.length,
    column: (lines[lines.length - 1]?.length ?? 0) + 1,
  };
}

function collectServerClientBoundaryIssues(
  files: GeneratedFile[],
): LintIssue[] {
  const appSourceFiles = files.filter((f) => {
    const normalizedPath = f.path.replace(/\\/g, "/");
    return (
      normalizedPath.startsWith("app/") &&
      (normalizedPath.endsWith(".tsx") || normalizedPath.endsWith(".jsx"))
    );
  });

  const issues: LintIssue[] = [];
  const eventHandlerRe = /\bon[A-Z][A-Za-z0-9_]*\s*=\s*\{/g;

  for (const file of appSourceFiles) {
    if (hasUseClientDirective(file.content)) continue;

    // Reset lastIndex to prevent state bleeding between files with global regex
    eventHandlerRe.lastIndex = 0;
    const match = eventHandlerRe.exec(file.content);
    if (!match) continue;

    const position = match.index;
    const before = file.content.slice(0, position);
    const lines = before.split("\n");
    const line = lines.length;
    const column = (lines[lines.length - 1]?.length ?? 0) + 1;
    const handlerName = match[0].split("=")[0]?.trim() || "event handler";

    issues.push({
      path: file.path,
      line,
      column,
      rule: "next/rsc-event-handler-in-server-component",
      message: `Server Component includes JSX ${handlerName}. Add "use client" at the top of this file or move interactive JSX into a dedicated Client Component.`,
    });
  }

  return issues;
}

const KNOWN_NEXT_IMPORT_FIXUPS: Record<string, string> = {
  link: "next/link",
  image: "next/image",
  navigation: "next/navigation",
  headers: "next/headers",
  server: "next/server",
  "font/google": "next/font/google",
};

function applyKnownImportSpecifierFixups(files: GeneratedFile[]): GeneratedFile[] {
  return files.map((file) => {
    if (!/\.(tsx|ts|jsx|js)$/.test(file.path.toLowerCase())) {
      return file;
    }

    let nextContent = file.content;
    for (const [wrongSpecifier, correctSpecifier] of Object.entries(
      KNOWN_NEXT_IMPORT_FIXUPS,
    )) {
      const fromRe = new RegExp(
        `\\bfrom\\s+["']${wrongSpecifier.replace("/", "\\/")}["']`,
        "g",
      );
      const importRe = new RegExp(
        `\\bimport\\(\\s*["']${wrongSpecifier.replace("/", "\\/")}["']\\s*\\)`,
        "g",
      );
      const requireRe = new RegExp(
        `\\brequire\\(\\s*["']${wrongSpecifier.replace("/", "\\/")}["']\\s*\\)`,
        "g",
      );
      nextContent = nextContent
        .replace(fromRe, `from "${correctSpecifier}"`)
        .replace(importRe, `import("${correctSpecifier}")`)
        .replace(requireRe, `require("${correctSpecifier}")`);
    }

    if (nextContent === file.content) return file;
    return { ...file, content: nextContent };
  });
}

function extractModuleSpecifiers(content: string): string[] {
  const specifiers = new Set<string>();
  const fromRe = /\bfrom\s+["']([^"']+)["']/g;
  const importRe = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
  const requireRe = /\brequire\(\s*["']([^"']+)["']\s*\)/g;

  for (const match of content.matchAll(fromRe)) {
    specifiers.add(String(match[1] || "").trim());
  }
  for (const match of content.matchAll(importRe)) {
    specifiers.add(String(match[1] || "").trim());
  }
  for (const match of content.matchAll(requireRe)) {
    specifiers.add(String(match[1] || "").trim());
  }
  return Array.from(specifiers).filter(Boolean);
}

function getPackageNameFromSpecifier(specifier: string): string {
  if (!specifier) return "";
  if (specifier.startsWith("@")) {
    const [scope, pkg] = specifier.split("/");
    return scope && pkg ? `${scope}/${pkg}` : specifier;
  }
  if (specifier.startsWith("next/")) return "next";
  if (specifier.startsWith("react-dom/")) return "react-dom";
  return specifier.split("/")[0] || specifier;
}

/**
 * Given an @/ import path (e.g. "@/components/auth-status"), returns true if
 * a file matching that path exists in the generated file list.
 * Tries common extensions and directory index files.
 */
function projectFileExistsForAlias(
  specifier: string,
  filePaths: Set<string>,
): boolean {
  // Strip the @/ prefix to get the bare path (e.g. "components/auth-status")
  const bare = specifier.slice(2); // remove "@/"
  const extensions = [".tsx", ".ts", ".jsx", ".js"];
  // Direct file with extension already included
  if (filePaths.has(bare)) return true;
  // Try appending common extensions
  for (const ext of extensions) {
    if (filePaths.has(`${bare}${ext}`)) return true;
  }
  // Try as directory index file
  for (const ext of extensions) {
    if (filePaths.has(`${bare}/index${ext}`)) return true;
  }
  return false;
}

function collectModuleResolutionIssues(
  files: GeneratedFile[],
  dependencies: Record<string, string>,
): LintIssue[] {
  const issues: LintIssue[] = [];
  const allowedCorePackages = new Set([
    "next",
    "react",
    "react-dom",
    "typescript",
    "tailwindcss",
    "postcss",
    "autoprefixer",
  ]);

  // Build a set of all normalised file paths in the project for @/ resolution.
  const allFilePaths = new Set(
    files.map((f) => f.path.replace(/\\/g, "/")),
  );

  const sourceFiles = files.filter((f) =>
    /\.(tsx|ts|jsx|js)$/.test(f.path.toLowerCase()),
  );

  for (const file of sourceFiles) {
    const specifiers = extractModuleSpecifiers(file.content);
    for (const specifier of specifiers) {
      if (!specifier || specifier.startsWith("node:")) {
        continue;
      }

      // Validate @/ alias imports — check the referenced file exists in the project.
      if (specifier.startsWith("@/")) {
        if (!projectFileExistsForAlias(specifier, allFilePaths)) {
          const idx = file.content.indexOf(`"${specifier}"`);
          const altIdx = file.content.indexOf(`'${specifier}'`);
          const matchIdx = idx >= 0 ? idx : altIdx >= 0 ? altIdx : 0;
          const pos = lineColumnAt(file.content, matchIdx);
          issues.push({
            path: file.path,
            line: pos.line,
            column: pos.column,
            rule: "module/missing-local-file",
            message: `Module "${specifier}" is imported but the file does not exist in the project. Either create the missing file or remove this import.`,
          });
        }
        continue;
      }

      // Skip relative and absolute imports — not our concern here.
      if (specifier.startsWith(".") || specifier.startsWith("/")) {
        continue;
      }

      const nextFixup = KNOWN_NEXT_IMPORT_FIXUPS[specifier];
      if (nextFixup) {
        const idx = file.content.indexOf(`"${specifier}"`);
        const pos = lineColumnAt(file.content, idx >= 0 ? idx : 0);
        issues.push({
          path: file.path,
          line: pos.line,
          column: pos.column,
          rule: "next/invalid-module-specifier",
          message: `Invalid module "${specifier}". Use "${nextFixup}" instead.`,
        });
        continue;
      }

      const pkg = getPackageNameFromSpecifier(specifier);
      if (!pkg) continue;
      if (dependencies[pkg] || allowedCorePackages.has(pkg)) continue;

      const idx = file.content.indexOf(`"${specifier}"`);
      const pos = lineColumnAt(file.content, idx >= 0 ? idx : 0);
      issues.push({
        path: file.path,
        line: pos.line,
        column: pos.column,
        rule: "module/unresolved-dependency",
        message: `Module "${specifier}" is imported but missing from dependencies. Either add "${pkg}" to dependencies or replace the import with a supported module.`,
      });
    }
  }

  return issues;
}

function collectNextJsValidationIssues(
  files: GeneratedFile[],
  dependencies: Record<string, string>,
): LintIssue[] {
  const appAndComponentSourceFiles = files.filter((f) => {
    const normalizedPath = f.path.replace(/\\/g, "/");
    return (
      (normalizedPath.startsWith("app/") ||
        normalizedPath.startsWith("components/") ||
        normalizedPath.startsWith("app/components/")) &&
      (normalizedPath.endsWith(".tsx") || normalizedPath.endsWith(".jsx"))
    );
  });

  const issues: LintIssue[] = [
    ...collectServerClientBoundaryIssues(files),
    ...collectModuleResolutionIssues(files, dependencies),
  ];

  const nextClientHooks = [
    "useRouter",
    "useSearchParams",
    "usePathname",
    "useParams",
    "useSelectedLayoutSegment",
    "useSelectedLayoutSegments",
  ];
  const hookCallRe = new RegExp(`\\b(${nextClientHooks.join("|")})\\s*\\(`);
  const navigationImportRe = /from\s+["']next\/navigation["']/;

  for (const file of appAndComponentSourceFiles) {
    const content = file.content;
    const isClient = hasUseClientDirective(content);

    // next/navigation client hooks used in server components
    if (
      !isClient &&
      navigationImportRe.test(content) &&
      hookCallRe.test(content)
    ) {
      const match = content.match(hookCallRe);
      const idx = match?.index ?? 0;
      const pos = lineColumnAt(content, idx);
      issues.push({
        path: file.path,
        line: pos.line,
        column: pos.column,
        rule: "next/rsc-client-hook-in-server-component",
        message:
          'Detected next/navigation client hook usage in a Server Component. Add "use client" or move this logic into a Client Component.',
      });
    }

    // Server-only modules imported in client components
    if (isClient) {
      const serverImportRe =
        /from\s+["'](?:next\/headers|next\/server|server-only)["']/;
      const serverImportMatch = content.match(serverImportRe);
      if (serverImportMatch) {
        const idx = serverImportMatch.index ?? 0;
        const pos = lineColumnAt(content, idx);
        issues.push({
          path: file.path,
          line: pos.line,
          column: pos.column,
          rule: "next/client-imports-server-only-module",
          message:
            "Client Component imports a server-only module (next/headers, next/server, or server-only). Move that code to server files.",
        });
      }
    }

    // metadata/generateMetadata are server-only and invalid in "use client" files
    if (isClient) {
      const metadataRe =
        /\bexport\s+(?:const\s+metadata|async\s+function\s+generateMetadata|function\s+generateMetadata)\b/;
      const metadataMatch = content.match(metadataRe);
      if (metadataMatch) {
        const idx = metadataMatch.index ?? 0;
        const pos = lineColumnAt(content, idx);
        issues.push({
          path: file.path,
          line: pos.line,
          column: pos.column,
          rule: "next/client-metadata-export",
          message:
            "Client Component cannot export metadata/generateMetadata. Keep metadata exports in Server Components.",
        });
      }
    }

    // async default client components are invalid
    if (isClient) {
      const asyncClientDefaultRe = /\bexport\s+default\s+async\s+function\b/;
      const asyncMatch = content.match(asyncClientDefaultRe);
      if (asyncMatch) {
        const idx = asyncMatch.index ?? 0;
        const pos = lineColumnAt(content, idx);
        issues.push({
          path: file.path,
          line: pos.line,
          column: pos.column,
          rule: "next/async-client-component",
          message:
            "Client Component default export is async. Move async work to server/actions or use effects/hooks on client.",
        });
      }
    }
  }

  return issues;
}

function collectResponsiveAndNavIssues(files: GeneratedFile[]): LintIssue[] {
  const sourceFiles = files.filter((f) =>
    /\.(tsx|ts|jsx|js)$/.test(f.path.toLowerCase()),
  );
  const issues: LintIssue[] = [];

  const navFiles = sourceFiles.filter((f) => /<nav[\s>]/i.test(f.content));
  if (navFiles.length === 0) {
    issues.push({
      path: "app/page.tsx",
      line: 1,
      column: 1,
      rule: "ux/navigation-required",
      message:
        "Missing navigation section. Add a responsive navbar with desktop links and mobile menu toggle.",
    });
  } else {
    const hasResponsiveVisibility = navFiles.some((f) =>
      /\b(?:sm|md|lg|xl|2xl):(?:hidden|block|flex|grid)\b/.test(f.content),
    );
    const hasMenuToggleLogic = navFiles.some((f) =>
      /\b(?:aria-expanded|isMenuOpen|menuOpen|setIsMenuOpen|setMenuOpen|toggleMenu)\b/.test(
        f.content,
      ),
    );
    const hasMenuButton = navFiles.some((f) =>
      /<button[\s\S]*?(?:menu|nav|open|close|aria-label)/i.test(f.content),
    );

    if (!hasResponsiveVisibility || !hasMenuToggleLogic || !hasMenuButton) {
      issues.push({
        path: navFiles[0].path,
        line: 1,
        column: 1,
        rule: "ux/mobile-navbar",
        message:
          "Navbar is not fully mobile-ready. Add hamburger button, menu open/close state, responsive visibility classes, and accessibility attributes.",
      });
    }

    const hasPinnedHeader = navFiles.some(
      (f) =>
        /\b(?:sticky|fixed)\b[\s\S]{0,120}\btop-0\b/i.test(f.content) ||
        /\btop-0\b[\s\S]{0,120}\b(?:sticky|fixed)\b/i.test(f.content),
    );
    const hasNavLayering = navFiles.some(
      (f) =>
        /\bz-(?:[4-9]\d|[1-9]\d{2,})\b/.test(f.content) ||
        /\bz-\[\d+\]/.test(f.content) ||
        /zIndex\s*:\s*(?:[4-9]\d|[1-9]\d{2,})/.test(f.content),
    );
    if (!hasPinnedHeader || !hasNavLayering) {
      issues.push({
        path: navFiles[0].path,
        line: 1,
        column: 1,
        rule: "ux/navbar-stacking",
        message:
          "Navbar/header must stay pinned at the top and above content. Use sticky/fixed + top-0 and a high z-index to avoid hidden/overlapped nav on mobile.",
      });
    }

    const hasNestedMenuScrolling = navFiles.some(
      (f) =>
        /className\s*=\s*["'\x60][^"'\x60]*(?:mobile-menu|menu|drawer)[^"'\x60]*(?:overflow-y-(?:auto|scroll)|overflow-(?:auto|scroll))[^"'\x60]*["'\x60]/i.test(
          f.content,
        ) ||
        /className\s*=\s*["'\x60][^"'\x60]*(?:overflow-y-(?:auto|scroll)|overflow-(?:auto|scroll))[^"'\x60]*(?:mobile-menu|menu|drawer)[^"'\x60]*["'\x60]/i.test(
          f.content,
        ),
    );
    const hasScrollableNavContainer = navFiles.some(
      (f) =>
        /<(?:nav|header)[^>]*className\s*=\s*["'\x60][^"'\x60]*(?:overflow-y-(?:auto|scroll)|overflow-(?:auto|scroll))[^"'\x60]*["'\x60]/i.test(
          f.content,
        ) ||
        /<(?:nav|header)[^>]*style=\{\{[^}]*overflowY\s*:\s*["'](?:auto|scroll)["']/i.test(
          f.content,
        ),
    );
    if (hasNestedMenuScrolling || hasScrollableNavContainer) {
      issues.push({
        path: navFiles[0].path,
        line: 1,
        column: 1,
        rule: "ux/navbar-nested-scroll",
        message:
          "Avoid independent scrollbar containers in navbar/mobile menu wrappers. Keep nav top-anchored and avoid overflow-y-auto/scroll on header/nav/menu containers.",
      });
    }

    const hasMenuOverlayPattern = navFiles.some((f) => {
      const hasToggle =
        /\b(?:aria-expanded|isMenuOpen|menuOpen|mobileMenuOpen|openMenu|toggleMenu)\b/.test(
          f.content,
        );
      if (!hasToggle) return false;

      const hasRawOverlayClasses =
        /(?:fixed|absolute)[\s\S]{0,180}(?:top-0|inset-0|inset-x-0)/i.test(
          f.content,
        ) &&
        /(?:z-(?:[5-9]\d|[1-9]\d{2,})|z-\[\d+\]|zIndex\s*:\s*(?:[5-9]\d|[1-9]\d{2,}))/i.test(
          f.content,
        );

      // Accept common overlay abstractions (shadcn/radix/custom portal wrappers)
      // where fixed positioning/z-index may be encapsulated inside library components.
      const usesOverlayComponent =
        /<(?:Sheet|SheetContent|Drawer|DrawerContent|Dialog|DialogContent|Modal|Portal)\b/.test(
          f.content,
        ) ||
        /@radix-ui\/react-(?:dialog|popover|portal)/.test(f.content) ||
        /\bcreatePortal\s*\(/.test(f.content);

      return hasRawOverlayClasses || usesOverlayComponent;
    });
    if (hasMenuToggleLogic && !hasMenuOverlayPattern) {
      issues.push({
        path: navFiles[0].path,
        line: 1,
        column: 1,
        rule: "ux/mobile-menu-overlay",
        message:
          "Mobile menu overlay is missing robust layering. Use fixed/absolute top-anchored panel (top-0/inset) with strong z-index so it never renders behind page content.",
      });
    }

    const hasMenuReadableBackground = navFiles.some((f) => {
      const hasExplicitReadableBg =
        /(?:mobile-menu|menu|drawer|nav-panel|menu-panel)[\s\S]{0,120}(?:bg-[\w\[\]\/-]+|backdrop-blur|style=\{\{[^}]*background)/i.test(
          f.content,
        ) ||
        /(?:fixed|absolute)[\s\S]{0,120}(?:bg-[\w\[\]\/-]+|backdrop-blur)/i.test(
          f.content,
        );

      const usesOverlayComponent =
        /<(?:SheetContent|DrawerContent|DialogContent|Modal)\b/.test(
          f.content,
        ) || /@radix-ui\/react-(?:dialog|popover|portal)/.test(f.content);

      return hasExplicitReadableBg || usesOverlayComponent;
    });
    if (hasMenuToggleLogic && !hasMenuReadableBackground) {
      issues.push({
        path: navFiles[0].path,
        line: 1,
        column: 1,
        rule: "ux/mobile-menu-visibility",
        message:
          "Mobile menu needs clear visibility. Add a solid/semi-opaque background and readable contrast so links are visible when menu opens.",
      });
    }

    const hasFullHeightMenuPanel = navFiles.some(
      (f) =>
        /\b(?:mobile-menu|menu|drawer|nav-panel|menu-panel)\b[\s\S]{0,160}\b(?:h-screen|min-h-screen|h-dvh|min-h-dvh|h-\[100dvh\]|min-h-\[100dvh\]|inset-y-0|top-0\s+bottom-0)\b/i.test(
          f.content,
        ) ||
        /(?:fixed|absolute)[\s\S]{0,180}\b(?:h-screen|min-h-screen|h-dvh|min-h-dvh|h-\[100dvh\]|min-h-\[100dvh\]|inset-y-0|top-0\s+bottom-0)\b/i.test(
          f.content,
        ) ||
        /<SheetContent[^>]*\bside=["'](?:left|right)["']/i.test(f.content),
    );
    if (hasMenuToggleLogic && !hasFullHeightMenuPanel) {
      issues.push({
        path: navFiles[0].path,
        line: 1,
        column: 1,
        rule: "ux/mobile-menu-height",
        message:
          "Mobile menu should occupy full phone height. Use h-screen/min-h-screen/100dvh or inset-y-0 so users do not need awkward inner scrolling.",
      });
    }
  }

  const hasResponsiveClasses = sourceFiles.some((f) =>
    /\b(?:sm|md|lg|xl|2xl):/.test(f.content),
  );
  if (!hasResponsiveClasses) {
    issues.push({
      path: "app/page.tsx",
      line: 1,
      column: 1,
      rule: "ux/responsive-breakpoints",
      message:
        "No responsive breakpoint classes detected. Add mobile-first responsive classes for key sections.",
    });
  }

  const globals = files.find((f) => f.path === "app/globals.css");
  if (globals && !/overflow-x\s*:\s*hidden/i.test(globals.content)) {
    issues.push({
      path: "app/globals.css",
      line: 1,
      column: 1,
      rule: "ux/mobile-overflow-guard",
      message:
        "Add mobile overflow guard (html, body { max-width: 100%; overflow-x: hidden; }) to prevent horizontal scrolling.",
    });
  }

  return issues;
}

function validateSyntaxOrThrow(files: GeneratedFile[]) {
  const syntaxIssues = collectSyntaxIssues(files);
  if (syntaxIssues.length > 0) {
    const first = syntaxIssues[0];
    throw new Error(
      `Generated code contains syntax errors. First issue: ${first.path}:${first.line}:${first.column} ${first.message}`,
    );
  }
}

function extractSupabaseTableReferences(files: GeneratedFile[]): string[] {
  const tableNames = new Set<string>();
  const codeFiles = files.filter(
    (f) =>
      f.path.endsWith(".ts") ||
      f.path.endsWith(".tsx") ||
      f.path.endsWith(".js") ||
      f.path.endsWith(".jsx"),
  );

  for (const file of codeFiles) {
    const re = /\.from\(\s*["'`]([a-zA-Z0-9_.-]+)["'`]\s*\)/g;
    for (const match of file.content.matchAll(re)) {
      const raw = String(match[1] || "").trim();
      if (!raw) continue;
      const lowered = raw.toLowerCase();
      if (
        lowered.startsWith("auth.") ||
        lowered.startsWith("storage.") ||
        lowered.startsWith("information_schema.") ||
        lowered.startsWith("pg_catalog.")
      ) {
        continue;
      }
      const normalized = lowered.includes(".")
        ? lowered.split(".").pop() || lowered
        : lowered;
      if (normalized) {
        tableNames.add(normalized);
      }
    }
  }

  return Array.from(tableNames.values()).sort();
}

function extractCreatedTablesFromSql(sql: string): Set<string> {
  const tables = new Set<string>();
  const re =
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:public|auth)\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
  for (const match of sql.matchAll(re)) {
    const table = String(match[1] || "").toLowerCase();
    if (table) {
      tables.add(table);
    }
  }
  return tables;
}

function extractColumnReferencesFromCode(
  files: GeneratedFile[],
): Map<string, Set<string>> {
  const tableColumns = new Map<string, Set<string>>();
  const codeFiles = files.filter(
    (f) =>
      f.path.endsWith(".ts") ||
      f.path.endsWith(".tsx") ||
      f.path.endsWith(".js") ||
      f.path.endsWith(".jsx"),
  );

  for (const file of codeFiles) {
    // Match .from("table").select("col1, col2") patterns
    const selectRegex =
      /\.from\(\s*["'`](\w+)["'`]\s*\)\s*\.select\(\s*["'`]([^"'`]+)["'`]/g;
    for (const m of file.content.matchAll(selectRegex)) {
      const table = m[1].toLowerCase();
      const cols = m[2]
        .split(",")
        .map((c) => c.trim().split(":")[0].trim())
        // Skip relation joins like "profiles(username, avatar_url)" — these
        // reference another table, not columns of the current table.
        .filter((c) => !c.includes("(") && !c.includes(")"))
        .map((c) => c.trim());
      if (!tableColumns.has(table)) tableColumns.set(table, new Set());
      for (const col of cols) {
        if (col && col !== "*" && !col.includes("!")) {
          tableColumns.get(table)!.add(col);
        }
      }
    }

    // Match .from("table").insert({ col1: val, col2: val }) patterns
    const insertRegex =
      /\.from\(\s*["'`](\w+)["'`]\s*\)\s*\.(?:insert|upsert)\(\s*(?:\[?\s*)\{([^}]+)\}/g;
    for (const m of file.content.matchAll(insertRegex)) {
      const table = m[1].toLowerCase();
      const body = m[2];
      const colRegex = /(\w+)\s*:/g;
      if (!tableColumns.has(table)) tableColumns.set(table, new Set());
      for (const colMatch of body.matchAll(colRegex)) {
        tableColumns.get(table)!.add(colMatch[1]);
      }
    }

    // Match .from("table").update({ col1: val }) patterns
    const updateRegex =
      /\.from\(\s*["'`](\w+)["'`]\s*\)\s*\.update\(\s*\{([^}]+)\}/g;
    for (const m of file.content.matchAll(updateRegex)) {
      const table = m[1].toLowerCase();
      const body = m[2];
      const colRegex = /(\w+)\s*:/g;
      if (!tableColumns.has(table)) tableColumns.set(table, new Set());
      for (const colMatch of body.matchAll(colRegex)) {
        tableColumns.get(table)!.add(colMatch[1]);
      }
    }
  }

  return tableColumns;
}

function extractColumnsFromSchemaTable(
  schemaSql: string,
): Map<string, Set<string>> {
  const tableColumns = new Map<string, Set<string>>();
  const tableRegex =
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:public|auth)\.)?"?(\w+)"?\s*\(([\s\S]*?)\);/gi;

  for (const m of schemaSql.matchAll(tableRegex)) {
    const tableName = m[1].toLowerCase();
    const body = m[2];
    const columns = new Set<string>();

    for (const line of body.split("\n")) {
      const trimmed = line.trim().toLowerCase();
      if (!trimmed) continue;
      if (
        /^(constraint|primary|foreign|unique|check)\b/.test(trimmed)
      )
        continue;
      const colMatch = trimmed.match(/^"?(\w+)"?\s+/);
      if (colMatch) columns.add(colMatch[1]);
    }

    tableColumns.set(tableName, columns);
  }

  return tableColumns;
}

function extractForeignKeysFromSql(
  schemaSql: string,
): Array<{ fromTable: string; fromColumn: string; toTable: string; toColumn: string }> {
  const fks: Array<{ fromTable: string; fromColumn: string; toTable: string; toColumn: string }> = [];
  const tableRegex =
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:public|auth)\.)?"?(\w+)"?\s*\(([\s\S]*?)\);/gi;

  for (const m of schemaSql.matchAll(tableRegex)) {
    const tableName = m[1].toLowerCase();
    const body = m[2];

    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Match inline FK: column_name type REFERENCES table(column)
      const inlineFk = trimmed.match(
        /^"?(\w+)"?\s+\w+.*?\bREFERENCES\s+(?:(?:public|auth)\.)?"?(\w+)"?\s*\(\s*"?(\w+)"?\s*\)/i,
      );
      if (inlineFk) {
        const toTable = inlineFk[2].toLowerCase();
        // Skip auth.users references — they don't create PostgREST-joinable relationships to public tables
        if (toTable !== "users") {
          fks.push({
            fromTable: tableName,
            fromColumn: inlineFk[1].toLowerCase(),
            toTable,
            toColumn: inlineFk[3].toLowerCase(),
          });
        }
      }
    }
  }

  return fks;
}

function collectSupabaseSchemaIssues(
  files: GeneratedFile[],
  requirements: IntegrationRequirements,
): LintIssue[] {
  if (!requirements.requiresDatabase) return [];

  const issues: LintIssue[] = [];
  const schemaFile = files.find(
    (f) => f.path.replace(/\\/g, "/").toLowerCase() === "supabase/schema.sql",
  );

  if (!schemaFile) {
    issues.push({
      path: "supabase/schema.sql",
      line: 1,
      column: 1,
      rule: "schema/missing-file",
      message:
        "Database integration requires supabase/schema.sql with CREATE TABLE statements.",
    });
    return issues;
  }

  const schemaContent = schemaFile.content || "";
  const createdTables = extractCreatedTablesFromSql(schemaContent);
  const referencedTables = extractSupabaseTableReferences(files);

  if (createdTables.size === 0) {
    issues.push({
      path: "supabase/schema.sql",
      line: 1,
      column: 1,
      rule: "schema/no-create-table",
      message:
        "supabase/schema.sql must include CREATE TABLE statements for app persistence.",
    });
  }

  for (const table of referencedTables) {
    if (!createdTables.has(table)) {
      issues.push({
        path: "supabase/schema.sql",
        line: 1,
        column: 1,
        rule: "schema/missing-table",
        message: `Table "${table}" is used in code via supabase.from(...) but not created in supabase/schema.sql.`,
      });
    }
  }

  // Relation join validation: check that .select('*, other_table(...)') references real tables
  // AND that a direct foreign key exists between the source table and joined table.
  // PostgREST only resolves joins via direct FK relationships.
  const foreignKeys = extractForeignKeysFromSql(schemaContent);
  const codeFiles = files.filter(
    (f) =>
      f.path.endsWith(".ts") ||
      f.path.endsWith(".tsx") ||
      f.path.endsWith(".js") ||
      f.path.endsWith(".jsx"),
  );
  for (const file of codeFiles) {
    const joinRegex =
      /\.from\(\s*["'`](\w+)["'`]\s*\)\s*\.select\(\s*["'`]([^"'`]+)["'`]/g;
    for (const m of file.content.matchAll(joinRegex)) {
      const sourceTable = m[1].toLowerCase();
      const selectStr = m[2];
      // Extract relation join table names like "profiles(username, avatar_url)"
      const relationRegex = /(\w+)\s*\(/g;
      for (const rel of selectStr.matchAll(relationRegex)) {
        const joinedTable = rel[1].toLowerCase();
        // Skip non-table tokens like "count" or "*"
        if (joinedTable === "count" || joinedTable === "inner" || joinedTable === "left" || joinedTable === "exact") continue;
        if (!createdTables.has(joinedTable)) {
          issues.push({
            path: file.path,
            line: 1,
            column: 1,
            rule: "schema/invalid-relation-join",
            message: `Code joins to table "${joinedTable}" in a .select() call, but "${joinedTable}" does not exist in supabase/schema.sql. Either create the table or remove the join. Do NOT assume a "profiles" table exists — use auth.users via supabase.auth.getUser() for user data.`,
          });
        } else {
          // Table exists — check that there's a direct FK between source and joined table
          const hasDirectFk = foreignKeys.some(
            (fk) =>
              (fk.fromTable === sourceTable && fk.toTable === joinedTable) ||
              (fk.fromTable === joinedTable && fk.toTable === sourceTable),
          );
          if (!hasDirectFk) {
            issues.push({
              path: file.path,
              line: 1,
              column: 1,
              rule: "schema/missing-fk-for-join",
              message: `Code does .from("${sourceTable}").select("*, ${joinedTable}(...)") but there is no direct foreign key between "${sourceTable}" and "${joinedTable}" in supabase/schema.sql. PostgREST requires a direct FK to resolve joins. If "${sourceTable}" has a user_id column and you want to join "${joinedTable}", add: user_id uuid REFERENCES ${joinedTable}(id). Do NOT reference auth.users(id) if you need to join to "${joinedTable}".`,
            });
          }
        }
      }
    }
  }

  // Column-level validation: check that columns used in code exist in schema
  const codeColumnRefs = extractColumnReferencesFromCode(files);
  const schemaColumns = extractColumnsFromSchemaTable(schemaContent);

  for (const [table, cols] of codeColumnRefs) {
    const schemaCols = schemaColumns.get(table);
    if (!schemaCols) continue; // Table-level miss already reported above
    for (const col of cols) {
      if (
        !schemaCols.has(col) &&
        col !== "id" &&
        col !== "created_at" &&
        col !== "updated_at"
      ) {
        issues.push({
          path: "supabase/schema.sql",
          line: 1,
          column: 1,
          rule: "schema/missing-column",
          message: `Column "${col}" is used in code for table "${table}" but not defined in supabase/schema.sql. Add it to the CREATE TABLE statement.`,
        });
      }
    }
  }

  return issues;
}

function buildSchemaBootstrapSql(schemaSql: string): string {
  const trimmed = schemaSql.trim();
  const prelude = `create extension if not exists "pgcrypto";`;
  if (!trimmed) return prelude;

  const escapeSqlLiteral = (value: string) => value.replace(/'/g, "''");

  const normalized = trimmed.replace(/\r\n/g, "\n");

  // Make common DDL idempotent across repeated edit runs.
  const withIdempotentCreates = normalized
    .replace(
      /\bcreate\s+table\s+(?!if\s+not\s+exists\b)/gi,
      "create table if not exists ",
    )
    .replace(
      /\bcreate\s+index\s+(?!if\s+not\s+exists\b)/gi,
      "create index if not exists ",
    )
    .replace(
      /\bcreate\s+unique\s+index\s+(?!if\s+not\s+exists\b)/gi,
      "create unique index if not exists ",
    );

  // CREATE POLICY can fail with 42710 if rerun. Pre-drop matching policies.
  const policyDrops: string[] = [];
  const policyRe =
    /\bcreate\s+policy\s+("[^"]+"|[A-Za-z_][\w$]*)\s+on\s+((?:"[^"]+"|[A-Za-z_][\w$]*)(?:\.(?:"[^"]+"|[A-Za-z_][\w$]*))?)[\s\S]*?;/gi;
  let match: RegExpExecArray | null;
  while ((match = policyRe.exec(withIdempotentCreates)) !== null) {
    const policyName = match[1];
    const tableName = match[2];
    const tableLookup = escapeSqlLiteral(tableName);
    const dropStmt = escapeSqlLiteral(
      `drop policy if exists ${policyName} on ${tableName};`,
    );
    policyDrops.push(`do $$ begin
  if to_regclass('${tableLookup}') is not null then
    execute '${dropStmt}';
  end if;
end $$;`);
  }

  const dedupedDrops = Array.from(new Set(policyDrops));
  const policyPrelude =
    dedupedDrops.length > 0
      ? `-- idempotent policy reset for repeat runs\n${dedupedDrops.join("\n")}\n`
      : "";

  // Guard RLS/policy statements so missing tables do not fail bootstrap.
  const withGuardedRls = withIdempotentCreates.replace(
    /\balter\s+table\s+((?:"[^"]+"|[A-Za-z_][\w$]*)(?:\.(?:"[^"]+"|[A-Za-z_][\w$]*))?)\s+(enable|disable|force|no\s+force)\s+row\s+level\s+security\s*;/gi,
    (stmt, tableExpr: string) => {
      const tableLookup = escapeSqlLiteral(tableExpr);
      const executeStmt = escapeSqlLiteral(String(stmt).trim());
      return `do $$ begin
  if to_regclass('${tableLookup}') is not null then
    execute '${executeStmt}';
  end if;
end $$;`;
    },
  );

  const withGuardedPolicies = withGuardedRls.replace(
    /\bcreate\s+policy\s+("[^"]+"|[A-Za-z_][\w$]*)\s+on\s+((?:"[^"]+"|[A-Za-z_][\w$]*)(?:\.(?:"[^"]+"|[A-Za-z_][\w$]*))?)[\s\S]*?;/gi,
    (stmt, _policyName: string, tableExpr: string) => {
      const tableLookup = escapeSqlLiteral(tableExpr);
      const executeStmt = String(stmt).trim();
      const executeDollarTag = "$policy$";
      return `do $$ begin
  if to_regclass('${tableLookup}') is not null then
    execute ${executeDollarTag}${executeStmt}${executeDollarTag};
  end if;
end $$;`;
    },
  );

  // Generate ALTER TABLE ADD COLUMN IF NOT EXISTS for every column to handle
  // schema drift between repeated edits (CREATE TABLE IF NOT EXISTS won't add
  // new columns to an existing table).
  // We extract only the column name and base type (e.g. "text", "uuid",
  // "integer", "timestamptz", "varchar(255)"). Constraints like NOT NULL,
  // DEFAULT, REFERENCES are intentionally omitted — ALTER ADD COLUMN with a
  // bare DEFAULT (no value) causes a syntax error, and NOT NULL on a
  // populated table would fail anyway.
  const alterColumnStatements: string[] = [];
  const colTableRegex =
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:public)\.)?"?(\w+)"?\s*\(([\s\S]*?)\);/gi;
  for (const colMatch of withGuardedPolicies.matchAll(colTableRegex)) {
    const tblName = colMatch[1];
    const body = colMatch[2];
    for (const line of body.split("\n")) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      if (
        /^(constraint|primary|foreign|unique|check)\b/i.test(trimmedLine)
      )
        continue;
      // Match column name and base SQL type only (e.g. "text", "uuid",
      // "integer", "varchar(255)", "timestamp with time zone").
      // Stop before NOT NULL / DEFAULT / REFERENCES / CHECK / UNIQUE / ,.
      const colDef = trimmedLine.match(
        /^"?(\w+)"?\s+((?:character\s+varying|timestamp\s+with(?:out)?\s+time\s+zone|double\s+precision|[\w]+)(?:\(\d+(?:,\s*\d+)?\))?)/i,
      );
      if (!colDef) continue;
      const colName = colDef[1];
      // Skip the primary key column — it's created with the table
      if (colName.toLowerCase() === "id") continue;
      const colType = colDef[2].trim();
      alterColumnStatements.push(
        `do $$ begin\n  if to_regclass('${escapeSqlLiteral(tblName)}') is not null then\n    alter table "${tblName}" add column if not exists "${colName}" ${colType};\n  end if;\nend $$;`,
      );
    }
  }

  const alterPhase =
    alterColumnStatements.length > 0
      ? `\n-- phase 2: ensure all columns exist (handles schema drift between edits)\n${alterColumnStatements.join("\n")}\n`
      : "";

  // Phase 3: Ensure foreign key constraints match the schema.
  // If a column exists but its FK points to the wrong table (e.g. auth.users
  // instead of profiles), DROP the old constraint and ADD the correct one.
  // This fixes PostgREST join errors like PGRST200.
  const fkRepairStatements: string[] = [];
  const fkTableRegex =
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:public)\.)?"?(\w+)"?\s*\(([\s\S]*?)\);/gi;
  for (const fkMatch of schemaSql.matchAll(fkTableRegex)) {
    const tblName = fkMatch[1];
    const body = fkMatch[2];
    for (const line of body.split("\n")) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      // Match column with REFERENCES to a public table (not auth.users)
      const fkDef = trimmedLine.match(
        /^"?(\w+)"?\s+\w+.*?\bREFERENCES\s+(?:public\.)?"?(\w+)"?\s*\(\s*"?(\w+)"?\s*\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i,
      );
      if (!fkDef) continue;
      const colName = fkDef[1];
      const refTable = fkDef[2];
      const refCol = fkDef[3];
      const onDelete = fkDef[4] ? ` on delete ${fkDef[4]}` : "";
      // Skip auth.users references — those are handled by Supabase itself
      if (refTable.toLowerCase() === "users") continue;
      // Skip self-references or id columns
      if (colName.toLowerCase() === "id") continue;

      const constraintName = `${tblName}_${colName}_fkey`;
      // If the FK references "profiles", backfill missing profiles from
      // auth.users first so existing rows don't violate the new constraint.
      const backfillBlock =
        refTable.toLowerCase() === "profiles" && refCol.toLowerCase() === "id"
          ? `\n    -- backfill missing profiles so existing rows don't violate the FK\n    insert into "profiles" (id, email)\n    select distinct "${tblName}"."${colName}", u.email\n    from "${tblName}"\n    join auth.users u on u.id = "${tblName}"."${colName}"\n    where "${tblName}"."${colName}" not in (select id from "profiles")\n    on conflict (id) do nothing;`
          : "";
      fkRepairStatements.push(
        `do $$ begin\n  if to_regclass('${escapeSqlLiteral(tblName)}') is not null then\n    alter table "${tblName}" drop constraint if exists "${constraintName}";${backfillBlock}\n    begin\n      alter table "${tblName}" add constraint "${constraintName}" foreign key ("${colName}") references "${refTable}"("${refCol}")${onDelete};\n    exception when others then\n      raise notice 'FK ${constraintName} could not be added: %', SQLERRM;\n    end;\n  end if;\nend $$;`,
      );
    }
  }

  const fkPhase =
    fkRepairStatements.length > 0
      ? `\n-- phase 3: ensure foreign key constraints match schema (fixes PostgREST join errors)\n${fkRepairStatements.join("\n")}\n`
      : "";

  return `${prelude}\n\n${policyPrelude}${withGuardedPolicies}\n${alterPhase}${fkPhase}`;
}

function buildTableCreationPhaseSql(schemaSql: string): string {
  const trimmed = schemaSql.trim();
  const prelude = `create extension if not exists "pgcrypto";`;
  if (!trimmed) return prelude;

  const normalized = trimmed.replace(/\r\n/g, "\n");
  const createTableStatements = Array.from(
    normalized.matchAll(/\bcreate\s+table[\s\S]*?;/gi),
  ).map((m) =>
    String(m[0] || "").replace(
      /\bcreate\s+table\s+(?!if\s+not\s+exists\b)/i,
      "create table if not exists ",
    ),
  );

  if (createTableStatements.length === 0) {
    return prelude;
  }

  return `${prelude}\n\n-- phase 1: create tables first\n${createTableStatements.join("\n\n")}`;
}

async function lintAllFiles(files: GeneratedFile[]): Promise<{
  fixedFiles: GeneratedFile[];
  lintReport: { passed: boolean; errors: number; warnings: number };
  lintIssues: LintIssue[];
}> {
  const codeFiles = files.filter(
    (f) =>
      f.path.endsWith(".ts") ||
      f.path.endsWith(".tsx") ||
      f.path.endsWith(".js") ||
      f.path.endsWith(".jsx"),
  );

  const nonCodeFiles = files.filter(
    (f) =>
      !f.path.endsWith(".ts") &&
      !f.path.endsWith(".tsx") &&
      !f.path.endsWith(".js") &&
      !f.path.endsWith(".jsx"),
  );

  let totalErrors = 0;
  let totalWarnings = 0;
  const lintIssues: LintIssue[] = [];

  // Lint files in parallel chunks (5 at a time) for better performance
  const CHUNK_SIZE = 5;
  for (let i = 0; i < codeFiles.length; i += CHUNK_SIZE) {
    const chunk = codeFiles.slice(i, i + CHUNK_SIZE);
    const lintPromises = chunk.map(async (file) => {
      try {
        console.log(`Linting ${file.path}...`);
        const result = await lintCode(file.content, file.path);
        const errors = result.messages.filter((m) => m.severity === "error");
        return {
          file,
          errors: result.errorCount,
          warnings: result.warningCount,
          lintIssues: errors.map((m) => ({
            path: file.path,
            line: m.line,
            column: m.column,
            rule: m.rule,
            message: m.message,
          })),
          success: true,
        };
      } catch (err) {
        console.error(`Failed to lint ${file.path}:`, err);
        return {
          file,
          errors: 1,
          warnings: 0,
          lintIssues: [
            {
              path: file.path,
              line: 1,
              column: 1,
              rule: null,
              message:
                err instanceof Error
                  ? `Lint execution failed: ${err.message}`
                  : "Lint execution failed",
            },
          ],
          success: false,
        };
      }
    });

    const results = await Promise.all(lintPromises);
    results.forEach((result) => {
      totalErrors += result.errors;
      totalWarnings += result.warnings;
      lintIssues.push(...result.lintIssues);
    });
  }

  // Combine results
  const fixedFiles = [...codeFiles, ...nonCodeFiles];

  return {
    fixedFiles,
    lintReport: {
      passed: totalErrors === 0,
      errors: totalErrors,
      warnings: totalWarnings,
    },
    lintIssues,
  };
}

export const generateCodeFunction = inngest.createFunction(
  {
    id: "generate-code",
    name: "Generate Next.js Code",
    retries: 3,
    onFailure: async ({ event, error }) => {
      const projectId = (event.data as Record<string, unknown>)?.event?.data?.projectId as string | undefined;
      if (projectId) {
        await sendFailure(
          projectId,
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  },
  { event: "app/generate.code" },
  async ({ event, step }) => {
    const { prompt, projectId } = event.data;
    // When set, reuse the linked project's Supabase backend instead of allocating a new one.
    const linkedProjectId = (event.data as Record<string, unknown>)?.linkedProjectId as string | undefined;

    // Detect edit requests so repair loops can use a focused system prompt
    // instead of the new-generation design-agency prompt.
    const isEditRequest = (prompt as string)
      .trimStart()
      .startsWith("You are a senior full-stack developer");
    const repairSystemPrompt = isEditRequest ? REPAIR_SYSTEM_PROMPT : SYSTEM_PROMPT;
    const explicitIntegrationRequirements = normalizeIntegrationRequirements(
      (event.data as Record<string, unknown>)?.integrationRequirements,
    );
    const integrationRequirements =
      explicitIntegrationRequirements || detectIntegrationRequirements(prompt);
    const needsManagedAuth = integrationRequirements.requiresAuth;
    let managedAuthConfig: ManagedSupabaseAuthConfig | null = null;
    // Linked-backend flow: borrow credentials from the source project without
    // consuming a pool slot. The source project's binding key remains unchanged.
    if (linkedProjectId) {
      managedAuthConfig = await step.run(
        "resolve-linked-backend",
        async () => {
          const config = await getAuthConfigForBindingKey(linkedProjectId);
          if (!config) {
            throw new Error(
              `Linked project "${linkedProjectId}" does not have a managed backend. Make sure the source project was generated with backend enabled.`,
            );
          }
          return config;
        },
      );
    } else if (needsManagedAuth) {
      managedAuthConfig = await step.run(
        "allocate-managed-supabase",
        async () => {
          return await acquireAuthConfigForBindingKey(projectId);
        },
      );
    }

    // Check if cancelled before starting
    if (await checkIfCancelled(projectId)) {
      console.log(`[Inngest] Generation cancelled before start: ${projectId}`);
      throw new Error("Generation cancelled by user");
    }

    // Step 1: Detect project type + build user prompt
    await sendProgress(projectId, "[1/8] Understanding your request...");

    // Detect project type in a dedicated step so edit requests skip it cheaply.
    const detectedProjectType = await step.run(
      "detect-project-type",
      async (): Promise<ProjectType> => {
        const isEdit = (prompt as string)
          .trimStart()
          .startsWith("You are a senior full-stack developer");
        if (isEdit) return "website"; // edits preserve the existing type
        return await extractProjectType(prompt);
      },
    );

    const userPrompt = await step.run("build-prompt", async () => {
      // Edit requests already contain their own full context and instructions.
      // Wrapping them with generation-specific language causes conflicting instructions
      // and prevents the AI from making targeted changes.
      const isEditRequest = prompt.trimStart().startsWith("You are a senior full-stack developer");
      if (isEditRequest) {
        return prompt;
      }

      // Fetch the linked project's existing schema SQL so the AI can extend
      // (rather than recreate) the backend tables.
      let linkedSchemaContext = "";
      if (linkedProjectId) {
        const linkedProject = await prisma.project.findFirst({
          where: { id: linkedProjectId },
          select: { files: true, prompt: true },
        });
        if (linkedProject) {
          const files = linkedProject.files as Array<{ path: string; content: string }>;
          const schemaFile = files.find(
            (f) => f.path.replace(/\\/g, "/").toLowerCase() === "supabase/schema.sql",
          );
          if (schemaFile) {
            linkedSchemaContext = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHARED BACKEND — EXISTING DATABASE SCHEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This project SHARES the Supabase backend of an existing project. The database already has these tables and policies — do NOT recreate or drop them:

${schemaFile.content}

CRITICAL RULES FOR SHARED BACKENDS:
- Your supabase/schema.sql MUST use CREATE TABLE IF NOT EXISTS for all tables.
- You MAY add new tables for features specific to this project, but include them alongside the existing schema.
- Do NOT remove or modify existing table columns or RLS policies.
- All .from("<table>") calls in your code must reference tables that exist in the schema above or that you explicitly CREATE.
- The frontend should read/write the same Supabase project — env vars NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are already configured.`;
          }
        }
      }

      // ── Dashboard / App prompt ────────────────────────────────────────────
      if (detectedProjectType === "dashboard") {
        return `Build a professional, production-ready Next.js dashboard app for this request:
${prompt}

DASHBOARD MANDATE:
1. Identify the domain and the primary data entities (e.g., orders, users, tasks, revenue, devices).
2. Design an appropriate sidebar with 4-7 navigation sections relevant to the domain.
3. For each sidebar section, generate a real app/{route}/page.tsx with domain-appropriate content.
4. The home/overview page (app/page.tsx) MUST include: stat cards (KPIs), at least one chart, and a summary table.
5. Every data table must have 6-10 rows of realistic, domain-specific mock data (typed TypeScript).
6. Include at least 2 charts using recharts (add "recharts": "^2.12.7" to dependencies). Charts must be "use client" components.
7. Status badges, action buttons, and hover states on all interactive elements.
8. Sidebar with logo, nav links (Lucide icons), and user section at the bottom.
9. Mobile: collapsible sidebar with overlay on small screens.
10. Do NOT generate hero sections, marketing copy, testimonials, or pricing tables.

CORE IMPLEMENTATION RULES:
- Use Next.js App Router + TypeScript + Tailwind utility classes.
- Required files: app/layout.tsx, app/page.tsx, app/loading.tsx, app/globals.css, components/sidebar.tsx (or inline sidebar in layout).
- DO NOT generate app/not-found.tsx.
- Every sidebar nav link MUST have a real corresponding page file. No dead links.
- Charts live in "use client" components — never import recharts in a server component.
- Do not use @apply in CSS.
- All files must parse without TS/JS syntax errors.
- Do not output lockfiles.

AUTHENTICATION & BACKEND RULES:
  * NEVER generate auth CTAs UNLESS explicitly requested
  * When auth IS requested, generate: app/sign-in/page.tsx, middleware.ts, Supabase SSR auth
  * Use env vars: process.env.NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
  * DATABASE CONTRACT: include supabase/schema.sql with CREATE TABLE IF NOT EXISTS + RLS for every .from() table${linkedSchemaContext}`;
      }

      // ── Website / Marketing prompt ────────────────────────────────────────
      return `Design and build a stunning, agency-quality Next.js website for this request:
${prompt}

DESIGN MANDATE — THE WEBSITE MUST LOOK PREMIUM:
1. Study the user's request carefully. Identify the business domain, target audience, and brand personality.
2. Choose a cohesive color palette that fits the domain (e.g., warm earth tones for a bakery, bold blues for fintech, muted greens for wellness).
3. Select complementary Google Fonts via next/font/google — one for headings (display weight), one for body text.
4. Build a clear HOME page structure: Hero → Social Proof/Stats → Features/Services → Testimonials → CTA → Footer.
5. MULTI-PAGE: Generate a separate page file (app/{route}/page.tsx) for EVERY navigation link in the navbar/header/footer. If the nav has "About", "Services", "Pricing", "Blog", "Contact" — create app/about/page.tsx, app/services/page.tsx, app/pricing/page.tsx, app/blog/page.tsx, app/contact/page.tsx. Each sub-page must have real, meaningful content (hero + 1-2 content sections minimum), not just a placeholder. No dead links.
6. Every section must have visual interest: alternating backgrounds, icon accents, card grids with hover effects, or image/text split layouts.
6. Use generous whitespace (py-20 to py-32), large readable headings (text-4xl to text-6xl), and comfortable line heights.
7. Add micro-interactions: hover:scale-105 on cards, transition-all duration-300, hover color shifts on buttons and links.
8. Use Lucide React icons (from "lucide-react") for features, benefits, and UI elements.
9. Write realistic, compelling copy that matches the business — no lorem ipsum or generic placeholder text.

CORE IMPLEMENTATION RULES:
- Use Next.js App Router + TypeScript + Tailwind utility classes.
- Return a complete runnable project with app/layout.tsx, app/page.tsx, app/loading.tsx, app/globals.css, AND a separate app/{route}/page.tsx for every navigation link.
- DO NOT generate app/not-found.tsx — it is automatically injected by the platform.
- EVERY internal link in the navbar/header/footer (e.g., "About", "Services", "Pricing", "Contact", "Blog") MUST have a real corresponding page file. No dead links.
- Each sub-page must contain real, domain-relevant content — at minimum a hero/header + 1-2 meaningful content sections. Not just an empty placeholder.
- If app/globals.css contains @layer base/components/utilities, include matching @tailwind directives.
- Do not use @apply in generated CSS; use explicit utility classes in JSX.
- If a provider guard is required, wrap {children} correctly in app/layout.tsx.
- Preserve semantic HTML, accessibility, and responsive behavior.
- Do not output lockfiles or unsafe file paths.
- All returned files must parse without TS/JS syntax errors.

AUTHENTICATION & BACKEND RULES:
  * NEVER generate auth CTAs UNLESS the user explicitly requests authentication
  * NEVER add shopping cart, wishlist, user profile avatars, or backend-dependent UI UNLESS explicitly requested
  * If the user does NOT mention authentication, create a fully functional public website WITHOUT any auth-related UI
  * When auth IS requested, generate the COMPLETE auth system yourself:
    - Sign-in and sign-up pages (e.g. app/sign-in/page.tsx, app/signup/page.tsx) with professional, brand-aligned design
    - API routes for auth operations (signin, signup, signout, session check) using @supabase/ssr createServerClient
    - middleware.ts for session handling and protected route redirects
    - Use env vars: process.env.NEXT_PUBLIC_SUPABASE_URL and process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as fallback)
    - Use supabase.auth.signInWithPassword(), supabase.auth.signUp(), supabase.auth.signOut(), supabase.auth.getUser()
    - Include: password visibility toggle, password confirmation on signup, inline validation, loading states, error messages
    - Auth CTAs must be session-aware (signed-out vs signed-in). Show user identity + logout when signed in.
    - Do NOT hardcode secrets or service-role keys
    - The platform provides lib/supabase/client.ts and lib/supabase/server.ts — you can import from those or create your own client using @supabase/ssr

IMAGE REQUIREMENTS — THIS DETERMINES IMAGE QUALITY:
- Use REPLICATE_IMG_N placeholders only (no Unsplash, Picsum, or stock-image URLs).
- Alt text IS the image generation prompt. Write each alt text as a detailed photographer's brief (20-40 words).
- Structure: [Specific Subject] + [Scene/Setting] + [Photography Style] + [Lighting] + [Key Visual Details]
- GOOD: "Fresh strawberry cheesecake with glossy red glaze and mint garnish on a white marble countertop, soft natural window light, overhead flat-lay composition, bakery kitchen blurred in background"
- BAD: "dessert image" or "product photo" or "food"
- Each image MUST have unique visual intent — no two images should describe the same thing.
- For card grids: each card's image must describe that specific item, not the category (e.g., for a menu card showing "Margherita Pizza", describe the actual pizza with toppings, not just "pizza photo").
- Match the business domain precisely in every image description.
- CRITICAL FOR TECH/BLOCKCHAIN/SAAS/AI SITES: Do NOT use photographs of people to illustrate abstract features. Instead use abstract conceptual visuals:
  * "Security" → abstract glowing digital shield, encrypted vault, holographic lock — NOT a security guard
  * "Performance" → abstract energy streams, lightning convergence, speed trails — NOT a person running
  * "Scalability" → expanding geometric network, growing crystal structure — NOT people in a meeting
  * "Analytics" → holographic floating charts, glowing data streams — NOT someone looking at a screen
  * Always use dark backgrounds with neon accents (blue, purple, cyan) for blockchain/crypto sites
  * Always use clean minimal backgrounds with soft gradients for SaaS sites

NAV + MOBILE RULES:
- Navbar must be fully functional with mobile menu toggle and accessibility attributes.
- Prevent horizontal scrolling.
- Keep header/navbar pinned at top with proper z-index.
- Mobile menu must render above content with clear background contrast and full viewport height.
- Avoid creating extra independent scrollbars inside nav/menu wrappers.
- CRITICAL: Every nav link must use Next.js Link component with href pointing to a real route (e.g., href="/about"). Generate a matching app/{route}/page.tsx for each. No "#" or empty href values for primary navigation items.${linkedSchemaContext}`;
    });

    // Step 1.5: Extract theme from prompt
    const detectedTheme = await step.run(
      "extract-theme-from-prompt",
      async () => {
        return await extractThemeFromPrompt(prompt);
      },
    );

    // Check if cancelled after building prompt
    if (await checkIfCancelled(projectId)) {
      console.log(
        `[Inngest] Generation cancelled after building prompt: ${projectId}`,
      );
      throw new Error("Generation cancelled by user");
    }

    // Step 2: Generate with Gemini
    await sendProgress(projectId, "[2/8] Creating your website...");
    const generatedText = await step.run("generate-with-gemini", async () => {
      console.log("Using Gemini 3 Flash Preview...");

      try {
        // Pick system prompt based on request type and detected project type:
        // - Edits: REPAIR_SYSTEM_PROMPT (minimal, targeted changes)
        // - Dashboard/app: DASHBOARD_SYSTEM_PROMPT
        // - Website: SYSTEM_PROMPT (design-agency)
        const generationSystemPrompt = isEditRequest
          ? REPAIR_SYSTEM_PROMPT
          : detectedProjectType === "dashboard"
            ? DASHBOARD_SYSTEM_PROMPT
            : SYSTEM_PROMPT;
        const text = await generateWithGemini(generationSystemPrompt, userPrompt);
        console.log("Gemini response length:", text.length, "chars");
        console.log("Response preview:", text.substring(0, 200) + "...");

        return text;
      } catch (error) {
        console.error("Gemini API error:", error);
        throw new Error(
          `Gemini API failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    // Check if cancelled after generation
    if (await checkIfCancelled(projectId)) {
      console.log(
        `[Inngest] Generation cancelled after AI generation: ${projectId}`,
      );
      throw new Error("Generation cancelled by user");
    }

    // Step 3: Parse and prepare files
    await sendProgress(projectId, "[3/8] Preparing project files...");
    const parsedProject = await step.run("parse-generated-code", async () => {
      console.log("Parsing AI response, length:", generatedText.length);

      let normalizedProject: {
        files: GeneratedFile[];
        dependencies: Record<string, string>;
      } | null = null;
      let workingText = generatedText;
      let lastParseError: unknown;

      for (
        let attempt = 1;
        attempt <= MAX_JSON_REPAIR_ATTEMPTS + 1;
        attempt++
      ) {
        try {
          normalizedProject =
            parseAndNormalizeProjectFromTextOrThrow(workingText);
          break;
        } catch (parseError) {
          lastParseError = parseError;
          console.error(
            `[Parse] Attempt ${attempt} failed:`,
            parseError instanceof Error ? parseError.message : parseError,
          );

          if (attempt > MAX_JSON_REPAIR_ATTEMPTS) {
            break;
          }

          console.warn(`[Parse] Attempting AI JSON repair pass ${attempt}...`);
          workingText = await repairMalformedJSONWithGemini(workingText);
        }
      }

      if (!normalizedProject) {
        console.log(
          "Raw response first 1000 chars:",
          generatedText.substring(0, 1000),
        );
        console.log(
          "Raw response last 500 chars:",
          generatedText.substring(Math.max(0, generatedText.length - 500)),
        );
        const reason =
          lastParseError instanceof Error
            ? lastParseError.message
            : String(lastParseError ?? "unknown parse error");
        throw new Error(`Unable to parse and normalize AI response: ${reason}`);
      }

      let files = ensureRequiredFiles(
        normalizedProject.files,
        normalizedProject.dependencies,
        integrationRequirements,
        managedAuthConfig,
      );
      files = applyKnownImportSpecifierFixups(files);
      let dependencies = normalizedProject.dependencies;

      for (
        let attempt = 1;
        attempt <= MAX_STRUCTURE_REPAIR_ATTEMPTS + 1;
        attempt++
      ) {
        try {
          validateProjectStructureOrThrow(files);
          break;
        } catch (shapeError) {
          if (attempt > MAX_STRUCTURE_REPAIR_ATTEMPTS) {
            throw shapeError;
          }

          console.warn(
            `[ShapeRepair] Attempt ${attempt} failed: ${
              shapeError instanceof Error
                ? shapeError.message
                : String(shapeError)
            }`,
          );
          const repairedShapeText = await repairProjectShapeWithGemini({
            originalPrompt: prompt,
            parseError:
              shapeError instanceof Error
                ? shapeError.message
                : String(shapeError),
            parsedResponse: {
              files,
              dependencies,
              _checks: { shape_repair: true, attempt },
            },
          });

          const repairedProject =
            parseAndNormalizeProjectFromTextOrThrow(repairedShapeText);
          files = ensureRequiredFiles(
            repairedProject.files,
            repairedProject.dependencies,
            integrationRequirements,
            managedAuthConfig,
          );
          files = applyKnownImportSpecifierFixups(files);
          dependencies = repairedProject.dependencies;
        }
      }

      for (
        let attempt = 1;
        attempt <= MAX_SYNTAX_REPAIR_ATTEMPTS + 1;
        attempt++
      ) {
        const syntaxIssues = collectSyntaxIssues(files);
        if (syntaxIssues.length === 0) {
          break;
        }

        if (attempt > MAX_SYNTAX_REPAIR_ATTEMPTS) {
          const first = syntaxIssues[0];
          throw new Error(
            `Syntax repair failed. First issue: ${first.path}:${first.line}:${first.column} ${first.message}`,
          );
        }

        console.warn(
          `[SyntaxRepair] Attempt ${attempt} - ${syntaxIssues.length} syntax issue(s).`,
        );
        await sendProgress(projectId, "[4/8] Improving code reliability...");

        const repaired = await repairProjectFromLintFeedback({
          originalPrompt: prompt,
          files,
          dependencies,
          lintIssues: syntaxIssues,
          requirements: integrationRequirements,
          managedAuthConfig,
          systemPrompt: repairSystemPrompt,
        });
        files = applyKnownImportSpecifierFixups(repaired.files);
        dependencies = repaired.dependencies;
      }

      for (let attempt = 1; attempt <= MAX_UX_REPAIR_ATTEMPTS + 1; attempt++) {
        const uxIssues = collectResponsiveAndNavIssues(files);
        if (uxIssues.length === 0) {
          break;
        }

        if (attempt > MAX_UX_REPAIR_ATTEMPTS) {
          const first = uxIssues[0];
          console.warn(
            `[UXRepair] Max attempts reached. Continuing with unresolved UX issues: ${first.path}:${first.line}:${first.column} ${first.message}`,
          );
          await sendProgress(
            projectId,
            "[4/8] Note: some layout issues could not be auto-fixed. Your site may need minor responsive adjustments.",
          );
          break;
        }

        console.warn(
          `[UXRepair] Attempt ${attempt} - ${uxIssues.length} responsive/navigation issue(s).`,
        );
        await sendProgress(
          projectId,
          "[4/8] Refining layout and responsiveness...",
        );

        const repaired = await repairProjectFromLintFeedback({
          originalPrompt: prompt,
          files,
          dependencies,
          lintIssues: uxIssues,
          requirements: integrationRequirements,
          managedAuthConfig,
          systemPrompt: repairSystemPrompt,
        });
        files = applyKnownImportSpecifierFixups(repaired.files);
        dependencies = repaired.dependencies;
      }

      for (
        let attempt = 1;
        attempt <= MAX_SCHEMA_REPAIR_ATTEMPTS + 1;
        attempt++
      ) {
        const schemaIssues = collectSupabaseSchemaIssues(
          files,
          integrationRequirements,
        );
        if (schemaIssues.length === 0) {
          break;
        }

        if (attempt > MAX_SCHEMA_REPAIR_ATTEMPTS) {
          const first = schemaIssues[0];
          throw new Error(
            `Schema repair failed. First issue: ${first.path}:${first.line}:${first.column} ${first.message}`,
          );
        }

        console.warn(
          `[SchemaRepair] Attempt ${attempt} - ${schemaIssues.length} schema issue(s).`,
        );
        await sendProgress(projectId, "[4/8] Strengthening backend setup...");

        const repaired = await repairProjectFromLintFeedback({
          originalPrompt: prompt,
          files,
          dependencies,
          lintIssues: schemaIssues,
          requirements: integrationRequirements,
          managedAuthConfig,
          systemPrompt: repairSystemPrompt,
        });
        files = applyKnownImportSpecifierFixups(repaired.files);
        dependencies = repaired.dependencies;
      }

      validateSyntaxOrThrow(files);
      console.log(`Parsed ${files.length} files successfully`);
      return { files, dependencies };
    });
    let files = parsedProject.files;
    let dependencies = parsedProject.dependencies;

    if (
      !managedAuthConfig &&
      projectNeedsManagedSupabase(files, dependencies, integrationRequirements)
    ) {
      managedAuthConfig = await step.run(
        "allocate-managed-supabase-from-project-output",
        async () => {
          return await acquireAuthConfigForBindingKey(projectId);
        },
      );

      files = ensureRequiredFiles(
        files,
        dependencies,
        integrationRequirements,
        managedAuthConfig,
      );
    }

    // Step 4: Lint and fix code (parallel linting for all files)
    await sendProgress(projectId, "[5/8] Running code quality checks...");
    const { fixedFiles } = await step.run("lint-and-repair", async () => {
      console.log(`Starting linting for ${files.length} files...`);
      let workingFiles = files;
      let workingDependencies = dependencies;
      let lintResult = await lintAllFiles(workingFiles);
      let schemaIssues = collectSupabaseSchemaIssues(
        workingFiles,
        integrationRequirements,
      );

      for (
        let attempt = 1;
        (lintResult.lintReport.errors > 0 || schemaIssues.length > 0) &&
        attempt <= MAX_LINT_REPAIR_ATTEMPTS;
        attempt++
      ) {
        if (await checkIfCancelled(projectId)) {
          throw new Error("Generation cancelled by user");
        }

        const issuesToFix =
          lintResult.lintIssues.length > 0
            ? [...lintResult.lintIssues, ...schemaIssues]
            : [...schemaIssues];
        const firstIssue = issuesToFix[0];
        console.warn(
          `[LintRepair] Attempt ${attempt} - ${lintResult.lintReport.errors} lint errors, ${schemaIssues.length} schema issue(s). First issue: ${firstIssue?.path}:${firstIssue?.line}:${firstIssue?.column} ${firstIssue?.message}`,
        );
        await sendProgress(projectId, "[5/8] Fixing code quality...");

        const repaired = await repairProjectFromLintFeedback({
          originalPrompt: prompt,
          files: workingFiles,
          dependencies: workingDependencies,
          lintIssues: issuesToFix,
          requirements: integrationRequirements,
          managedAuthConfig,
          systemPrompt: repairSystemPrompt,
        });

        workingFiles = applyKnownImportSpecifierFixups(repaired.files);
        workingDependencies = repaired.dependencies;
        lintResult = await lintAllFiles(workingFiles);
        schemaIssues = collectSupabaseSchemaIssues(
          workingFiles,
          integrationRequirements,
        );
      }

      if (lintResult.lintReport.errors > 0 || schemaIssues.length > 0) {
        const firstIssue = [
          ...(lintResult.lintIssues || []),
          ...schemaIssues,
        ][0];
        throw new Error(
          `Lint failed after repair attempts. First issue: ${firstIssue?.path}:${firstIssue?.line}:${firstIssue?.column} ${firstIssue?.message}`,
        );
      }

      dependencies = workingDependencies;
      return {
        fixedFiles: workingFiles,
        lintReport: lintResult.lintReport,
      };
    });

    await sendProgress(
      projectId,
      "[6/8] Validating Next.js runtime constraints...",
    );
    const { validatedFiles } = await step.run(
      "nextjs-validate-and-repair",
      async () => {
        let workingFiles = fixedFiles;
        let workingDependencies = dependencies;
        let issues = collectNextJsValidationIssues(
          workingFiles,
          workingDependencies,
        );

        for (
          let attempt = 1;
          issues.length > 0 && attempt <= MAX_NEXTJS_REPAIR_ATTEMPTS;
          attempt++
        ) {
          const firstIssue = issues[0];
          console.warn(
            `[NextValidation] Attempt ${attempt} - ${issues.length} issue(s). First issue: ${firstIssue?.path}:${firstIssue?.line}:${firstIssue?.column} ${firstIssue?.message}`,
          );
          await sendProgress(
            projectId,
            "[6/8] Fixing Next.js compatibility...",
          );

          const repaired = await repairProjectFromLintFeedback({
            originalPrompt: prompt,
            files: workingFiles,
            dependencies: workingDependencies,
            lintIssues: issues,
            requirements: integrationRequirements,
            managedAuthConfig,
            systemPrompt: repairSystemPrompt,
          });

          workingFiles = applyKnownImportSpecifierFixups(repaired.files);
          workingDependencies = repaired.dependencies;
          issues = collectNextJsValidationIssues(
            workingFiles,
            workingDependencies,
          );
        }

        if (issues.length > 0) {
          const firstIssue = issues[0];
          throw new Error(
            `Next.js validation failed after repair attempts. First issue: ${firstIssue.path}:${firstIssue.line}:${firstIssue.column} ${firstIssue.message}`,
          );
        }

        dependencies = workingDependencies;
        return { validatedFiles: workingFiles };
      },
    );

    const finalFiles = ensureRequiredFiles(
      validatedFiles,
      dependencies,
      integrationRequirements,
      managedAuthConfig,
    );
    validateSyntaxOrThrow(finalFiles);

    const finalLint = await lintAllFiles(finalFiles);
    if (finalLint.lintReport.errors > 0) {
      const firstIssue = finalLint.lintIssues[0];
      throw new Error(
        `Post-scaffold lint failed. First issue: ${firstIssue?.path}:${firstIssue?.line}:${firstIssue?.column} ${firstIssue?.message}`,
      );
    }

    const finalSchemaIssues = collectSupabaseSchemaIssues(
      finalFiles,
      integrationRequirements,
    );
    if (finalSchemaIssues.length > 0) {
      const firstIssue = finalSchemaIssues[0];
      throw new Error(
        `Schema validation failed. First issue: ${firstIssue.path}:${firstIssue.line}:${firstIssue.column} ${firstIssue.message}`,
      );
    }

    if (integrationRequirements.requiresDatabase) {
      if (!managedAuthConfig?.projectRef) {
        throw new Error(
          "Database integration requires a managed Supabase project, but no managed project was allocated.",
        );
      }

      const schemaFile = finalFiles.find(
        (f) =>
          f.path.replace(/\\/g, "/").toLowerCase() === "supabase/schema.sql",
      );
      if (!schemaFile || !schemaFile.content.trim()) {
        throw new Error(
          "Database integration requires a non-empty supabase/schema.sql file.",
        );
      }

      await sendProgress(projectId, "[7/8] Setting up backend data...");

      // For linked (shared) backends the source project already bootstrapped
      // the base schema. We only apply the new/extended SQL so we don't
      // overwrite existing data or policies.
      await step.run("bootstrap-managed-supabase-schema", async () => {
        if (linkedProjectId) {
          // Apply only the incremental schema — use the same idempotent helpers.
          const sql = buildSchemaBootstrapSql(schemaFile.content);
          await applySqlToManagedProject(managedAuthConfig.projectRef, sql);
          return { projectRef: managedAuthConfig.projectRef, applied: true, mode: "incremental" };
        }

        const tablePhaseSql = buildTableCreationPhaseSql(schemaFile.content);
        await applySqlToManagedProject(
          managedAuthConfig.projectRef,
          tablePhaseSql,
        );
        const sql = buildSchemaBootstrapSql(schemaFile.content);
        await applySqlToManagedProject(managedAuthConfig.projectRef, sql);
        return { projectRef: managedAuthConfig.projectRef, applied: true, mode: "full" };
      });
    }

    // Step 6: Notify completion via API
    await sendProgress(projectId, "[7/8] Finalizing and saving your app...");
    await step.run("notify-completion", async () => {
      const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/inngest/status`;
      console.log("[Inngest] Notifying completion:", {
        url,
        projectId,
        event: "generate.completed",
      });

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          event: "generate.completed",
          data: {
            files: finalFiles,
            dependencies,
            lintReport: finalLint.lintReport,
            model: "gemini",
            originalPrompt: prompt,
            detectedTheme: detectedTheme,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Inngest] Failed to notify completion:", errorText);
        throw new Error(
          `Failed to notify completion: ${response.status} ${errorText}`,
        );
      }

      const result = await response.json();
      console.log("[Inngest] Notification successful:", result);
      return result;
    });

    await sendProgress(projectId, "[8/8] Ready to preview.");

    return {
      files: finalFiles,
      dependencies,
      lintReport: finalLint.lintReport,
      model: "gemini",
      originalPrompt: prompt,
      detectedTheme: detectedTheme,
      projectType: detectedProjectType,
    };
  },
);
