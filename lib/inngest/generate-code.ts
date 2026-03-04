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
import { generateImagesFunction } from "@/lib/inngest/generate-images";
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
  buildSchemaBootstrapRepairPrompt,
  SUPABASE_API_REFERENCE,
} from "@/lib/prompts";

const MODEL = "gemini-3-flash-preview";
const MAX_TOKENS = 65536;
const GENERATED_NEXT_VERSION = "^16.1.6";
const GENERATED_REACT_VERSION = "^19.2.3";
const GENERATED_LUCIDE_VERSION = "^0.468.0";
const MAX_LINT_REPAIR_ATTEMPTS = 4;
const MAX_SYNTAX_REPAIR_ATTEMPTS = 3;
const MAX_JSON_REPAIR_ATTEMPTS = 3;
const MAX_STRUCTURE_REPAIR_ATTEMPTS = 3;
const MAX_UX_REPAIR_ATTEMPTS = 3;
const MAX_SCHEMA_REPAIR_ATTEMPTS = 3;
const MAX_NEXTJS_REPAIR_ATTEMPTS = 4;
const MAX_TYPECHECK_REPAIR_ATTEMPTS = 3;
const MAX_SCHEMA_BOOTSTRAP_REPAIR_ATTEMPTS = 2;
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
  requiresPayments: boolean;
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
    requiresPayments:
      /\b💳 payment requirement\b|\bstripe checkout\b|\bpayment integration\b|\bpayment requirement \(proxy pattern\)\b/.test(
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
    requiresPayments: raw.requiresPayments === true,
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
    next: GENERATED_NEXT_VERSION,
    react: GENERATED_REACT_VERSION,
    "react-dom": GENERATED_REACT_VERSION,
    "lucide-react": GENERATED_LUCIDE_VERSION,
    sonner: "^1.7.0",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-accordion": "^1.2.2",
    "@radix-ui/react-dialog": "^1.1.4",
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
    "app/not-found.tsx",
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

  // Merge: Gemini now returns only changed files. Overlay them on top of the
  // original file set so unchanged files (layout, page, globals, etc.) are
  // never lost — even when the model's output is truncated.
  const repairedPathSet = new Set(parsedFiles.map((f) => f.path));
  const mergedFiles = [
    ...files.filter((f) => !repairedPathSet.has(f.path)),
    ...parsedFiles,
  ];

  let repairedFiles = mergedFiles;
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

async function repairSchemaFromBootstrapError(args: {
  schemaSql: string;
  sqlError: string;
}): Promise<string> {
  const repairPrompt = buildSchemaBootstrapRepairPrompt({
    schemaSql: args.schemaSql,
    sqlError: args.sqlError,
  });

  const text = await generateWithGemini(REPAIR_SYSTEM_PROMPT, repairPrompt);
  let parsed: { schema?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `Schema bootstrap repair returned invalid JSON: ${text.slice(0, 500)}`,
    );
  }

  if (!parsed.schema || typeof parsed.schema !== "string") {
    throw new Error(
      "Schema bootstrap repair response missing 'schema' field.",
    );
  }

  return parsed.schema;
}

function ensureRequiredFiles(
  files: GeneratedFile[],
  dependencies: Record<string, string>,
  requirements?: IntegrationRequirements,
  managedAuthConfig?: ManagedSupabaseAuthConfig | null,
  projectId?: string,
): GeneratedFile[] {
  const requested: IntegrationRequirements = requirements || {
    requiresAuth: false,
    requiresDatabase: false,
    requiresGoogleOAuth: false,
    requiresPasswordAuth: false,
    requiresPayments: false,
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
      /^app\/auth\/verify\/page\.(tsx|ts|jsx|js)$/i,
      /^app\/api\/auth\/.+/i,
      /^app\/sign-in\/page\.(tsx|ts|jsx|js)$/i,
      /^app\/sign-up\/page\.(tsx|ts|jsx|js)$/i,
      /^app\/signin\/page\.(tsx|ts|jsx|js)$/i,
      /^app\/signup\/page\.(tsx|ts|jsx|js)$/i,
      /^app\/login\/page\.(tsx|ts|jsx|js)$/i,
      /^app\/register\/page\.(tsx|ts|jsx|js)$/i,
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

      // Remove any file that imports from stripped Supabase modules.
      if (
        /@\/lib\/supabase\/|@supabase\/ssr|@supabase\/supabase-js/i.test(
          file.content,
        )
      ) {
        return false;
      }

      return true;
    });
  }

  function findRoutePageIndex(routePath: string): number {
    const normalizedRoute = routePath.replace(/\\/g, "/").toLowerCase();
    return files.findIndex((file) => {
      const normalized = file.path.replace(/\\/g, "/").toLowerCase();
      return normalized === `${normalizedRoute}/page.tsx` ||
        normalized === `${normalizedRoute}/page.ts` ||
        normalized === `${normalizedRoute}/page.jsx` ||
        normalized === `${normalizedRoute}/page.js`;
    });
  }

  function buildCheckoutPageContent(includeAuthEmail: boolean): string {
    const hooksImport = includeAuthEmail
      ? "{ useEffect, useMemo, useState }"
      : "{ useMemo, useState }";
    const authImport = includeAuthEmail
      ? '\nimport { createClient } from "@/lib/supabase/client";'
      : "";
    const authEmailEffect = includeAuthEmail
      ? `
  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) {
          setCustomerEmail(data.user?.email ?? undefined);
        }
      })
      .catch(() => {
        if (active) {
          setCustomerEmail(undefined);
        }
      });

    return () => {
      active = false;
    };
  }, []);
`
      : "";

    return `"use client";

import Link from "next/link";
import { ${hooksImport} } from "react";${authImport}

type CheckoutLineItem = {
  name: string;
  description?: string;
  amount: number;
  currency?: string;
  quantity?: number;
};

export default function CheckoutPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string | undefined>(
    undefined,
  );
${authEmailEffect}
  const lineItems = useMemo<CheckoutLineItem[]>(
    () => [
      {
        name: "Starter Plan",
        description: "One-time purchase",
        amount: 2900,
        currency: "usd",
        quantity: 1,
      },
    ],
    [],
  );

  const subtotal = useMemo(
    () =>
      lineItems.reduce(
        (sum, item) => sum + item.amount * (item.quantity ?? 1),
        0,
      ),
    [lineItems],
  );

  const handleCheckout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const pocketDevUrl = process.env.NEXT_PUBLIC_POCKET_DEV_URL;
      const pocketProjectId = process.env.NEXT_PUBLIC_POCKET_PROJECT_ID;

      if (!pocketDevUrl || !pocketProjectId) {
        throw new Error(
          "Missing NEXT_PUBLIC_POCKET_DEV_URL or NEXT_PUBLIC_POCKET_PROJECT_ID",
        );
      }

      const response = await fetch(
        \`\${process.env.NEXT_PUBLIC_POCKET_DEV_URL}/api/stripe/connect/create-checkout\`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: process.env.NEXT_PUBLIC_POCKET_PROJECT_ID,
            lineItems,
            successUrl: window.location.origin + "/payment/success",
            cancelUrl: window.location.origin + "/payment/cancel",
            ...(customerEmail ? { customerEmail } : {}),
          }),
        },
      );

      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Checkout</h1>
        <p className="text-slate-600 mb-8">
          Review your order and continue to secure payment.
        </p>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="space-y-4">
            {lineItems.map((item) => {
              const qty = item.quantity ?? 1;
              const amount = (item.amount * qty) / 100;
              return (
                <div
                  key={item.name}
                  className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    {item.description ? (
                      <p className="text-sm text-slate-500 mt-1">
                        {item.description}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-400 mt-1">Qty: {qty}</p>
                  </div>
                  <p className="font-semibold text-slate-900">
                    {"$"}{amount.toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-slate-600">Total</p>
            <p className="text-2xl font-bold text-slate-900">
              {"$"}{(subtotal / 100).toFixed(2)}
            </p>
          </div>

          {error ? (
            <p className="mt-4 text-sm text-red-600">{error}</p>
          ) : null}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={isLoading}
            className="mt-6 w-full rounded-xl bg-slate-900 text-white py-3 font-semibold hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Processing..." : "Pay Now"}
          </button>

          <Link
            href="/"
            className="mt-4 inline-flex text-sm text-slate-600 hover:text-slate-900"
          >
            Continue browsing
          </Link>
        </div>
      </div>
    </main>
  );
}
`;
  }

  function buildPaymentSuccessPageContent(): string {
    return `import Link from "next/link";

export default function PaymentSuccessPage() {
  return (
    <main className="min-h-screen bg-emerald-50 flex items-center justify-center px-6">
      <section className="max-w-xl w-full bg-white border border-emerald-100 rounded-2xl p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl">
          ✓
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Payment successful</h1>
        <p className="mt-3 text-slate-600">
          Thanks for your purchase. Your order has been confirmed.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg bg-slate-900 text-white px-5 py-2.5 font-medium hover:bg-slate-800 transition"
        >
          Back to home
        </Link>
      </section>
    </main>
  );
}
`;
  }

  function buildPaymentCancelPageContent(): string {
    return `import Link from "next/link";

export default function PaymentCancelPage() {
  return (
    <main className="min-h-screen bg-amber-50 flex items-center justify-center px-6">
      <section className="max-w-xl w-full bg-white border border-amber-100 rounded-2xl p-8 text-center shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Payment cancelled</h1>
        <p className="mt-3 text-slate-600">
          Your checkout was cancelled. You can try again whenever you're ready.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/checkout"
            className="inline-flex rounded-lg bg-slate-900 text-white px-5 py-2.5 font-medium hover:bg-slate-800 transition"
          >
            Try again
          </Link>
          <Link
            href="/"
            className="inline-flex rounded-lg border border-slate-300 text-slate-700 px-5 py-2.5 font-medium hover:bg-slate-100 transition"
          >
            Continue browsing
          </Link>
        </div>
      </section>
    </main>
  );
}
`;
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

  return createBrowserClient(supabaseUrl, supabasePublishableKey, {
    cookieOptions: {
      sameSite: "none" as const,
      secure: true,
    },
  });
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
            cookieStore.set(name, value, { ...options, sameSite: "none" as const, secure: true });
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

    // Ensure middleware cookies use SameSite=None for iframe compatibility.
    // Matches patterns like: response.cookies.set(name, value, options)
    // and replaces with: response.cookies.set(name, value, { ...options, sameSite: "none" as const, secure: true })
    if (!/sameSite.*none/.test(patched)) {
      patched = patched.replace(
        /response\.cookies\.set\(\s*name\s*,\s*value\s*,\s*options\s*\)/g,
        'response.cookies.set(name, value, { ...options, sameSite: "none" as const, secure: true })',
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

  const CART_CONFLICT_MARKER =
    "-- pocket-dev: enforce cart_items upsert conflict target";
  const CART_CONFLICT_TARGET = "user_id,product_id";

  function hasCartTable(schemaSql: string): boolean {
    return /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:public|auth)\.)?"?cart_items"?\b/i.test(
      schemaSql || "",
    );
  }

  function ensureCartConflictConstraintInSchema(schemaSql: string): string {
    const current = schemaSql || "";
    if (!hasCartTable(current)) return current;
    if (schemaHasCartConflictUniqueConstraint(current)) return current;
    if (current.includes(CART_CONFLICT_MARKER)) return current;

    const block = `${CART_CONFLICT_MARKER}
do $$ begin
  if to_regclass('public.cart_items') is not null then
    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where c.contype = 'u'
        and n.nspname = 'public'
        and t.relname = 'cart_items'
        and (
          pg_get_constraintdef(c.oid) ilike '%(user_id, product_id)%'
          or pg_get_constraintdef(c.oid) ilike '%(product_id, user_id)%'
        )
    )
    and not exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'cart_items'
        and (
          indexdef ilike 'create unique index%(%user_id%,%product_id%)'
          or indexdef ilike 'create unique index%(%product_id%,%user_id%)'
        )
    ) then
      create unique index if not exists cart_items_user_id_product_id_uidx
        on public.cart_items (user_id, product_id);
    end if;
  end if;
end $$;`;

    const trimmed = current.trim();
    if (!trimmed) return `${block}\n`;
    return `${trimmed}\n\n${block}\n`;
  }

  function normalizeCartUpsertConflictTarget(content: string): string {
    if (!/\.from\(\s*["'`]cart_items["'`]\s*\)/i.test(content)) {
      return content;
    }

    return content.replace(
      /(\.from\(\s*["'`]cart_items["'`]\s*\)[\s\S]{0,1200}?\bonConflict\s*:\s*)(["'`])([^"'`]*)(\2)/gi,
      (_match, prefix: string, quote: string) =>
        `${prefix}${quote}${CART_CONFLICT_TARGET}${quote}`,
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
            response.cookies.set(name, value, { ...options, sameSite: "none" as const, secure: true });
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

  // Inject payment proxy env vars when payments are requested
  if (requested.requiresPayments && projectId) {
    const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const paymentEnvValues: Record<string, string> = {
      NEXT_PUBLIC_POCKET_DEV_URL: rawAppUrl && !rawAppUrl.includes("localhost") ? rawAppUrl : "https://pocket-dev-lac.vercel.app",
      NEXT_PUBLIC_POCKET_PROJECT_ID: projectId,
    };
    const envIndex = files.findIndex((f) => f.path === ".env.local");
    if (envIndex >= 0) {
      files[envIndex] = {
        ...files[envIndex],
        content: buildEnvContent(files[envIndex].content, paymentEnvValues),
      };
    } else {
      files.push({
        path: ".env.local",
        content: buildEnvContent("", paymentEnvValues),
      });
    }

    // Deterministic fallback: ensure a complete checkout flow exists even when
    // the model partially follows payment instructions.
    const hasProxyCheckoutCall = files.some((file) =>
      /\/api\/stripe\/connect\/create-checkout/.test(file.content),
    );

    const checkoutRouteIndex = findRoutePageIndex("app/checkout");
    if (checkoutRouteIndex === -1 || !hasProxyCheckoutCall) {
      const checkoutContent = buildCheckoutPageContent(hasAuthIntegration);
      if (checkoutRouteIndex === -1) {
        files.push({ path: "app/checkout/page.tsx", content: checkoutContent });
      } else {
        files[checkoutRouteIndex] = {
          ...files[checkoutRouteIndex],
          content: checkoutContent,
        };
      }
    }

    if (findRoutePageIndex("app/payment/success") === -1) {
      files.push({
        path: "app/payment/success/page.tsx",
        content: buildPaymentSuccessPageContent(),
      });
    }

    if (findRoutePageIndex("app/payment/cancel") === -1) {
      files.push({
        path: "app/payment/cancel/page.tsx",
        content: buildPaymentCancelPageContent(),
      });
    }
  }

  files = files.map((file) => {
    const normalizedPath = file.path.replace(/\\/g, "/").toLowerCase();
    if (normalizedPath === "supabase/schema.sql") {
      return {
        ...file,
        content: ensureCartConflictConstraintInSchema(file.content),
      };
    }

    if (/\.(ts|tsx|js|jsx)$/.test(normalizedPath)) {
      const normalizedContent = normalizeCartUpsertConflictTarget(file.content);
      if (normalizedContent !== file.content) {
        return { ...file, content: normalizedContent };
      }
    }

    return file;
  });

  files = ensureProviderGuardsForGeneratedFiles(files);

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

function normalizeCodeFilePath(pathValue: string): string {
  return pathValue.replace(/\\/g, "/");
}

function stripCodeExtension(pathValue: string): string {
  return pathValue.replace(/\.(tsx|ts|jsx|js)$/i, "");
}

function toKebabCaseIdentifier(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function buildRelativeImportPath(fromFilePath: string, toFilePathNoExt: string): string {
  const fromParts = normalizeCodeFilePath(fromFilePath).split("/");
  fromParts.pop(); // remove filename
  const toParts = normalizeCodeFilePath(toFilePathNoExt).split("/");

  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common += 1;
  }

  const upSegments = fromParts.length - common;
  const downSegments = toParts.slice(common).join("/");
  const upPrefix = upSegments > 0 ? "../".repeat(upSegments) : "./";
  const combined = `${upPrefix}${downSegments}`.replace(/\/+/g, "/");
  return combined.startsWith(".") ? combined : `./${combined}`;
}

function parseUndefinedReferenceIdentifier(message: string): string | null {
  const singleQuoteMatch = message.match(
    /^'([A-Za-z_$][A-Za-z0-9_$]*)'\s+is used but never imported or declared/i,
  );
  if (singleQuoteMatch) return singleQuoteMatch[1];

  const doubleQuoteMatch = message.match(
    /^"([A-Za-z_$][A-Za-z0-9_$]*)"\s+is used but never imported or declared/i,
  );
  if (doubleQuoteMatch) return doubleQuoteMatch[1];

  return null;
}

function isRouteEntryOrSpecialFile(pathValue: string): boolean {
  return /(?:^|\/)(?:page|layout|route|loading|error|global-error|not-found|template|default)\.(tsx|ts|jsx|js)$/i.test(
    normalizeCodeFilePath(pathValue),
  );
}

function fileImportsIdentifier(content: string, identifier: string): boolean {
  const sf = ts.createSourceFile(
    "file.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
    const clause = stmt.importClause;

    if (clause.name?.text === identifier) {
      return true;
    }

    const namedBindings = clause.namedBindings;
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const element of namedBindings.elements) {
        if (element.name.text === identifier) {
          return true;
        }
      }
    }

    if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      if (namedBindings.name.text === identifier) {
        return true;
      }
    }
  }

  return false;
}

function insertImportStatement(content: string, statement: string): string {
  const sf = ts.createSourceFile(
    "file.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  let lastImportEnd = -1;
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt)) {
      lastImportEnd = stmt.end;
    }
  }

  if (lastImportEnd >= 0) {
    const before = content.slice(0, lastImportEnd);
    const after = content.slice(lastImportEnd);
    const prefix = before.endsWith("\n") ? before : `${before}\n`;
    const suffix = after.startsWith("\n") || after.length === 0
      ? after
      : `\n${after}`;
    return `${prefix}${statement}${suffix}`;
  }

  const directiveMatch = content.match(
    /^\s*(?:(?:"use (?:client|server)"|'use (?:client|server)')\s*;\s*\n)+/,
  );
  if (directiveMatch) {
    const idx = directiveMatch[0].length;
    return `${content.slice(0, idx)}${statement}\n${content.slice(idx)}`;
  }

  return `${statement}\n${content}`;
}

type LocalImportCandidate = {
  sourcePathNoExt: string;
  hasNamed: boolean;
  hasDefault: boolean;
  score: number;
};

function resolveLocalImportCandidate(
  identifier: string,
  sourceFilePath: string,
  files: GeneratedFile[],
): { importPath: string; importKind: "named" | "default" } | null {
  const normalizedSourceFile = normalizeCodeFilePath(sourceFilePath);
  const sourceNoExt = stripCodeExtension(normalizedSourceFile);
  const idLower = identifier.toLowerCase();
  const idKebab = toKebabCaseIdentifier(identifier);
  const idSnake = identifier
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();

  const candidates: LocalImportCandidate[] = [];

  for (const file of files) {
    const normalizedPath = normalizeCodeFilePath(file.path);
    if (!/\.(tsx|ts|jsx|js)$/i.test(normalizedPath)) continue;
    if (isRouteEntryOrSpecialFile(normalizedPath)) continue;

    const candidateNoExt = stripCodeExtension(normalizedPath);
    if (candidateNoExt === sourceNoExt) continue;

    const parts = candidateNoExt.split("/");
    const base = parts[parts.length - 1] || "";
    const parentBase = parts.length > 1 ? parts[parts.length - 2] : "";
    const baseLower = base.toLowerCase();
    const parentLower = parentBase.toLowerCase();

    let score = 0;
    if (baseLower === idLower) score += 8;
    if (baseLower === idKebab) score += 7;
    if (baseLower === idSnake) score += 6;
    if (baseLower === "index" && parentLower === idLower) score += 7;
    if (baseLower === "index" && parentLower === idKebab) score += 6;
    if (/(?:^|\/)(?:app\/)?components\//i.test(candidateNoExt)) score += 3;
    if (/(?:^|\/)lib\//i.test(candidateNoExt)) score += 1;
    if (score <= 0) continue;

    const hasNamed = new RegExp(
      `\\bexport\\s+(?:const|function|class|type|interface|enum)\\s+${identifier}\\b`,
    ).test(file.content) ||
      new RegExp(`\\bexport\\s*\\{[^}]*\\b${identifier}\\b[^}]*\\}`).test(
        file.content,
      );
    const hasDefault = /\bexport\s+default\b/.test(file.content);

    if (!hasNamed && !hasDefault) continue;
    if (hasNamed) score += 2;
    if (hasDefault) score += 1;

    candidates.push({
      sourcePathNoExt: candidateNoExt,
      hasNamed,
      hasDefault,
      score,
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.sourcePathNoExt.localeCompare(b.sourcePathNoExt);
  });

  if (
    candidates.length > 1 &&
    candidates[0].score === candidates[1].score
  ) {
    return null;
  }

  const best = candidates[0];
  const importPath = buildRelativeImportPath(
    normalizedSourceFile,
    best.sourcePathNoExt,
  );
  const importKind = best.hasNamed ? "named" : "default";
  return { importPath, importKind };
}

function applyDeterministicUndefinedReferenceImportFixes(
  files: GeneratedFile[],
  issues: LintIssue[],
): GeneratedFile[] {
  const unresolved = issues.filter((issue) => issue.rule === "undefined-reference");
  if (unresolved.length === 0) return files;

  const nextFiles = [...files];
  const indexByPath = new Map<string, number>();
  for (let i = 0; i < nextFiles.length; i++) {
    indexByPath.set(normalizeCodeFilePath(nextFiles[i].path), i);
  }

  const targets = new Map<string, Set<string>>();
  for (const issue of unresolved) {
    const identifier = parseUndefinedReferenceIdentifier(issue.message);
    if (!identifier) continue;
    const normalizedIssuePath = normalizeCodeFilePath(issue.path);
    if (!indexByPath.has(normalizedIssuePath)) continue;

    if (!targets.has(normalizedIssuePath)) {
      targets.set(normalizedIssuePath, new Set<string>());
    }
    targets.get(normalizedIssuePath)!.add(identifier);
  }

  for (const [targetPath, identifiers] of targets) {
    const index = indexByPath.get(targetPath);
    if (index === undefined) continue;

    const targetFile = nextFiles[index];
    if (!/\.(tsx|ts|jsx|js)$/i.test(targetFile.path)) continue;

    let updatedContent = targetFile.content;
    for (const identifier of identifiers) {
      if (fileImportsIdentifier(updatedContent, identifier)) continue;

      const candidate = resolveLocalImportCandidate(
        identifier,
        targetFile.path,
        nextFiles,
      );
      if (!candidate) continue;

      const importStatement = candidate.importKind === "named"
        ? `import { ${identifier} } from "${candidate.importPath}";`
        : `import ${identifier} from "${candidate.importPath}";`;

      updatedContent = insertImportStatement(updatedContent, importStatement);
    }

    if (updatedContent !== targetFile.content) {
      nextFiles[index] = { ...targetFile, content: updatedContent };
    }
  }

  return nextFiles;
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

/**
 * General-purpose undefined reference detection.
 * Extracts all identifiers used as function calls or JSX components,
 * compares against imports + local declarations + known globals,
 * and flags anything that's missing.
 */
function collectUndefinedReferenceIssues(files: GeneratedFile[]): LintIssue[] {
  const issues: LintIssue[] = [];
  // Skip template-injected infrastructure files — they are known-good
  const TEMPLATE_FILES = new Set([
    "lib/supabase/server.ts",
    "lib/supabase/client.ts",
    "lib/supabase/middleware.ts",
    "app/auth/callback/route.ts",
    "app/loading.tsx",
    "app/global-error.tsx",
  ]);
  // Skip config files — they don't contain app logic and their syntax
  // (e.g. CSS transform strings like 'translateY(-100%)') causes false positives
  const CONFIG_FILE_RE = /(?:^|\/)(?:tailwind|next|postcss|vite|webpack|eslint|prettier)\.config\.\w+$/;
  const sourceFiles = files.filter((f) => {
    const normalized = f.path.replace(/\\/g, "/");
    return (
      /\.(tsx|ts|jsx|js)$/.test(normalized.toLowerCase()) &&
      !TEMPLATE_FILES.has(normalized) &&
      !CONFIG_FILE_RE.test(normalized)
    );
  });

  // JS/TS/React/Node/Browser built-in globals — these never need importing
  const GLOBALS = new Set([
    // JS built-ins
    "undefined", "null", "NaN", "Infinity", "globalThis", "eval",
    "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURI", "decodeURI",
    "encodeURIComponent", "decodeURIComponent", "escape", "unescape",
    "Object", "Function", "Boolean", "Symbol", "Number", "BigInt", "Math",
    "Date", "String", "RegExp", "Array", "Int8Array", "Uint8Array",
    "Uint8ClampedArray", "Int16Array", "Uint16Array", "Int32Array",
    "Uint32Array", "Float32Array", "Float64Array", "BigInt64Array",
    "BigUint64Array", "Map", "Set", "WeakMap", "WeakSet", "ArrayBuffer",
    "SharedArrayBuffer", "DataView", "Atomics", "JSON", "Promise",
    "Proxy", "Reflect", "Error", "EvalError", "RangeError", "ReferenceError",
    "SyntaxError", "TypeError", "URIError", "AggregateError",
    // Browser/DOM
    "window", "document", "navigator", "location", "history", "screen",
    "localStorage", "sessionStorage", "console", "alert", "confirm", "prompt",
    "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "Worker",
    "URL", "URLSearchParams", "Headers", "Request", "Response", "FormData",
    "Blob", "File", "FileReader", "AbortController", "AbortSignal",
    "setTimeout", "clearTimeout", "setInterval", "clearInterval",
    "requestAnimationFrame", "cancelAnimationFrame", "queueMicrotask",
    "structuredClone", "atob", "btoa", "crypto", "performance",
    "MutationObserver", "IntersectionObserver", "ResizeObserver",
    "matchMedia", "getComputedStyle", "scrollTo", "requestIdleCallback",
    "CustomEvent", "Event", "EventTarget", "HTMLElement", "Element", "Node",
    // Node.js
    "process", "Buffer", "global", "__dirname", "__filename", "module",
    "require", "exports",
    // TypeScript utility types (appear as values in some patterns)
    "Record", "Partial", "Required", "Readonly", "Pick", "Omit", "Exclude",
    "Extract", "NonNullable", "ReturnType", "Parameters", "InstanceType",
    // React — available via JSX transform (no import needed in modern React)
    "React",
    // CSS functions — appear inside style strings/template literals and are
    // not real JS function calls. Listed here as a safety net in case string
    // stripping misses template literal interpolation edges.
    "url", "calc", "clamp",
    "translate", "translateX", "translateY", "translateZ", "translate3d",
    "rotate", "rotateX", "rotateY", "rotateZ", "rotate3d",
    "scale", "scaleX", "scaleY", "scaleZ", "scale3d",
    "skew", "skewX", "skewY",
    "matrix", "matrix3d", "perspective",
    "rgb", "rgba", "hsl", "hsla",
    "cubic", "steps",
  ]);

  for (const file of sourceFiles) {
    const content = file.content;

    // 1. Collect all imported identifiers
    const imported = new Set<string>();
    const importRe = /import\s+(?:type\s+)?(?:(\w+)(?:\s*,\s*)?)?(?:\{([^}]*)\})?\s*from\s*["'][^"']+["']/g;
    let importMatch;
    while ((importMatch = importRe.exec(content)) !== null) {
      if (importMatch[1]) imported.add(importMatch[1].trim());
      if (importMatch[2]) {
        importMatch[2].split(",").forEach((s) => {
          const name = s.trim().split(/\s+as\s+/).pop()?.trim();
          if (name) imported.add(name);
        });
      }
    }
    // import * as X
    const starImportRe = /import\s+\*\s+as\s+(\w+)\s+from/g;
    let starMatch;
    while ((starMatch = starImportRe.exec(content)) !== null) {
      imported.add(starMatch[1]);
    }

    // 2. Collect locally declared identifiers
    const declared = new Set<string>();
    const declRe = /(?:const|let|var|function|class|enum)\s+(\w+)/g;
    let declMatch;
    while ((declMatch = declRe.exec(content)) !== null) {
      declared.add(declMatch[1]);
    }
    // Arrow functions assigned: const Foo = (
    const arrowRe = /(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=])\s*=>/g;
    let arrowMatch;
    while ((arrowMatch = arrowRe.exec(content)) !== null) {
      declared.add(arrowMatch[1]);
    }
    // Destructured declarations: const { a, b } = or const [a, b] =
    const destructObjRe = /(?:const|let|var)\s+\{([^}]+)\}\s*=/g;
    let dMatch;
    while ((dMatch = destructObjRe.exec(content)) !== null) {
      dMatch[1].split(",").forEach((s) => {
        const name = s.trim().split(/\s*:\s*/).pop()?.split(/\s*=\s*/)[0]?.trim();
        if (name && /^\w+$/.test(name)) declared.add(name);
      });
    }
    const destructArrRe = /(?:const|let|var)\s+\[([^\]]+)\]\s*=/g;
    let daMatch;
    while ((daMatch = destructArrRe.exec(content)) !== null) {
      daMatch[1].split(",").forEach((s) => {
        const name = s.trim().split(/\s*=\s*/)[0]?.trim();
        if (name && /^\w+$/.test(name)) declared.add(name);
      });
    }
    // Function parameters — named, anonymous, and arrow functions
    // Named: function foo(a, b) { ... }
    // Anonymous: function(a, b) { ... }
    const fnParamRe = /function\s*\w*\s*\(([^)]*)\)/g;
    let fpMatch;
    while ((fpMatch = fnParamRe.exec(content)) !== null) {
      fpMatch[1].split(",").forEach((s) => {
        const name = s.trim().split(/\s*[=:]/)[0]?.replace(/\.\.\./, "").trim();
        if (name && /^\w+$/.test(name)) declared.add(name);
      });
    }
    // Arrow function params: (a, b) => or single param: a =>
    const arrowParamRe = /\(([^)]*)\)\s*=>/g;
    let apMatch;
    while ((apMatch = arrowParamRe.exec(content)) !== null) {
      apMatch[1].split(",").forEach((s) => {
        const name = s.trim().split(/\s*[=:]/)[0]?.replace(/\.\.\./, "").trim();
        if (name && /^\w+$/.test(name)) declared.add(name);
      });
    }
    // Single-param arrow without parens: x =>
    const singleArrowRe = /\b(\w+)\s*=>/g;
    let saMatch;
    while ((saMatch = singleArrowRe.exec(content)) !== null) {
      const name = saMatch[1];
      if (name && name !== "async") declared.add(name);
    }
    // Destructured params in arrow/function: ({ name, value, options }) =>
    const destructParamRe = /\(\s*\{([^}]*)\}\s*(?::[^)]*?)?\)\s*(?:=>|\{)/g;
    let dpMatch;
    while ((dpMatch = destructParamRe.exec(content)) !== null) {
      dpMatch[1].split(",").forEach((s) => {
        const name = s.trim().split(/\s*[=:]/)[0]?.trim();
        if (name && /^\w+$/.test(name)) declared.add(name);
      });
    }
    // Object method shorthand: { foo() { }, bar(x) { } }
    const objMethodRe = /[,{]\s*(\w+)\s*\([^)]*\)\s*\{/g;
    let omMatch;
    while ((omMatch = objMethodRe.exec(content)) !== null) {
      declared.add(omMatch[1]);
    }
    // for...of / for...in loop variables: for (const x of ...) or for (const x in ...)
    const forOfInRe = /for\s*\(\s*(?:const|let|var)\s+(\w+)\s+(?:of|in)\b/g;
    let foiMatch;
    while ((foiMatch = forOfInRe.exec(content)) !== null) {
      declared.add(foiMatch[1]);
    }
    // catch clause parameter: catch (err)
    const catchRe = /catch\s*\(\s*(\w+)\s*\)/g;
    let cMatch;
    while ((cMatch = catchRe.exec(content)) !== null) {
      declared.add(cMatch[1]);
    }
    // Type/interface declarations
    const typeRe = /(?:type|interface)\s+(\w+)/g;
    let tMatch;
    while ((tMatch = typeRe.exec(content)) !== null) {
      declared.add(tMatch[1]);
    }

    // 3. Find identifiers used as function calls: identifier(
    // Exclude method calls (preceded by .) — e.g. .select(), .get(), .from()
    // Strip string literal contents first to avoid false positives from CSS
    // functions inside strings like "url(/bg.png)", "translateY(-50%)", etc.
    const strippedContent = content
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''");
    const callRe = /\b([A-Za-z_$]\w*)\s*\(/g;
    const used = new Map<string, number>(); // identifier → first char index
    let callMatch;
    while ((callMatch = callRe.exec(strippedContent)) !== null) {
      const name = callMatch[1];
      // Skip method calls: check if preceded by '.' (with optional whitespace)
      const charBefore = callMatch.index > 0 ? strippedContent[callMatch.index - 1] : "";
      if (charBefore === ".") continue;
      // Also check for ?. optional chaining
      if (callMatch.index > 1 && strippedContent[callMatch.index - 2] === "?" && charBefore === ".") continue;
      if (!used.has(name)) used.set(name, callMatch.index);
    }

    // Find identifiers used as JSX components: <Identifier (capitalized)
    const jsxRe = /<([A-Z]\w*)/g;
    let jsxMatch;
    while ((jsxMatch = jsxRe.exec(strippedContent)) !== null) {
      const name = jsxMatch[1];
      if (!used.has(name)) used.set(name, jsxMatch.index);
    }

    // 4. Flag undefined references
    // Skip keywords that look like function calls
    const jsKeywords = new Set([
      "if", "else", "for", "while", "do", "switch", "case", "break",
      "continue", "return", "throw", "try", "catch", "finally", "new",
      "delete", "typeof", "void", "instanceof", "in", "of", "yield",
      "await", "async", "super", "this", "class", "extends", "import",
      "export", "default", "from", "as", "with", "debugger",
    ]);

    for (const [name, idx] of used) {
      if (jsKeywords.has(name)) continue;
      if (GLOBALS.has(name)) continue;
      if (imported.has(name)) continue;
      if (declared.has(name)) continue;

      const pos = lineColumnAt(content, idx);
      issues.push({
        path: file.path,
        line: pos.line,
        column: pos.column,
        rule: "undefined-reference",
        message: `'${name}' is used but never imported or declared. Add the missing import.`,
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
    ...collectUndefinedReferenceIssues(files),
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

function schemaHasCartConflictUniqueConstraint(schemaSql: string): boolean {
  const normalized = schemaSql || "";

  const tableConstraintRegex =
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:public|auth)\.)?"?cart_items"?\s*\(([\s\S]*?)\);/gi;
  for (const tableMatch of normalized.matchAll(tableConstraintRegex)) {
    const tableBody = String(tableMatch[1] || "");
    if (
      /unique\s*\(\s*"?user_id"?\s*,\s*"?product_id"?\s*\)/i.test(tableBody) ||
      /unique\s*\(\s*"?product_id"?\s*,\s*"?user_id"?\s*\)/i.test(tableBody)
    ) {
      return true;
    }
  }

  if (
    /alter\s+table\s+(?:if\s+exists\s+)?(?:(?:public|auth)\.)?"?cart_items"?[\s\S]*?\badd\s+constraint[\s\S]*?\bunique\s*\(\s*"?user_id"?\s*,\s*"?product_id"?\s*\)/i.test(
      normalized,
    ) ||
    /alter\s+table\s+(?:if\s+exists\s+)?(?:(?:public|auth)\.)?"?cart_items"?[\s\S]*?\badd\s+constraint[\s\S]*?\bunique\s*\(\s*"?product_id"?\s*,\s*"?user_id"?\s*\)/i.test(
      normalized,
    )
  ) {
    return true;
  }

  if (
    /create\s+unique\s+index[\s\S]*?\bon\s+(?:(?:public|auth)\.)?"?cart_items"?[\s\S]*?\(\s*"?user_id"?\s*,\s*"?product_id"?\s*\)/i.test(
      normalized,
    ) ||
    /create\s+unique\s+index[\s\S]*?\bon\s+(?:(?:public|auth)\.)?"?cart_items"?[\s\S]*?\(\s*"?product_id"?\s*,\s*"?user_id"?\s*\)/i.test(
      normalized,
    )
  ) {
    return true;
  }

  return false;
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

// ── Schema-Code Reconciliation ──────────────────────────────────────────
// Deterministic patching: compares code references against schema SQL and
// auto-adds missing tables, columns, RLS policies, and user-signup triggers.
// Runs before bootstrap so the SQL is complete regardless of what Gemini generated.

function reconcileSchemaWithCode(
  schemaSql: string,
  files: GeneratedFile[],
): string {
  const codeTableRefs = extractSupabaseTableReferences(files);
  const schemaTables = extractCreatedTablesFromSql(schemaSql);
  const codeColumns = extractColumnReferencesFromCode(files);
  const schemaColumns = extractColumnsFromSchemaTable(schemaSql);

  const patches: string[] = [];

  // 1. Auto-create missing tables referenced in code but absent from schema
  for (const table of codeTableRefs) {
    if (schemaTables.has(table)) continue;

    // Infer columns from code usage
    const cols = codeColumns.get(table) || new Set<string>();
    const columnDefs: string[] = [`  id uuid primary key default gen_random_uuid()`];

    // If code inserts/selects user_id, add it with auth.users ref
    if (cols.has("user_id")) {
      columnDefs.push(`  user_id uuid references auth.users(id) on delete cascade`);
      cols.delete("user_id");
    }

    // Common column type inference
    for (const col of cols) {
      if (col === "id") continue;
      const colLower = col.toLowerCase();
      let colType = "text"; // safe default
      if (colLower.endsWith("_at") || colLower === "created_at" || colLower === "updated_at") {
        colType = "timestamptz default now()";
      } else if (colLower === "email") {
        colType = "text";
      } else if (colLower === "price" || colLower === "amount" || colLower === "total" || colLower === "cost") {
        colType = "numeric(10,2) default 0";
      } else if (colLower === "quantity" || colLower === "count" || colLower === "stock") {
        colType = "integer default 0";
      } else if (colLower.startsWith("is_") || colLower.startsWith("has_") || colLower === "active" || colLower === "published" || colLower === "completed") {
        colType = "boolean default false";
      } else if (colLower === "rating" || colLower === "score") {
        colType = "integer";
      } else if (colLower.endsWith("_id")) {
        colType = "uuid";
      } else if (colLower === "image" || colLower === "avatar" || colLower === "url" || colLower === "image_url" || colLower === "avatar_url" || colLower === "photo") {
        colType = "text";
      }
      columnDefs.push(`  "${col}" ${colType}`);
    }

    // Always add created_at if not already present
    if (!cols.has("created_at")) {
      columnDefs.push(`  created_at timestamptz default now()`);
    }

    patches.push(`-- auto-generated: table "${table}" referenced in code but missing from schema
create table if not exists "${table}" (
${columnDefs.join(",\n")}
);

alter table "${table}" enable row level security;

-- default RLS: authenticated users can read all, write own rows
create policy "${table}_select_policy" on "${table}" for select using (true);
create policy "${table}_insert_policy" on "${table}" for insert with check (auth.uid() = user_id);
create policy "${table}_update_policy" on "${table}" for update using (auth.uid() = user_id);
create policy "${table}_delete_policy" on "${table}" for delete using (auth.uid() = user_id);`);

    // Track it so column checks below see this table
    schemaTables.add(table);
    schemaColumns.set(table, new Set(columnDefs.map((d) => {
      const m = d.trim().match(/^"?(\w+)"?/);
      return m ? m[1] : "";
    }).filter(Boolean)));
  }

  // 2. Auto-add missing columns to existing tables
  for (const [table, codeCols] of codeColumns) {
    if (!schemaTables.has(table)) continue; // table was just created above or doesn't exist
    const existingCols = schemaColumns.get(table) || new Set<string>();

    for (const col of codeCols) {
      if (col === "id" || col === "*" || existingCols.has(col)) continue;

      const colLower = col.toLowerCase();
      let colType = "text";
      if (colLower.endsWith("_at")) colType = "timestamptz";
      else if (colLower === "price" || colLower === "amount" || colLower === "total") colType = "numeric(10,2)";
      else if (colLower === "quantity" || colLower === "count" || colLower === "stock") colType = "integer default 0";
      else if (colLower.startsWith("is_") || colLower.startsWith("has_")) colType = "boolean default false";
      else if (colLower.endsWith("_id")) colType = "uuid";

      patches.push(
        `-- auto-generated: column "${col}" used in code but missing from "${table}"\ndo $$ begin\n  alter table "${table}" add column if not exists "${col}" ${colType};\nexception when others then null;\nend $$;`,
      );
    }
  }

  // 3. Check for tables with user_id FK that might be missing RLS
  const schemaLower = schemaSql.toLowerCase();
  for (const table of schemaTables) {
    const existingCols = schemaColumns.get(table) || new Set<string>();
    if (!existingCols.has("user_id")) continue;

    // Check if RLS is already enabled for this table in the original schema
    const rlsPattern = new RegExp(
      `alter\\s+table\\s+(?:public\\.)?"?${table}"?\\s+enable\\s+row\\s+level\\s+security`,
      "i",
    );
    if (rlsPattern.test(schemaLower)) continue;

    // Also check if we just added it in patches
    const patchStr = patches.join("\n").toLowerCase();
    if (patchStr.includes(`alter table "${table}" enable row level security`)) continue;

    patches.push(`-- auto-generated: RLS for "${table}" (has user_id but no RLS detected)
do $$ begin
  alter table "${table}" enable row level security;
exception when others then null;
end $$;

do $$ begin
  execute 'create policy "${table}_select_policy" on "${table}" for select using (true)';
exception when duplicate_object then null;
end $$;
do $$ begin
  execute 'create policy "${table}_insert_policy" on "${table}" for insert with check (auth.uid() = user_id)';
exception when duplicate_object then null;
end $$;
do $$ begin
  execute 'create policy "${table}_update_policy" on "${table}" for update using (auth.uid() = user_id)';
exception when duplicate_object then null;
end $$;
do $$ begin
  execute 'create policy "${table}_delete_policy" on "${table}" for delete using (auth.uid() = user_id)';
exception when duplicate_object then null;
end $$;`);
  }

  if (patches.length === 0) return schemaSql;

  return `${schemaSql}\n\n-- ═══ Auto-reconciled patches (code → schema) ═══\n${patches.join("\n\n")}`;
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

  const codeFiles = files.filter(
    (f) =>
      f.path.endsWith(".ts") ||
      f.path.endsWith(".tsx") ||
      f.path.endsWith(".js") ||
      f.path.endsWith(".jsx"),
  );

  const cartUpsertInCode = codeFiles.some(
    (file) =>
      /\.from\(\s*["'`]cart_items["'`]\s*\)[\s\S]*?\.upsert\(/i.test(
        file.content,
      ),
  );
  if (cartUpsertInCode && !schemaHasCartConflictUniqueConstraint(schemaContent)) {
    issues.push({
      path: "supabase/schema.sql",
      line: 1,
      column: 1,
      rule: "schema/cart-missing-conflict-constraint",
      message:
        'Code performs cart_items upserts, but schema lacks a unique constraint/index for (user_id, product_id). Add UNIQUE(user_id, product_id) so upsert onConflict works reliably.',
    });
  }

  for (const file of codeFiles) {
    const cartConflictRe =
      /\.from\(\s*["'`]cart_items["'`]\s*\)[\s\S]{0,1200}?\bonConflict\s*:\s*["'`]([^"'`]+)["'`]/gi;
    for (const match of file.content.matchAll(cartConflictRe)) {
      const configuredTarget = String(match[1] || "")
        .replace(/\s+/g, "")
        .toLowerCase();
      if (
        configuredTarget === "user_id,product_id" ||
        configuredTarget === "product_id,user_id"
      ) {
        continue;
      }

      const pos = lineColumnAt(file.content, match.index ?? 0);
      issues.push({
        path: file.path,
        line: pos.line,
        column: pos.column,
        rule: "schema/cart-invalid-on-conflict-target",
        message:
          'cart_items upsert must use onConflict: "user_id,product_id" so it matches schema constraints.',
      });
    }
  }

  // Relation join validation: check that .select('*, other_table(...)') references real tables
  // AND that a direct foreign key exists between the source table and joined table.
  // PostgREST only resolves joins via direct FK relationships.
  const foreignKeys = extractForeignKeysFromSql(schemaContent);
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

function collectNonBackendTransactionalIssues(
  files: GeneratedFile[],
  requirements: IntegrationRequirements,
): LintIssue[] {
  if (requirements.requiresAuth || requirements.requiresDatabase) return [];

  const issues: LintIssue[] = [];

  for (const file of files) {
    const normalizedPath = file.path.replace(/\\/g, "/").toLowerCase();
    const isCodeFile = /\.(tsx|ts|jsx|js)$/.test(normalizedPath);

    if (
      normalizedPath.startsWith("app/api/") &&
      normalizedPath !== "app/api/image-proxy/route.ts"
    ) {
      issues.push({
        path: file.path,
        line: 1,
        column: 1,
        rule: "public-site/no-server-api-routes",
        message:
          "Backend is disabled, so app-level API routes are not allowed. Convert this interaction to a read-only/public UX without server mutation endpoints.",
      });
    }

    if (!isCodeFile) continue;

    const writeNetworkPattern =
      /\bfetch\s*\(\s*(?:["'`](?:\/|\.\/|\.\.\/)[^"'`]*["'`]|`?\$\{window\.location\.origin\}\/[^`]+`?)[\s\S]{0,320}\{[\s\S]{0,320}\bmethod\s*:\s*["'`](POST|PUT|PATCH|DELETE)["'`][\s\S]{0,320}\}/i;
    const axiosWritePattern =
      /\baxios\.(post|put|patch|delete)\s*\(\s*["'`](?:\/|\.\/|\.\.\/)[^"'`]*["'`]/i;
    const persistentWritePattern =
      /\b(?:localStorage|sessionStorage)\.setItem\s*\(|\bindexedDB\.open\s*\(|\bidb(?:Keyval)?\.(?:set|update)\s*\(/i;
    const collectionMutationPattern =
      /\bset[A-Z][A-Za-z0-9_]*\s*\(\s*(?:\(\s*)?(?:prev|prevState)\s*=>[\s\S]{0,220}(?:\[\s*\.\.\.\s*(?:prev|prevState)|(?:prev|prevState)\.(?:filter|map|concat)\s*\(|splice\s*\()/i;
    const directArrayMutationPattern =
      /\bset[A-Z][A-Za-z0-9_]*\s*\(\s*\[\s*\.\.\.\s*[A-Za-z0-9_]+\s*,/i;
    const transactionalSignalPattern =
      /\b(price|amount|subtotal|total|quantity|lineItems?|currency|inventory|stock)\b/i;

    const hasWriteNetwork =
      writeNetworkPattern.test(file.content) || axiosWritePattern.test(file.content);
    const hasPersistentWrite = persistentWritePattern.test(file.content);
    const hasCollectionMutation =
      collectionMutationPattern.test(file.content) ||
      directArrayMutationPattern.test(file.content);
    const hasTransactionalSignals = transactionalSignalPattern.test(file.content);

    if (
      hasWriteNetwork &&
      (hasTransactionalSignals || hasCollectionMutation || hasPersistentWrite)
    ) {
      issues.push({
        path: file.path,
        line: 1,
        column: 1,
        rule: "public-site/no-write-network-actions",
        message:
          "Backend is disabled, but this file performs write-oriented network actions. Replace with read-only/public behavior or enable backend integration.",
      });
    }

    if (hasPersistentWrite && hasCollectionMutation) {
      issues.push({
        path: file.path,
        line: 1,
        column: 1,
        rule: "public-site/no-persistent-client-transaction-state",
        message:
          "Backend is disabled, but this file writes persistent client transaction state. Remove persistent transactional mutations for public/static mode.",
      });
    }

    if (hasCollectionMutation && (hasTransactionalSignals || hasPersistentWrite)) {
      issues.push({
        path: file.path,
        line: 1,
        column: 1,
        rule: "public-site/no-transactional-mutation-flows",
        message:
          "Backend is disabled, but this file implements transactional mutation flows. Convert to read-only/public presentation or enable backend.",
      });
    }

    const normalizeUiSnippet = (snippet: string): string =>
      snippet
        .replace(/<[^>]+>/g, " ")
        .replace(/\{[^}]+\}/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    const authUiTextPattern =
      /\b(sign[\s-]?in|log[\s-]?in|sign[\s-]?up|register|create account|my account|account|profile|my orders?|order history)\b/i;
    const transactionalUiTextPattern =
      /\b(add(?:\s+to)?\s+(?:cart|bag|basket)|buy(?:\s+now)?|checkout|place order|order now|save for later|wishlist|favorite|favourite|payment|billing|subscribe)\b/i;
    const authUiAttrPattern =
      /\b(?:aria-label|title)\s*=\s*["'`][^"'`]*(sign[\s-]?in|log[\s-]?in|sign[\s-]?up|register|account|profile|orders?)\b[^"'`]*["'`]/i;
    const transactionalUiAttrPattern =
      /\b(?:aria-label|title)\s*=\s*["'`][^"'`]*(cart|basket|bag|checkout|wishlist|favorite|favourite|payment|billing|subscribe)\b[^"'`]*["'`]/i;
    const protectedRouteHrefPattern =
      /\bhref\s*=\s*["'`](\/(?:sign[-]?in|log[-]?in|sign[-]?up|register|account|profile|orders?|checkout|cart|bag|basket|wishlist|favorites?|billing|payment)(?:[/"'`?#]|$))/i;
    const protectedRouteNavPattern =
      /\b(?:router\.push|router\.replace|window\.location(?:\.href)?)\s*\(\s*["'`](\/(?:sign[-]?in|log[-]?in|sign[-]?up|register|account|profile|orders?|checkout|cart|bag|basket|wishlist|favorites?|billing|payment)(?:[/"'`?#]|$))/i;
    const authIconPattern =
      /<(?:LogIn|LogOut|UserPlus|UserCheck|UserRound|UserCircle|UserCog|KeyRound|Lock|Unlock)\b/;
    const transactionalIconPattern =
      /<(?:ShoppingCart|ShoppingBag|ShoppingBasket|Basket|CreditCard|Wallet|Receipt(?:Text)?)\b/;
    const heartIconPattern = /<Heart\b/;

    let hasAuthUiAffordance = false;
    let hasTransactionalUiAffordance = false;

    const interactiveElementRe =
      /<(button|a|Link)\b([^>]*)>([\s\S]{0,260}?)<\/\1>/gi;
    for (const match of file.content.matchAll(interactiveElementRe)) {
      const attrs = String(match[2] || "");
      const inner = String(match[3] || "");
      const normalizedText = normalizeUiSnippet(inner);
      const normalizedContext = normalizeUiSnippet(`${attrs} ${inner}`);

      if (
        authUiTextPattern.test(normalizedText) ||
        authUiAttrPattern.test(attrs) ||
        authIconPattern.test(inner)
      ) {
        hasAuthUiAffordance = true;
      }

      if (
        transactionalUiTextPattern.test(normalizedText) ||
        transactionalUiAttrPattern.test(attrs) ||
        transactionalIconPattern.test(inner) ||
        (heartIconPattern.test(inner) &&
          /\b(wish|favorite|favourite|save)\b/i.test(normalizedContext))
      ) {
        hasTransactionalUiAffordance = true;
      }
    }

    const inputActionRe = /<input\b([^>]*)\/?>/gi;
    for (const match of file.content.matchAll(inputActionRe)) {
      const attrs = String(match[1] || "");
      const normalizedAttrs = normalizeUiSnippet(attrs);
      if (authUiTextPattern.test(normalizedAttrs)) {
        hasAuthUiAffordance = true;
      }
      if (transactionalUiTextPattern.test(normalizedAttrs)) {
        hasTransactionalUiAffordance = true;
      }
    }

    if (
      protectedRouteHrefPattern.test(file.content) ||
      protectedRouteNavPattern.test(file.content)
    ) {
      hasAuthUiAffordance = true;
      hasTransactionalUiAffordance = true;
    }

    if (hasAuthUiAffordance) {
      issues.push({
        path: file.path,
        line: 1,
        column: 1,
        rule: "public-site/no-auth-ui-affordances",
        message:
          "Backend is disabled, but this file exposes authentication/account-related UI affordances. Remove account/protected-action controls in public/static mode.",
      });
    }

    if (hasTransactionalUiAffordance) {
      issues.push({
        path: file.path,
        line: 1,
        column: 1,
        rule: "public-site/no-transactional-ui-affordances",
        message:
          "Backend is disabled, but this file exposes transactional UI affordances. Remove mutation-oriented controls in public/static mode.",
      });
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

      // Safely reconcile orphan rows before adding the FK constraint.
      // We can't predict the referenced table's columns (AI-generated schema),
      // so we: (1) try to backfill with just the PK, (2) if that fails due to
      // NOT NULL / check constraints, delete orphan rows as a fallback.
      // Both paths are wrapped in exception handlers so nothing can crash the block.
      const refTableLower = refTable.toLowerCase();
      const refColLower = refCol.toLowerCase();
      const needsOrphanFix =
        refTableLower !== tblName.toLowerCase() && // skip self-references
        refColLower === "id"; // only when referencing a PK

      const orphanFixBlock = needsOrphanFix
        ? `\n    -- attempt 1: backfill missing rows in referenced table (PK only)\n    begin\n      insert into "${refTable}" ("${refCol}")\n      select distinct "${tblName}"."${colName}"\n      from "${tblName}"\n      where "${tblName}"."${colName}" is not null\n        and "${tblName}"."${colName}" not in (select "${refCol}" from "${refTable}")\n      on conflict ("${refCol}") do nothing;\n    exception when others then\n      raise notice 'Backfill into ${refTable} failed (%): deleting orphan rows from ${tblName} instead', SQLERRM;\n      -- attempt 2: delete orphan rows that would violate the FK\n      begin\n        delete from "${tblName}"\n        where "${colName}" is not null\n          and "${colName}" not in (select "${refCol}" from "${refTable}");\n      exception when others then\n        raise notice 'Orphan cleanup in ${tblName} also failed: %', SQLERRM;\n      end;\n    end;`
        : "";

      fkRepairStatements.push(
        `do $$ begin\n  if to_regclass('${escapeSqlLiteral(tblName)}') is not null then\n    alter table "${tblName}" drop constraint if exists "${constraintName}";${orphanFixBlock}\n    begin\n      alter table "${tblName}" add constraint "${constraintName}" foreign key ("${colName}") references "${refTable}"("${refCol}")${onDelete};\n    exception when others then\n      raise notice 'FK ${constraintName} could not be added: %', SQLERRM;\n    end;\n  end if;\nend $$;`,
      );
    }
  }

  const fkPhase =
    fkRepairStatements.length > 0
      ? `\n-- phase 3: ensure foreign key constraints match schema (fixes PostgREST join errors)\n${fkRepairStatements.join("\n")}\n`
      : "";

  // Phase 4: Auto-inject handle_new_user() trigger for any user-linked table.
  // Detects tables whose `id` column references auth.users(id) — these are
  // "profiles-like" tables that need a row auto-created on signup.
  // This is infrastructure-level, so it works regardless of what Gemini generates.
  const userLinkedTables: string[] = [];
  const userTableRegex =
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:public)\.)?"?(\w+)"?\s*\(([\s\S]*?)\);/gi;
  for (const tblMatch of schemaSql.matchAll(userTableRegex)) {
    const tblName = tblMatch[1];
    const body = tblMatch[2];
    // Check if this table has `id` referencing auth.users(id)
    const hasAuthUserIdRef = /\bid\b[^,]*\breferences\s+auth\.users\s*\(\s*id\s*\)/i.test(body);
    if (hasAuthUserIdRef) {
      userLinkedTables.push(tblName);
    }
  }

  let triggerPhase = "";
  if (userLinkedTables.length > 0) {
    // Find which columns exist in these tables (for the INSERT)
    const triggerBlocks: string[] = [];
    for (const tblName of userLinkedTables) {
      // Extract column names from the table definition to build the INSERT
      const tblRegex = new RegExp(
        `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:(?:public)\\.)?\"?${tblName}\"?\\s*\\(([\\s\\S]*?)\\);`,
        "i",
      );
      const tblBody = schemaSql.match(tblRegex);
      const cols: string[] = ["id"];
      if (tblBody) {
        for (const line of tblBody[1].split("\n")) {
          const t = line.trim();
          if (!t || /^(constraint|primary|foreign|unique|check)\b/i.test(t)) continue;
          const colMatch = t.match(/^"?(\w+)"?/);
          if (!colMatch) continue;
          const col = colMatch[1].toLowerCase();
          if (col === "id") continue;
          if (col === "email") cols.push("email");
        }
      }

      const insertCols = cols.join(", ");
      const insertVals = cols.map((c) => (c === "id" ? "NEW.id" : c === "email" ? "NEW.email" : `NULL`)).join(", ");

      triggerBlocks.push(`-- auto-create row in "${tblName}" on signup
create or replace function public.handle_new_user_${tblName}()
returns trigger as $func$
begin
  insert into public."${tblName}" (${insertCols})
  values (${insertVals})
  on conflict (id) do nothing;
  return NEW;
end;
$func$ language plpgsql security definer;

do $$ begin
  drop trigger if exists on_auth_user_created_${tblName} on auth.users;
  create trigger on_auth_user_created_${tblName}
    after insert on auth.users
    for each row execute function public.handle_new_user_${tblName}();
exception when others then
  raise notice 'Trigger for ${tblName} could not be created: %', SQLERRM;
end $$;`);
    }

    triggerPhase = `\n-- phase 4: auto-create user rows on signup for user-linked tables\n${triggerBlocks.join("\n\n")}\n`;
  }

  return `${prelude}\n\n${policyPrelude}${withGuardedPolicies}\n${alterPhase}${fkPhase}${triggerPhase}`;
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

function parseTscOutput(output: string): LintIssue[] {
  const issues: LintIssue[] = [];
  // tsc output format: file(line,col): error TS####: message
  const errorRegex = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/gm;
  let match;
  while ((match = errorRegex.exec(output)) !== null) {
    const [, filePath, line, column, code, message] = match;
    // Skip errors from node_modules
    if (filePath.includes("node_modules/")) continue;
    issues.push({
      path: filePath,
      line: parseInt(line, 10),
      column: parseInt(column, 10),
      rule: code,
      message: `${code}: ${message}`,
    });
  }
  return issues;
}

function buildPackageJsonForTypecheck(
  deps: Record<string, string>,
  files: GeneratedFile[],
): string {
  const hasAuth = files.some(
    (f) =>
      f.content.includes("@supabase/supabase-js") ||
      f.content.includes("supabase.auth"),
  );
  return JSON.stringify(
    {
      name: "typecheck-project",
      private: true,
      dependencies: {
        ...deps,
        next: GENERATED_NEXT_VERSION,
        react: GENERATED_REACT_VERSION,
        "react-dom": GENERATED_REACT_VERSION,
        ...(hasAuth
          ? {
              "@supabase/supabase-js": "^2.57.4",
              "@supabase/ssr": "^0.7.0",
            }
          : {}),
      },
      devDependencies: {
        "@types/node": "^20",
        "@types/react": "^19",
        "@types/react-dom": "^19",
        typescript: "^5",
      },
    },
    null,
    2,
  );
}

function buildTsconfigForTypecheck(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: false,
        plugins: [{ name: "next" }],
        paths: { "@/*": ["./*"] },
      },
      include: ["**/*.ts", "**/*.tsx"],
      exclude: ["node_modules"],
    },
    null,
    2,
  );
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
    retries: 0,
    cancelOn: [
      {
        event: "app/generate.cancelled",
        if: "async.data.projectId == event.data.projectId",
      },
    ],
    onFailure: async ({ event, error }) => {
      // In onFailure, the original event is nested at event.data.event.data
      const failureData = (event as Record<string, unknown>).data as Record<string, unknown> | undefined;
      const originalEvent = failureData?.event as Record<string, unknown> | undefined;
      const originalData = originalEvent?.data as Record<string, unknown> | undefined;
      const projectId = originalData?.projectId as string | undefined;
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
    const userId = (event.data as Record<string, unknown>)?.userId as string | undefined;
    const preserveExistingImages = (event.data as Record<string, unknown>)?.preserveExistingImages as boolean | undefined;
    const previousImageUrls = (event.data as Record<string, unknown>)?.previousImageUrls as string[] | undefined;

    try {
    const userProjectType = (event.data as Record<string, unknown>)?.projectType as "website" | "dashboard" | undefined;

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
    if (needsManagedAuth) {
      managedAuthConfig = await step.run(
        "allocate-managed-supabase",
        async () => {
          return await acquireAuthConfigForBindingKey(projectId);
        },
      );
    }

    // Step 1: Detect project type + build user prompt
    await step.run("check-cancelled-and-notify-start", async () => {
      if (await checkIfCancelled(projectId)) {
        throw new Error("Generation cancelled by user");
      }
      await sendProgress(projectId, "[1/9] Understanding your request...");
    });

    // Detect project type in a dedicated step so edit requests skip it cheaply.
    const detectedProjectType = await step.run(
      "detect-project-type",
      async (): Promise<ProjectType> => {
        // User explicitly chose a project type → use their choice
        if (userProjectType) return userProjectType;
        const isEdit = (prompt as string)
          .trimStart()
          .startsWith("You are a senior full-stack developer");
        if (isEdit) return "website"; // edits preserve the existing type
        // Auto-detect for legacy/API calls without explicit type
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
- Runtime dependency policy: if you generate package.json, set "next": "${GENERATED_NEXT_VERSION}", "react": "${GENERATED_REACT_VERSION}", and "react-dom": "${GENERATED_REACT_VERSION}". Do NOT pin Next 14/15.
- Required files: app/layout.tsx, app/page.tsx, app/not-found.tsx, app/loading.tsx, app/globals.css, components/sidebar.tsx (or inline sidebar in layout).
- Generate app/not-found.tsx — a styled 404 page matching the dashboard's design. Include sidebar/nav so auth state stays visible.
- Every sidebar nav link MUST have a real corresponding page file. No dead links.
- Charts live in "use client" components — never import recharts in a server component.
- Do not use @apply in CSS.
- All files must parse without TS/JS syntax errors.
- Do not output lockfiles.

AUTHENTICATION & BACKEND RULES:
  * If auth/backend is NOT requested: do NOT generate sign-in/sign-up/login pages, middleware.ts, auth API routes, or any Supabase imports. Do NOT add account-dependent transactional features that imply backend state. Build with zero backend dependencies.
  * When auth IS requested, generate: BOTH app/sign-in/page.tsx AND app/sign-up/page.tsx (always both, linked to each other), a verification email page (app/auth/verify/page.tsx) shown after sign-up with "Check your email" message + "Back to sign in" link (redirect to /auth/verify?email=... after signUp()), middleware.ts, Supabase SSR auth
  * Use env vars: process.env.NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
  * DATABASE CONTRACT: include supabase/schema.sql with CREATE TABLE IF NOT EXISTS + RLS for every .from() table
  * PUBLIC vs PROTECTED ACCESS: Read-only/browse pages are public (no login). All write/mutate actions (create, update, delete) MUST require auth — check supabase.auth.getUser() before INSERT/UPDATE/DELETE, redirect to sign-in if unauthenticated. Protect write-action routes in middleware.ts (/dashboard, /admin, /new, /create, /edit) but NOT public browse routes. RLS policies must enforce ownership (auth.uid() = user_id) for writes. Protected examples include: Add to cart, add/remove favorites or wishlist items, save-for-later, submit comments/reviews, like/follow/bookmark, checkout/order placement, billing updates, and private account/profile changes.
  * Derive protected routes/actions from behavior, not hardcoded names: if a route or handler performs mutation, billing, private-account access, or user-owned state changes, it must be auth-gated in both UI flow and server/API checks (including Add to cart/favorites/wishlist flows).

PAYMENT RULES (PROXY PATTERN):
  * If payments are NOT requested: do NOT generate any payment code, checkout routes, or payment pages. Display-only pricing is fine.
  * When payments ARE requested: Do NOT add "stripe" dependency. Do NOT generate app/api/checkout/route.ts or any server-side Stripe code. Buy/Subscribe buttons POST to the platform proxy: \`\${process.env.NEXT_PUBLIC_POCKET_DEV_URL}/api/stripe/connect/create-checkout\` with body { projectId: process.env.NEXT_PUBLIC_POCKET_PROJECT_ID, lineItems: [{ name, amount (cents), currency?, quantity? }], successUrl: \`\${window.location.origin}/payment/success\`, cancelUrl: \`\${window.location.origin}/payment/cancel\`, customerEmail? }. Redirect to the returned { url }. Generate static app/payment/success/page.tsx and app/payment/cancel/page.tsx. No custom card forms. If auth is enabled, pass customer_email.`;
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
10. Ensure ALL text has strong contrast against its background — never place light text on light backgrounds or dark text on dark backgrounds.

CORE IMPLEMENTATION RULES:
- Use Next.js App Router + TypeScript + Tailwind utility classes.
- Runtime dependency policy: if you generate package.json, set "next": "${GENERATED_NEXT_VERSION}", "react": "${GENERATED_REACT_VERSION}", and "react-dom": "${GENERATED_REACT_VERSION}". Do NOT pin Next 14/15.
- Return a complete runnable project with app/layout.tsx, app/page.tsx, app/not-found.tsx, app/loading.tsx, app/globals.css, AND a separate app/{route}/page.tsx for every navigation link.
- Generate app/not-found.tsx — a styled 404 page that matches the site's design (colors, fonts, layout). Include the site's navbar/header so auth state stays visible if auth is enabled. Must have a link back to the home page.
- EVERY internal link in the navbar/header/footer (e.g., "About", "Services", "Pricing", "Contact", "Blog") MUST have a real corresponding page file. No dead links.
- Each sub-page must contain real, domain-relevant content — at minimum a hero/header + 1-2 meaningful content sections. Not just an empty placeholder.
- If app/globals.css contains @layer base/components/utilities, include matching @tailwind directives.
- Do not use @apply in generated CSS; use explicit utility classes in JSX.
- If a provider guard is required, wrap {children} correctly in app/layout.tsx.
- Preserve semantic HTML, accessibility, and responsive behavior.
- Do not output lockfiles or unsafe file paths.
- All returned files must parse without TS/JS syntax errors.

AUTHENTICATION & BACKEND RULES:
  * If auth/backend is NOT explicitly requested by the user:
    - Do NOT generate sign-in, sign-up, login, or register pages (no app/sign-in/page.tsx, etc.)
    - Do NOT generate middleware.ts, auth API routes, or any Supabase auth code
    - Do NOT import from @supabase/ssr, @supabase/supabase-js, or @/lib/supabase anywhere
    - Do NOT add "Sign In", "Sign Up", "Login", "Register", "Log Out" buttons or links in the navbar or anywhere
    - Do NOT add account-dependent transactional features or any backend-dependent UI
    - Build a fully functional static/public website with NO auth and NO backend dependencies
  * When auth IS requested, generate the COMPLETE auth system yourself:
    - BOTH sign-in (app/sign-in/page.tsx) AND sign-up (app/sign-up/page.tsx) pages — ALWAYS generate both, with links between them, professional brand-aligned design
    - A verification email page (app/auth/verify/page.tsx) — shown after sign-up. Displays "Check your email" with the user's email, instruction to click the verification link, and a "Back to sign in" link. After supabase.auth.signUp() succeeds, redirect to /auth/verify?email=<user_email>.
    - API routes for auth operations (signin, signup, signout, session check) using @supabase/ssr createServerClient
    - middleware.ts for session handling and protected route redirects
    - Use env vars: process.env.NEXT_PUBLIC_SUPABASE_URL and process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as fallback)
    - Use supabase.auth.signInWithPassword(), supabase.auth.signUp(), supabase.auth.signOut(), supabase.auth.getUser()
    - Include: password visibility toggle, password confirmation on signup, inline validation, loading states, error messages
    - Auth CTAs must be session-aware (signed-out vs signed-in). Show user identity + logout when signed in.
    - Do NOT hardcode secrets or service-role keys
    - The platform provides lib/supabase/client.ts and lib/supabase/server.ts — you can import from those or create your own client using @supabase/ssr
  * PUBLIC vs PROTECTED ACCESS — CRITICAL:
    - READ/BROWSE pages are PUBLIC: anyone can view product listings, read blog posts, browse content, see landing pages — no login required.
    - WRITE/MUTATE actions are PROTECTED: any action that creates/updates/deletes user-scoped, transactional, billing, or private data MUST require authentication. Examples include: Add to cart, add/remove favorites or wishlist items, save-for-later, submit comments/reviews, like/follow/bookmark, start checkout/place orders, manage addresses/payment methods, bookings, and private account/profile updates.
    - Before any Supabase INSERT, UPDATE, or DELETE, check supabase.auth.getUser(). If no authenticated user, redirect to sign-in or show a "Please sign in to continue" prompt — NEVER let anonymous users write data.
    - middleware.ts should protect write-action routes (/dashboard, /account, /admin, /checkout, /new, /create, /edit) but NOT public browse routes (/, /blog, /products, /about).
    - Derive protected routes/actions from behavior, not hardcoded route names or feature names: if a route or handler performs mutation, billing, private-account access, or user-owned state changes, it must be auth-gated in both UI flow and server/API checks (including Add to cart/favorites/wishlist flows).
    - Forms or action handlers that write to the database must verify the user is logged in BEFORE allowing submission. Show a sign-in CTA if unauthenticated.
    - RLS policies must enforce ownership: users can only INSERT/UPDATE/DELETE their own rows (auth.uid() = user_id). SELECT policies can be more permissive for public content.
    - Any user-owned saved state must be tied to auth.uid(); unauthenticated users must not mutate persistent or user-scoped state.

PAYMENT RULES (PROXY PATTERN):
  * If payments are NOT requested: do NOT generate any payment code, checkout routes, or payment pages. Display-only pricing is fine.
  * When payments ARE requested: Do NOT add "stripe" dependency. Do NOT generate app/api/checkout/route.ts or any server-side Stripe code. Buy/Subscribe buttons POST to the platform proxy: \`\${process.env.NEXT_PUBLIC_POCKET_DEV_URL}/api/stripe/connect/create-checkout\` with body { projectId: process.env.NEXT_PUBLIC_POCKET_PROJECT_ID, lineItems: [{ name, amount (cents), currency?, quantity? }], successUrl: \`\${window.location.origin}/payment/success\`, cancelUrl: \`\${window.location.origin}/payment/cancel\`, customerEmail? }. Redirect to the returned { url }. Generate static app/payment/success/page.tsx and app/payment/cancel/page.tsx. No custom card forms. If auth is enabled, pass customer_email.

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
- CRITICAL: Every nav link must use Next.js Link component with href pointing to a real route (e.g., href="/about"). Generate a matching app/{route}/page.tsx for each. No "#" or empty href values for primary navigation items.`;
    });

    // Step 1.5: Extract theme from prompt
    const detectedTheme = await step.run(
      "extract-theme-from-prompt",
      async () => {
        return await extractThemeFromPrompt(prompt);
      },
    );

    // Step 2: Generate with Gemini
    const generatedText = await step.run("generate-with-gemini", async () => {
      // Progress + cancel check inside the step so they don't eat into replay overhead
      await sendProgress(projectId, "[2/9] Generating your app...");
      if (await checkIfCancelled(projectId)) {
        throw new Error("Generation cancelled by user");
      }
      console.log("Using Gemini 3 Flash Preview...");

      try {
        // Pick system prompt based on request type and detected project type:
        // - Edits: REPAIR_SYSTEM_PROMPT (minimal, targeted changes)
        // - Dashboard/app: DASHBOARD_SYSTEM_PROMPT
        // - Website: SYSTEM_PROMPT (design-agency)
        let generationSystemPrompt = isEditRequest
          ? REPAIR_SYSTEM_PROMPT
          : detectedProjectType === "dashboard"
            ? DASHBOARD_SYSTEM_PROMPT
            : SYSTEM_PROMPT;

        // Append Supabase API reference when backend/auth is enabled
        if (integrationRequirements.requiresAuth || integrationRequirements.requiresDatabase) {
          generationSystemPrompt += "\n" + SUPABASE_API_REFERENCE;
        }

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

    // Step 3: Parse and prepare files
    const parsedProject = await step.run("parse-and-normalize", async () => {
      await sendProgress(projectId, "[3/9] Parsing and validating code...");
      if (await checkIfCancelled(projectId)) {
        throw new Error("Generation cancelled by user");
      }
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
        projectId,
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
            projectId,
          );
          files = applyKnownImportSpecifierFixups(files);
          dependencies = repairedProject.dependencies;
        }
      }

      console.log(`Parsed ${files.length} files successfully`);
      return { files, dependencies };
    });
    let files = parsedProject.files;
    let dependencies = parsedProject.dependencies;

    // Syntax repair — each attempt gets its own step (60s budget)
    for (let attempt = 1; attempt <= MAX_SYNTAX_REPAIR_ATTEMPTS; attempt++) {
      const syntaxIssues = collectSyntaxIssues(files);
      if (syntaxIssues.length === 0) break;

      const repaired = await step.run(`syntax-repair-${attempt}`, async () => {
        console.warn(
          `[SyntaxRepair] Attempt ${attempt} - ${syntaxIssues.length} syntax issue(s).`,
        );
        try {
          const result = await repairProjectFromLintFeedback({
            originalPrompt: prompt,
            files,
            dependencies,
            lintIssues: syntaxIssues,
            requirements: integrationRequirements,
            managedAuthConfig,
            systemPrompt: repairSystemPrompt,
          });
          return {
            files: applyKnownImportSpecifierFixups(result.files),
            dependencies: result.dependencies,
          };
        } catch (repairErr) {
          console.warn(
            `[SyntaxRepair] Repair attempt ${attempt} failed:`,
            repairErr instanceof Error ? repairErr.message : repairErr,
          );
          return { files, dependencies };
        }
      });
      files = repaired.files;
      dependencies = repaired.dependencies;
    }
    {
      const remainingSyntax = collectSyntaxIssues(files);
      if (remainingSyntax.length > 0) {
        const first = remainingSyntax[0];
        throw new Error(
          `Syntax repair failed. First issue: ${first.path}:${first.line}:${first.column} ${first.message}`,
        );
      }
    }

    // UX repair — each attempt gets its own step
    for (let attempt = 1; attempt <= MAX_UX_REPAIR_ATTEMPTS; attempt++) {
      const uxIssues = collectResponsiveAndNavIssues(files);
      if (uxIssues.length === 0) break;

      const repaired = await step.run(`ux-repair-${attempt}`, async () => {
        console.warn(
          `[UXRepair] Attempt ${attempt} - ${uxIssues.length} responsive/navigation issue(s).`,
        );
        try {
          const result = await repairProjectFromLintFeedback({
            originalPrompt: prompt,
            files,
            dependencies,
            lintIssues: uxIssues,
            requirements: integrationRequirements,
            managedAuthConfig,
            systemPrompt: repairSystemPrompt,
          });
          return {
            files: applyKnownImportSpecifierFixups(result.files),
            dependencies: result.dependencies,
          };
        } catch (repairErr) {
          console.warn(
            `[UXRepair] Repair attempt ${attempt} failed:`,
            repairErr instanceof Error ? repairErr.message : repairErr,
          );
          return { files, dependencies };
        }
      });
      files = repaired.files;
      dependencies = repaired.dependencies;
    }
    {
      const remainingUx = collectResponsiveAndNavIssues(files);
      if (remainingUx.length > 0) {
        const first = remainingUx[0];
        console.warn(
          `[UXRepair] Max attempts reached. Continuing with unresolved UX issues: ${first.path}:${first.line}:${first.column} ${first.message}`,
        );
      }
    }

    // Schema repair — each attempt gets its own step
    for (let attempt = 1; attempt <= MAX_SCHEMA_REPAIR_ATTEMPTS; attempt++) {
      const schemaIssues = collectSupabaseSchemaIssues(
        files,
        integrationRequirements,
      );
      if (schemaIssues.length === 0) break;

      const repaired = await step.run(`schema-repair-${attempt}`, async () => {
        console.warn(
          `[SchemaRepair] Attempt ${attempt} - ${schemaIssues.length} schema issue(s).`,
        );
        try {
          const result = await repairProjectFromLintFeedback({
            originalPrompt: prompt,
            files,
            dependencies,
            lintIssues: schemaIssues,
            requirements: integrationRequirements,
            managedAuthConfig,
            systemPrompt: repairSystemPrompt,
          });
          return {
            files: applyKnownImportSpecifierFixups(result.files),
            dependencies: result.dependencies,
          };
        } catch (repairErr) {
          console.warn(
            `[SchemaRepair] Repair attempt ${attempt} failed:`,
            repairErr instanceof Error ? repairErr.message : repairErr,
          );
          return { files, dependencies };
        }
      });
      files = repaired.files;
      dependencies = repaired.dependencies;
    }
    {
      const remainingSchema = collectSupabaseSchemaIssues(
        files,
        integrationRequirements,
      );
      if (remainingSchema.length > 0) {
        const first = remainingSchema[0];
        throw new Error(
          `Schema repair failed. First issue: ${first.path}:${first.line}:${first.column} ${first.message}`,
        );
      }
    }

    validateSyntaxOrThrow(files);

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
        projectId,
      );
    }

    // Step 4: Lint and fix code (parallel linting for all files)
    // Step 4a: Initial lint check (its own step for 60s budget)
    let lintState = await step.run("lint-check", async () => {
      await sendProgress(projectId, "[4/9] Running code quality checks...");
      console.log(`Starting linting for ${files.length} files...`);
      const lintResult = await lintAllFiles(files);
      const schemaIssues = collectSupabaseSchemaIssues(
        files,
        integrationRequirements,
      );
      return {
        files,
        dependencies,
        lintReport: lintResult.lintReport,
        lintIssues: lintResult.lintIssues,
        schemaIssues,
        hasErrors:
          lintResult.lintReport.errors > 0 ||
          schemaIssues.length > 0,
      };
    });

    // Step 4b: Repair attempts — each gets its own step
    for (
      let attempt = 1;
      lintState.hasErrors && attempt <= MAX_LINT_REPAIR_ATTEMPTS;
      attempt++
    ) {
      lintState = await step.run(`lint-repair-${attempt}`, async () => {
        if (await checkIfCancelled(projectId)) {
          throw new Error("Generation cancelled by user");
        }

        const issuesToFix =
          lintState.lintIssues.length > 0
            ? [
              ...lintState.lintIssues,
              ...lintState.schemaIssues,
            ]
            : [...lintState.schemaIssues];
        const firstIssue = issuesToFix[0];
        console.warn(
          `[LintRepair] Attempt ${attempt} - ${lintState.lintReport.errors} lint errors, ${lintState.schemaIssues.length} schema issue(s). First issue: ${firstIssue?.path}:${firstIssue?.line}:${firstIssue?.column} ${firstIssue?.message}`,
        );

        let workingFiles = lintState.files;
        let workingDeps = lintState.dependencies;

        try {
          const repaired = await repairProjectFromLintFeedback({
            originalPrompt: prompt,
            files: workingFiles,
            dependencies: workingDeps,
            lintIssues: issuesToFix,
            requirements: integrationRequirements,
            managedAuthConfig,
            systemPrompt: repairSystemPrompt,
          });
          workingFiles = applyKnownImportSpecifierFixups(repaired.files);
          workingDeps = repaired.dependencies;
        } catch (repairErr) {
          console.warn(
            `[LintRepair] Repair attempt ${attempt} failed:`,
            repairErr instanceof Error ? repairErr.message : repairErr,
          );
        }

        const lintResult = await lintAllFiles(workingFiles);
        const schemaIssues = collectSupabaseSchemaIssues(
          workingFiles,
          integrationRequirements,
        );

        return {
          files: workingFiles,
          dependencies: workingDeps,
          lintReport: lintResult.lintReport,
          lintIssues: lintResult.lintIssues,
          schemaIssues,
          hasErrors:
            lintResult.lintReport.errors > 0 ||
            schemaIssues.length > 0,
        };
      });
    }

    if (lintState.hasErrors) {
      const firstIssue = [
        ...(lintState.lintIssues || []),
        ...lintState.schemaIssues,
      ][0];
      throw new Error(
        `Lint failed after repair attempts. First issue: ${firstIssue?.path}:${firstIssue?.line}:${firstIssue?.column} ${firstIssue?.message}`,
      );
    }

    files = lintState.files;
    dependencies = lintState.dependencies;
    const fixedFiles = lintState.files;

    // Step 5a: Initial Next.js validation (its own step)
    let nextjsState = await step.run("nextjs-check", async () => {
      await sendProgress(projectId, "[5/9] Validating Next.js compatibility...");
      // Apply known-good templates before validation so AI-broken
      // infra files (e.g. auth/callback/route.ts) are overwritten first.
      let workingFiles = ensureRequiredFiles(
        fixedFiles,
        dependencies,
        integrationRequirements,
        managedAuthConfig,
        projectId,
      );
      let issues = collectNextJsValidationIssues(workingFiles, dependencies);
      if (issues.some((issue) => issue.rule === "undefined-reference")) {
        workingFiles = applyDeterministicUndefinedReferenceImportFixes(
          workingFiles,
          issues,
        );
        issues = collectNextJsValidationIssues(workingFiles, dependencies);
      }
      return {
        files: workingFiles,
        dependencies,
        issues,
        hasIssues: issues.length > 0,
      };
    });

    // Step 5b: Next.js repair attempts — each gets its own step
    for (
      let attempt = 1;
      nextjsState.hasIssues && attempt <= MAX_NEXTJS_REPAIR_ATTEMPTS;
      attempt++
    ) {
      nextjsState = await step.run(`nextjs-repair-${attempt}`, async () => {
        const firstIssue = nextjsState.issues[0];
        console.warn(
          `[NextValidation] Attempt ${attempt} - ${nextjsState.issues.length} issue(s). First issue: ${firstIssue?.path}:${firstIssue?.line}:${firstIssue?.column} ${firstIssue?.message}`,
        );

        let workingFiles = nextjsState.files;
        let workingDeps = nextjsState.dependencies;

        try {
          const repaired = await repairProjectFromLintFeedback({
            originalPrompt: prompt,
            files: workingFiles,
            dependencies: workingDeps,
            lintIssues: nextjsState.issues,
            requirements: integrationRequirements,
            managedAuthConfig,
            systemPrompt: repairSystemPrompt,
          });
          workingFiles = applyKnownImportSpecifierFixups(repaired.files);
          workingDeps = repaired.dependencies;
        } catch (repairErr) {
          console.warn(
            `[NextValidation] Repair attempt ${attempt} failed:`,
            repairErr instanceof Error ? repairErr.message : repairErr,
          );
        }

        let issues = collectNextJsValidationIssues(
          workingFiles,
          workingDeps,
        );
        if (issues.some((issue) => issue.rule === "undefined-reference")) {
          workingFiles = applyDeterministicUndefinedReferenceImportFixes(
            workingFiles,
            issues,
          );
          issues = collectNextJsValidationIssues(workingFiles, workingDeps);
        }
        return {
          files: workingFiles,
          dependencies: workingDeps,
          issues,
          hasIssues: issues.length > 0,
        };
      });
    }

    if (nextjsState.hasIssues) {
      const firstIssue = nextjsState.issues[0];
      throw new Error(
        `Next.js validation failed after repair attempts. First issue: ${firstIssue.path}:${firstIssue.line}:${firstIssue.column} ${firstIssue.message}`,
      );
    }

    const validatedFiles = nextjsState.files;
    dependencies = nextjsState.dependencies;

    // Step 5.5: TypeScript type-checking in E2B sandbox (backend-enabled apps only)
    const hasBackend = integrationRequirements.requiresAuth || integrationRequirements.requiresDatabase;
    const typecheckEnabled = hasBackend && !!process.env.E2B_API_KEY;
    let typecheckedFiles = validatedFiles;
    let previewSandboxId: string | null = null;

    if (!hasBackend) {
      console.log("[E2B Typecheck] Skipped — not a backend-enabled app.");
    } else if (!process.env.E2B_API_KEY) {
      console.log("[E2B Typecheck] Skipped — E2B_API_KEY not configured.");
    }

    if (typecheckEnabled) {
      const typecheckResult = await step.run(
        "typecheck-and-repair",
        async () => {
          await sendProgress(projectId, "[6/9] Running TypeScript type checks...");
          const { Sandbox } = await import("e2b");
          let sandbox: InstanceType<typeof Sandbox> | null = null;

          try {
            // 1. Create sandbox
            console.log("[E2B Typecheck] Creating E2B sandbox...");
            const sandboxStart = Date.now();
            sandbox = await Sandbox.create("code-interpreter-v1", { timeoutMs: 30 * 60 * 1000 });
            console.log(`[E2B Typecheck] Sandbox created in ${Date.now() - sandboxStart}ms (id: ${sandbox.sandboxId})`);

            // 2. Build package.json + tsconfig.json
            const packageJson = buildPackageJsonForTypecheck(
              dependencies,
              validatedFiles,
            );
            const tsconfigJson = buildTsconfigForTypecheck();

            // 3. Write all files to sandbox
            console.log(`[E2B Typecheck] Writing ${validatedFiles.length} files to sandbox...`);
            await sandbox.files.write(
              "/home/user/project/package.json",
              packageJson,
            );
            await sandbox.files.write(
              "/home/user/project/tsconfig.json",
              tsconfigJson,
            );
            for (const file of validatedFiles) {
              await sandbox.files.write(
                `/home/user/project/${file.path}`,
                file.content,
              );
            }
            console.log("[E2B Typecheck] Files written successfully.");

            // 4. npm install (installs all type definitions)
            // Use shell "|| true" to prevent non-zero exit codes from throwing
            console.log("[E2B Typecheck] Running npm install...");
            const installStart = Date.now();
            const installResult = await sandbox.commands.run(
              "cd /home/user/project && npm install --ignore-scripts --no-optional --no-audit --no-fund --legacy-peer-deps 2>&1; echo \"EXIT_CODE:$?\"",
              { timeoutMs: 120_000 },
            );
            const installOutput = installResult.stdout + "\n" + installResult.stderr;
            const installFailed = installOutput.includes("ERR!") || installOutput.includes("npm error");
            if (installFailed) {
              console.error(
                `[E2B Typecheck] npm install FAILED (${Date.now() - installStart}ms)`,
              );
              console.error("[E2B Typecheck] output:", installOutput.slice(-500));
              // Kill sandbox on npm failure since we won't reuse it
              if (sandbox) {
                try { await sandbox.kill(); } catch { /* ignore */ }
              }
              return { files: validatedFiles, sandboxId: null };
            }
            console.log(`[E2B Typecheck] npm install completed in ${Date.now() - installStart}ms.`);

            // 5. Repair loop: tsc → parse errors → repair → rewrite → tsc
            let workingFiles = validatedFiles;
            let workingDeps = dependencies;

            for (
              let attempt = 1;
              attempt <= MAX_TYPECHECK_REPAIR_ATTEMPTS + 1;
              attempt++
            ) {
              console.log(`[E2B Typecheck] Running tsc --noEmit (attempt ${attempt})...`);
              const tscStart = Date.now();
              // tsc exits with code 1 when there are type errors — use "|| true" to prevent throw
              const tscResult = await sandbox.commands.run(
                "cd /home/user/project && npx tsc --noEmit --pretty false 2>&1 || true",
                { timeoutMs: 60_000 },
              );
              console.log(`[E2B Typecheck] tsc completed in ${Date.now() - tscStart}ms.`);

              const issues = parseTscOutput(
                tscResult.stdout + "\n" + tscResult.stderr,
              );

              if (issues.length === 0) {
                console.log("[E2B Typecheck] No type errors found. All clear!");
                break;
              }

              if (attempt > MAX_TYPECHECK_REPAIR_ATTEMPTS) {
                console.warn(
                  `[E2B Typecheck] ${issues.length} issue(s) remain after ${MAX_TYPECHECK_REPAIR_ATTEMPTS} repair attempts. Giving up.`,
                );
                issues.slice(0, 5).forEach((issue, i) => {
                  console.warn(`  [${i + 1}] ${issue.path}:${issue.line} ${issue.message}`);
                });
                break;
              }

              console.warn(
                `[E2B Typecheck] Found ${issues.length} type error(s). Sending to Gemini for repair...`,
              );
              issues.slice(0, 5).forEach((issue, i) => {
                console.warn(`  [${i + 1}] ${issue.path}:${issue.line} ${issue.message}`);
              });

              // Call Gemini to repair — catch errors so the loop can retry
              const repairStart = Date.now();
              try {
                const repaired = await repairProjectFromLintFeedback({
                  originalPrompt: prompt,
                  files: workingFiles,
                  dependencies: workingDeps,
                  lintIssues: issues,
                  requirements: integrationRequirements,
                  managedAuthConfig,
                  systemPrompt: repairSystemPrompt,
                });
                console.log(`[E2B Typecheck] Gemini repair completed in ${Date.now() - repairStart}ms.`);

                workingFiles = applyKnownImportSpecifierFixups(repaired.files);
                workingDeps = repaired.dependencies;

                // Rewrite only changed files to sandbox
                for (const file of workingFiles) {
                  await sandbox.files.write(
                    `/home/user/project/${file.path}`,
                    file.content,
                  );
                }
                console.log("[E2B Typecheck] Updated files written to sandbox.");
              } catch (repairErr) {
                console.warn(
                  `[E2B Typecheck] Gemini repair attempt ${attempt} failed (${Date.now() - repairStart}ms):`,
                  repairErr instanceof Error ? repairErr.message : repairErr,
                );
                // Continue loop — next tsc run will use the unchanged workingFiles
              }
            }

            dependencies = workingDeps;

            // Keep sandbox alive for preview reuse instead of killing it
            if (sandbox) {
              try {
                await sandbox.setTimeout(30 * 60 * 1000); // 30 min for preview
                console.log(`[E2B Typecheck] Sandbox kept alive for preview (id: ${sandbox.sandboxId})`);
              } catch {
                console.warn("[E2B Typecheck] Failed to extend sandbox timeout.");
              }
            }

            return {
              files: workingFiles,
              sandboxId: sandbox?.sandboxId ?? null,
            };
          } catch (err) {
            console.error("[E2B Typecheck] FAILED with error:", err instanceof Error ? err.message : err);
            console.error("[E2B Typecheck] Skipping typecheck — generation will continue without it.");
            // Kill sandbox on error since we won't reuse it
            if (sandbox) {
              try {
                await sandbox.kill();
                console.log("[E2B Typecheck] Sandbox killed after error.");
              } catch {
                // ignore
              }
            }
            return { files: validatedFiles, sandboxId: null };
          }
        },
      );
      typecheckedFiles = typecheckResult.files;
      previewSandboxId = typecheckResult.sandboxId;
    }

    const { finalFiles, finalLint } = await step.run(
      "post-scaffold-validation",
      async () => {
        const scaffoldedFiles = ensureRequiredFiles(
          typecheckedFiles,
          dependencies,
          integrationRequirements,
          managedAuthConfig,
          projectId,
        );
        validateSyntaxOrThrow(scaffoldedFiles);

        const lint = await lintAllFiles(scaffoldedFiles);
        if (lint.lintReport.errors > 0) {
          const firstIssue = lint.lintIssues[0];
          throw new Error(
            `Post-scaffold lint failed. First issue: ${firstIssue?.path}:${firstIssue?.line}:${firstIssue?.column} ${firstIssue?.message}`,
          );
        }

        const schemaIssues = collectSupabaseSchemaIssues(
          scaffoldedFiles,
          integrationRequirements,
        );
        if (schemaIssues.length > 0) {
          const firstIssue = schemaIssues[0];
          throw new Error(
            `Schema validation failed. First issue: ${firstIssue.path}:${firstIssue.line}:${firstIssue.column} ${firstIssue.message}`,
          );
        }

        return { finalFiles: scaffoldedFiles, finalLint: lint };
      },
    );

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

      await step.run("bootstrap-managed-supabase-schema", async () => {
        await sendProgress(projectId, "[7/9] Setting up database...");

        // Auto-reconcile schema with code before bootstrap.
        // Deterministically patches missing tables, columns, RLS policies.
        schemaFile.content = reconcileSchemaWithCode(schemaFile.content, finalFiles);
        const reconciledIdx = finalFiles.findIndex(
          (f) => f.path.replace(/\\/g, "/").toLowerCase() === "supabase/schema.sql",
        );
        if (reconciledIdx !== -1) {
          finalFiles[reconciledIdx] = { ...finalFiles[reconciledIdx], content: schemaFile.content };
        }

        for (
          let attempt = 1;
          attempt <= MAX_SCHEMA_BOOTSTRAP_REPAIR_ATTEMPTS + 1;
          attempt++
        ) {
          try {
            const tablePhaseSql = buildTableCreationPhaseSql(schemaFile.content);
            await applySqlToManagedProject(
              managedAuthConfig.projectRef,
              tablePhaseSql,
            );
            const sql = buildSchemaBootstrapSql(schemaFile.content);
            await applySqlToManagedProject(managedAuthConfig.projectRef, sql);
            return { projectRef: managedAuthConfig.projectRef, applied: true, mode: "full" };
          } catch (err) {
            const errorMsg =
              err instanceof Error ? err.message : String(err);
            console.warn(
              `[schema-bootstrap] Attempt ${attempt} failed: ${errorMsg}`,
            );

            if (attempt > MAX_SCHEMA_BOOTSTRAP_REPAIR_ATTEMPTS) {
              throw err;
            }

            // Schema bootstrap repair — no user-facing message.

            const fixedSql = await repairSchemaFromBootstrapError({
              schemaSql: schemaFile.content,
              sqlError: errorMsg,
            });

            // Update the schema file in-place so subsequent attempts and
            // downstream steps use the corrected SQL.
            schemaFile.content = fixedSql;
            const idx = finalFiles.findIndex(
              (f) =>
                f.path.replace(/\\/g, "/").toLowerCase() ===
                "supabase/schema.sql",
            );
            if (idx !== -1) {
              finalFiles[idx] = { ...finalFiles[idx], content: fixedSql };
            }
          }
        }

        // Unreachable — loop always returns or throws — but satisfies TS.
        throw new Error("Schema bootstrap repair loop exited unexpectedly.");
      });
    }

    // Step 8: Generate images via Inngest sub-function (global concurrency)
    await sendProgress(projectId, "[8/9] Generating images...");
    let filesWithImages = finalFiles;
    try {
      const imageResult = await step.invoke("generate-images", {
        function: generateImagesFunction,
        data: {
          files: finalFiles,
          userId: userId || "anonymous",
          projectId,
          originalPrompt: prompt,
          detectedTheme,
          preserveExistingImages: preserveExistingImages ?? false,
          previousImageUrls: previousImageUrls ?? [],
        },
        timeout: "10m",
      }) as {
        replacements: Record<string, string>;
        files: Array<{ path: string; content: string }>;
      };

      // Use image-processed files if available
      filesWithImages =
        imageResult.files?.length > 0
          ? (imageResult.files as typeof finalFiles)
          : finalFiles;
    } catch (imageErr) {
      const message =
        imageErr instanceof Error ? imageErr.message : String(imageErr);
      console.error("[Inngest] Image generation invoke failed:", message);
      await sendProgress(
        projectId,
        "[8/9] Image generation unavailable, continuing with placeholder visuals...",
      );
    }

    // Step 9: Notify completion via API
    await step.run("notify-completion", async () => {
      await sendProgress(projectId, "[9/9] Finalizing your app...");
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
            files: filesWithImages,
            dependencies,
            lintReport: finalLint.lintReport,
            model: "gemini",
            originalPrompt: prompt,
            detectedTheme: detectedTheme,
            sandboxId: previewSandboxId,
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

    await sendProgress(projectId, "Ready to preview!");

    return {
      files: filesWithImages,
      dependencies,
      lintReport: finalLint.lintReport,
      model: "gemini",
      originalPrompt: prompt,
      detectedTheme: detectedTheme,
      projectType: detectedProjectType,
      sandboxId: previewSandboxId,
    };

    } catch (err) {
      // Send failure directly to the status API so the client sees it immediately
      await sendFailure(
        projectId,
        err instanceof Error ? err.message : String(err),
      );
      throw err; // Re-throw so Inngest marks the run as failed
    }
  },
);
