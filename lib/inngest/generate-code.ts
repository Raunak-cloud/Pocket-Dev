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
import ts from "typescript";

const MODEL = "gemini-3-flash-preview";
const MAX_TOKENS = 32768;
const MAX_LINT_REPAIR_ATTEMPTS = 2;
const MAX_SYNTAX_REPAIR_ATTEMPTS = 2;
const MAX_JSON_REPAIR_ATTEMPTS = 2;
const MAX_STRUCTURE_REPAIR_ATTEMPTS = 2;
const MAX_UX_REPAIR_ATTEMPTS = 3;
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

const SYSTEM_PROMPT = `You are a principal Next.js App Router engineer and product UI designer.

PLATFORM CONTRACT (strict):
- Output valid JSON only. No markdown.
- JSON shape:
{
  "files": [{ "path": "app/page.tsx", "content": "..." }],
  "dependencies": { "pkg": "version" },
  "_checks": {
    "postcss_shape_valid": true,
    "tailwind_directives_present": true,
    "provider_wraps_children": true,
    "no_apply_variant_utilities": true
  },
  "_design": {
    "visual_direction": "string",
    "typography_plan": "string"
  }
}
- Keep code compatible with Next.js App Router + TypeScript + Tailwind utility classes.
- Never return lockfiles.
- Never use Unsplash, Pollinations, Picsum, or other stock-image URLs.
- For AI-generated images, use placeholders like REPLICATE_IMG_1, REPLICATE_IMG_2, ... and include DETAILED, SPECIFIC alt text for each image.
- Each image placeholder must have UNIQUE visual intent - never reuse descriptions or generic terms.
- Alt text must be detailed and photographic: describe composition, subject, angle, lighting, mood, and specific visual elements.
- GOOD alt text examples: "Close-up overhead shot of a rustic wood-fired margherita pizza with fresh basil and buffalo mozzarella on a dark slate plate", "Professional headshot of a smiling female doctor in white coat standing in modern clinic, natural window light"
- BAD alt text examples: "image", "photo", "product photo", "professional picture", "website hero image"
- For food/restaurant sites: describe the specific dish, plating style, ingredients visible, serving presentation
- For people: describe profession, setting, expression, clothing, lighting, and context
- For products: describe the product type, angle, background, lighting, and key features visible
- For spaces: describe the room type, style, lighting, furniture, and architectural details
- Required core files: app/layout.tsx, app/page.tsx, app/loading.tsx, app/globals.css.
- If app/globals.css has @layer base/components/utilities, include matching:
  @tailwind base; @tailwind components; @tailwind utilities;
- Do not use @apply in generated CSS. Use explicit utility classes directly in markup.
- If a hook guard says "must be used within XProvider", ensure XProvider wraps {children} in app/layout.tsx.
- AUTHENTICATION IMPLEMENTATION:
  * CRITICAL: NEVER generate login, sign up, sign in, get started, or authentication-related buttons/links/CTAs UNLESS the user explicitly requests authentication features
  * NEVER add "Login", "Sign In", "Sign Up", "Get Started", "Create Account", "Register", or similar CTAs by default
  * Authentication CTAs should ONLY appear when the user's request explicitly mentions: "login", "user accounts", "sign in", "authentication", "user management", "dashboard", "user profiles", or similar auth-related functionality
  * If the user does NOT mention authentication, build a fully functional public website WITHOUT any auth CTAs
  * Only implement auth if the user explicitly requests it (login, user accounts, dashboards, etc.)
  * Use Supabase Auth (@supabase/supabase-js + @supabase/ssr) for authentication
  * CRITICAL: Use ONLY anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY), never service role key
  * MULTI-TENANT ISOLATION: All apps share Supabase with tenant isolation
  * After auth.signUp(), insert into user_tenants(user_id, tenant_slug) with NEXT_PUBLIC_POCKET_APP_SLUG
  * MIDDLEWARE: Verify both authentication AND tenant membership
  * All user data tables MUST include tenant_slug column with NOT NULL constraint
  * Enable Row Level Security (RLS) on all user data tables
  * RLS policies must check: current_tenant_slug() = tenant_slug AND user_belongs_to_tenant()
  * Set session context: SET LOCAL app.current_tenant = NEXT_PUBLIC_POCKET_APP_SLUG
  * If user authenticated but not in tenant → redirect to /unauthorized
  * Create lib/supabase/client.ts for browser client, lib/supabase/server.ts for server client
  * Use createServerClient with cookie handlers in middleware.ts for route protection
  * Implement OAuth sign-in (Google/GitHub) in a sign-in component
  * Store user sessions in httpOnly cookies (handled automatically by @supabase/ssr)
  * Example middleware pattern: getUser() → check tenant membership → redirect to /sign-in or /unauthorized if invalid
- Do not output malformed PostCSS config shapes.
- Navigation must work on desktop and mobile (include hamburger toggle with open/close behavior on small screens).
- Avoid horizontal overflow on mobile.
- Keep header/navbar pinned to the top on scroll (sticky/fixed + top-0) and above content (high z-index).
- Mobile menu/drawer must open from the top layer and should not create independent scrollbar UI on nav/header wrappers.
- Mobile menu panel must render above all page sections (overlay z-index above content), with a solid/semi-opaque background so links remain clearly visible.
- Mobile menu panel must occupy full device height on phones (h-screen/min-h-screen/100dvh/inset-y-0), not a short strip.

DESIGN GOALS:
- Premium, modern look with a clear art direction (not generic template UI).
- Strong typography scale, spacing rhythm, and component consistency.
- Intentional gradients/backgrounds and subtle motion where it improves UX.
- Mobile-first responsive layout.
- Accessible contrast and semantic structure.
- Cohesive visual system with reusable components.

OUTPUT RULES:
- Return complete project files needed to run.
- Escape newlines with \\n and tabs with \\t inside JSON string content.
- Prefer stable, maintainable code over novelty.
- Ensure every file parses without TypeScript/JavaScript syntax errors.`;

type SiteTheme = "food" | "fashion" | "interior" | "automotive" | "people" | "generic";

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not found");
  }
  return new GoogleGenerativeAI(apiKey);
}

function isValidSiteTheme(value: string): value is SiteTheme {
  return ["food", "fashion", "interior", "automotive", "people", "generic"].includes(value);
}

async function detectThemeWithGemini(userPrompt: string): Promise<SiteTheme> {
  const systemPrompt = `You are a website theme classifier. Analyze the user's website request and determine its PRIMARY visual theme.

THEMES:
- food: Restaurants, cafes, recipes, culinary, food delivery, catering
- fashion: Clothing, apparel, boutiques, jewelry, fashion brands
- interior: Furniture, home decor, architecture, interior design
- automotive: Cars, dealerships, auto services, vehicle sales
- people: Fitness, health, wellness, professional services, personal trainers, consultants
- generic: Tech, blogs, SaaS, e-commerce, business sites, anything else

Return ONLY one word (the theme name). No explanation.`;

  const gemini = getGeminiClient();
  const model = gemini.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      maxOutputTokens: 10,
      temperature: 0.1,
    },
  });

  const result = await model.generateContent({
    contents: [{
      role: "user",
      parts: [{ text: `${systemPrompt}\n\nUser request: "${userPrompt}"\n\nTheme:` }]
    }],
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
    console.warn('[Theme] AI detection failed, will use code analysis fallback:', error);
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
      throw new Error(`AI response contains too many files (>${MAX_FILE_COUNT}).`);
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
  const required = new Set(["app/layout.tsx", "app/page.tsx", "app/loading.tsx", "app/globals.css"]);
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
      if (ch === "\"") inString = true;
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

    if (ch === "\"") {
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
        if (next === "\"") {
          out += "\"";
          i++;
          inString = true;
          continue;
        }
      }

      out += ch;
      if (ch === "\"") {
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

    if (ch === "\"") {
      out += ch;
      inString = false;
      continue;
    }

    out += ch;
  }

  return out;
}

function tryParsePossiblyDoubleEncodedJSON(input: string): ParsedAIResponse | null {
  const trimmed = input.trim();
  if (!(trimmed.startsWith("\"") && trimmed.endsWith("\""))) {
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
  console.error("Last 500 chars:", input.slice(Math.max(0, input.length - 500)));
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
  const repairPrompt = `You are a JSON repair utility.

TASK:
- Convert the following malformed output into STRICT valid JSON.
- Preserve intended data and structure as much as possible.
- Output JSON only. No markdown. No commentary.
- Required top-level shape:
{
  "files": [{ "path": "string", "content": "string" }],
  "dependencies": { "pkg": "version" },
  "_checks": { "key": true }
}

MALFORMED INPUT:
${rawText}`;

  return generateWithGemini(
    "Return strict JSON only. Do not include markdown fences.",
    repairPrompt,
  );
}

async function repairProjectShapeWithGemini(args: {
  originalPrompt: string;
  parseError: string;
  parsedResponse: ParsedAIResponse;
}): Promise<string> {
  const { originalPrompt, parseError, parsedResponse } = args;

  const repairPrompt = `You returned JSON that does not match the required project shape.

Original request:
${originalPrompt}

Validation error:
${parseError}

Current response JSON:
${JSON.stringify(parsedResponse)}

Fix requirements:
- Return strict JSON only (no markdown).
- Shape must be:
{
  "files": [{ "path": "app/page.tsx", "content": "..." }],
  "dependencies": { "pkg": "version" },
  "_checks": { "key": true },
  "_design": { "visual_direction": "...", "typography_plan": "..." }
}
- files must be non-empty and use safe relative paths (no absolute paths, no .. segments).
- Include app/layout.tsx, app/page.tsx, and app/globals.css.
- Do not include lockfiles.
- Ensure all file contents are valid code/text strings.`;

  return generateWithGemini(
    "Return strict JSON only. No markdown.",
    repairPrompt,
  );
}

async function repairProjectFromLintFeedback(args: {
  originalPrompt: string;
  files: GeneratedFile[];
  dependencies: Record<string, string>;
  lintIssues: LintIssue[];
}) {
  const { originalPrompt, files, dependencies, lintIssues } = args;
  const hasNavigationUxIssue = lintIssues.some((issue) =>
    /^ux\/(?:mobile-navbar|navigation-required|navbar-stacking|navbar-nested-scroll|mobile-menu-overlay|mobile-menu-visibility|mobile-menu-height|responsive-breakpoints|mobile-overflow-guard)$/.test(
      issue.rule ?? "",
    ),
  );
  const issueList = lintIssues
    .slice(0, 40)
    .map(
      (i) =>
        `- ${i.path}:${i.line}:${i.column} [${i.rule ?? "parse"}] ${i.message}`,
    )
    .join("\n");

  const filePayload = files.map((f) => ({ path: f.path, content: f.content }));

  const repairPrompt = `You produced a project that failed lint/parse checks.

Original request:
${originalPrompt}

Fix these exact issues:
${issueList}

Current project files (JSON):
${JSON.stringify(filePayload)}

Current dependencies:
${JSON.stringify(dependencies)}

Requirements:
- Fix only what is needed to resolve the reported errors.
- Keep app behavior/design unchanged unless required by the fix.
- Return COMPLETE valid JSON in the required shape with full files + dependencies.
- Do not include markdown or explanations.
${
  hasNavigationUxIssue
    ? `- Navigation quality constraints:
  - Header/navbar must stay visible and pinned at top on mobile (sticky/fixed + top-0 + high z-index).
  - Mobile menu must open/close cleanly, anchored from the top layer.
  - Mobile menu panel must be above page content (not behind hero/cards), using fixed/absolute overlay positioning with strong z-index.
  - Mobile menu panel must use readable contrast and non-transparent background.
  - Mobile menu panel must span full mobile viewport height (h-screen/min-h-screen/100dvh or inset-y-0).
  - Do not create separate scrollbar UI on nav/header/menu wrappers.
  - Prevent horizontal overflow on small screens.`
    : ""
}`;

  const text = await generateWithGemini(SYSTEM_PROMPT, repairPrompt);
  const { dependencies: repairedDependencies, files: parsedFiles } =
    parseAndNormalizeProjectFromTextOrThrow(text);
  let repairedFiles = parsedFiles;
  repairedFiles = ensureRequiredFiles(repairedFiles, repairedDependencies);
  validateProjectStructureOrThrow(repairedFiles);
  validateSyntaxOrThrow(repairedFiles);

  return { files: repairedFiles, dependencies: repairedDependencies };
}

function ensureRequiredFiles(
  files: GeneratedFile[],
  dependencies: Record<string, string>,
): GeneratedFile[] {
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
    return ensureMobileOverflowGuard(stripUnsupportedApplyUtilities(normalized));
  }

  const fileMap = new Map(files.map((f) => [f.path, f]));

  if (!fileMap.has("package.json")) {
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

  // Ensure tenant helper exists for multi-tenant apps with auth
  if (!fileMap.has("lib/supabase/tenant.ts")) {
    files.push({
      path: "lib/supabase/tenant.ts",
      content: `import { createClient } from "./server";

/**
 * Get the current tenant slug from environment
 * Each generated app has a unique tenant slug for data isolation
 */
export function getTenantSlug(): string {
  const tenant = process.env.NEXT_PUBLIC_POCKET_APP_SLUG;
  if (!tenant) {
    throw new Error("NEXT_PUBLIC_POCKET_APP_SLUG is not set");
  }
  return tenant;
}

/**
 * Get the current authenticated user and verify tenant membership
 * Returns null if user is not authenticated or not a member of this tenant
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const tenant = getTenantSlug();

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  // Verify tenant membership
  const { data: membership } = await supabase
    .from("user_tenants")
    .select("id")
    .eq("user_id", user.id)
    .eq("tenant_slug", tenant)
    .single();

  if (!membership) return null;

  return user;
}

/**
 * Check if current user is a member of this tenant
 */
export async function isUserTenantMember(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}`,
    });
  }

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

    const parseDiagnostics = (sf as unknown as { parseDiagnostics?: ts.Diagnostic[] })
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
        /className\s*=\s*["'`][^"'`]*(?:mobile-menu|menu|drawer)[^"'`]*(?:overflow-y-(?:auto|scroll)|overflow-(?:auto|scroll))[^"'`]*["'`]/i.test(
          f.content,
        ) ||
        /className\s*=\s*["'`][^"'`]*(?:overflow-y-(?:auto|scroll)|overflow-(?:auto|scroll))[^"'`]*(?:mobile-menu|menu|drawer)[^"'`]*["'`]/i.test(
          f.content,
        ),
    );
    const hasScrollableNavContainer = navFiles.some(
      (f) =>
        /<(?:nav|header)[^>]*className\s*=\s*["'`][^"'`]*(?:overflow-y-(?:auto|scroll)|overflow-(?:auto|scroll))[^"'`]*["'`]/i.test(
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
      const hasToggle = /\b(?:aria-expanded|isMenuOpen|menuOpen|mobileMenuOpen|openMenu|toggleMenu)\b/.test(
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
        /<(?:SheetContent|DrawerContent|DialogContent|Modal)\b/.test(f.content) ||
        /@radix-ui\/react-(?:dialog|popover|portal)/.test(f.content);

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
  },
  { event: "app/generate.code" },
  async ({ event, step }) => {
    const { prompt, projectId } = event.data;

    // Check if cancelled before starting
    if (await checkIfCancelled(projectId)) {
      console.log(`[Inngest] Generation cancelled before start: ${projectId}`);
      throw new Error("Generation cancelled by user");
    }

    // Step 1: Build user prompt
    await sendProgress(
      projectId,
      "[1/7] Analyzing requirements and planning project structure...",
    );
    const userPrompt = await step.run("build-prompt", async () => {
      return `Build a production-ready, visually premium Next.js website for this request:
${prompt}

STRICT IMPLEMENTATION RULES:
- Keep output compatible with Next.js App Router + TypeScript.
- Use Tailwind utility classes for styling.
- Return a complete, runnable project with app/layout.tsx, app/page.tsx, app/loading.tsx, and app/globals.css.
- In app/globals.css, if any @layer base/components/utilities is present, include matching @tailwind directives.
- Do not use @apply in generated CSS; always use explicit utility classes directly in markup.
- If code contains a guard like "must be used within XProvider", ensure app/layout.tsx wraps {children} with XProvider.
- AUTHENTICATION RULES:
  * CRITICAL: NEVER generate "Login", "Sign In", "Sign Up", "Get Started", "Register", or similar authentication CTAs UNLESS the user explicitly requests authentication
  * Do NOT add authentication buttons, forms, or CTAs by default - only add them when the user specifically mentions: "login", "authentication", "user accounts", "sign in", "user management", "dashboard", "user profiles"
  * If the user does NOT mention authentication, create a fully functional public website WITHOUT any auth-related UI elements
  * Only add auth if the user's request implies user accounts (e.g., "dashboard", "user profile", "login")
  * If auth is needed, use Supabase Auth (@supabase/supabase-js v2 + @supabase/ssr)
  * Create proper client/server separation with cookie-based sessions
  * Protect routes with middleware checking supabase.auth.getUser()
  * Use Row Level Security (RLS) policies if database tables are involved
- Preserve accessibility, semantic HTML, and responsive behavior.
- Do not output lockfiles or unsafe file paths.
- All returned code must parse without TypeScript/JavaScript syntax errors.
- CRITICAL IMAGE REQUIREMENTS:
  * Each image alt text must DIRECTLY RELATE to the user's prompt and website purpose
  * Alt text must be DETAILED, SPECIFIC, PHOTOGRAPHIC (minimum 15 words, maximum 40 words)
  * Include exact visual composition: subject, angle, lighting, setting, mood, specific details
  * CONTEXT MATTERS: If building a "food delivery platform", show food, chefs, customers, delivery - NOT generic business photos
  * CONTEXT MATTERS: If building a "fitness app", show workouts, trainers, equipment - NOT generic health images
  * Never use generic terms like "image", "photo", "hero image", "professional picture", "stock photo"
  * For food: specify exact dish name, plating style, visible ingredients, serving presentation, photography style
  * For people: specify exact role/profession, realistic setting, natural expression, appropriate clothing, lighting
  * For products: specify exact product type, product angle, background style, lighting setup, material details
  * Each image must have UNIQUE visual intent - review all images to ensure no repetition or similarity
  * BAD EXAMPLE: "Professional business meeting photo" → TOO GENERIC
  * GOOD EXAMPLE: "Overhead shot of hands arranging fresh pasta ingredients on marble counter in professional kitchen, natural daylight from left"
- Navbar must be fully functional with mobile menu toggle and accessibility attributes.
- Ensure mobile-first responsiveness and no horizontal scrolling.
- Keep header/navbar pinned at the top while scrolling, with proper z-index layering above content.
- Mobile menu must appear from the top layer without creating an extra visible scrollbar inside nav/header/menu wrappers.
- Mobile menu panel must never render behind page content; use top-anchored overlay positioning with clear background contrast.
- Mobile menu panel must fill full mobile viewport height (h-screen/min-h-screen/100dvh or inset-y-0), not just a small top section.

IMAGE CONTEXT REMINDER:
- ALL images must visually represent the SPECIFIC use case described in the user's prompt
- Analyze the user's request for keywords about industry/domain (e.g., "cooking", "fitness", "real estate")
- If the prompt mentions "cooking", "food", "restaurant", "chef" → show relevant food, chefs, kitchen scenes, NOT generic business
- If the prompt mentions "fitness", "workout", "gym", "trainer" → show relevant exercise, trainers, equipment, NOT generic health
- If the prompt mentions "real estate", "property", "homes" → show relevant homes, agents, architecture, NOT generic business
- If the prompt mentions "technology", "software", "app" → show relevant tech, coding, digital interfaces, NOT generic office
- AVOID generic business/corporate stock photography unless the user specifically requests a corporate/business site
- Every image should pass this test: "Does this image clearly relate to what the user asked me to build?"

DESIGN DIRECTION:
- Clear visual direction with intentional typography scale and spacing rhythm.
- Premium color system, polished gradients/background depth, and subtle motion.
- High contrast and readable typography across desktop and mobile.
- Cohesive section flow: hero, value props, social proof, CTA, and footer.
- Reusable components, not one giant page file.`;
    });

    // Step 1.5: Extract theme from prompt
    const detectedTheme = await step.run("extract-theme-from-prompt", async () => {
      return await extractThemeFromPrompt(prompt);
    });

    // Check if cancelled after building prompt
    if (await checkIfCancelled(projectId)) {
      console.log(
        `[Inngest] Generation cancelled after building prompt: ${projectId}`,
      );
      throw new Error("Generation cancelled by user");
    }

    // Step 2: Generate with Gemini
    await sendProgress(
      projectId,
      "[2/7] Generating your website code with AI (usually 20-50s)...",
    );
    const generatedText = await step.run("generate-with-gemini", async () => {
      console.log("Using Gemini 3 Flash Preview...");

      try {
        const text = await generateWithGemini(SYSTEM_PROMPT, userPrompt);
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
    await sendProgress(
      projectId,
      "[3/7] Parsing AI output and preparing project files...",
    );
    const parsedProject = await step.run(
      "parse-generated-code",
      async () => {
        console.log("Parsing AI response, length:", generatedText.length);

        let normalizedProject: {
          files: GeneratedFile[];
          dependencies: Record<string, string>;
        } | null = null;
        let workingText = generatedText;
        let lastParseError: unknown;

        for (let attempt = 1; attempt <= MAX_JSON_REPAIR_ATTEMPTS + 1; attempt++) {
          try {
            normalizedProject = parseAndNormalizeProjectFromTextOrThrow(workingText);
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
        );
        let dependencies = normalizedProject.dependencies;

        for (let attempt = 1; attempt <= MAX_STRUCTURE_REPAIR_ATTEMPTS + 1; attempt++) {
          try {
            validateProjectStructureOrThrow(files);
            break;
          } catch (shapeError) {
            if (attempt > MAX_STRUCTURE_REPAIR_ATTEMPTS) {
              throw shapeError;
            }

            console.warn(
              `[ShapeRepair] Attempt ${attempt} failed: ${
                shapeError instanceof Error ? shapeError.message : String(shapeError)
              }`,
            );
            const repairedShapeText = await repairProjectShapeWithGemini({
              originalPrompt: prompt,
              parseError:
                shapeError instanceof Error ? shapeError.message : String(shapeError),
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
            );
            dependencies = repairedProject.dependencies;
          }
        }

        for (let attempt = 1; attempt <= MAX_SYNTAX_REPAIR_ATTEMPTS + 1; attempt++) {
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
          await sendProgress(
            projectId,
            `[4/7] Resolving ${syntaxIssues.length} syntax issue(s) (pass ${attempt}/${MAX_SYNTAX_REPAIR_ATTEMPTS})...`,
          );

          const repaired = await repairProjectFromLintFeedback({
            originalPrompt: prompt,
            files,
            dependencies,
            lintIssues: syntaxIssues,
          });
          files = repaired.files;
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
              `[UXRepair] Max attempts reached. Skipping remaining UX issues: ${first.path}:${first.line}:${first.column} ${first.message}`,
            );
            break; // Skip UX errors instead of throwing
          }

          console.warn(
            `[UXRepair] Attempt ${attempt} - ${uxIssues.length} responsive/navigation issue(s).`,
          );
          await sendProgress(
            projectId,
            `[4/7] Improving mobile layout and navigation (pass ${attempt}/${MAX_UX_REPAIR_ATTEMPTS})...`,
          );

          const repaired = await repairProjectFromLintFeedback({
            originalPrompt: prompt,
            files,
            dependencies,
            lintIssues: uxIssues,
          });
          files = repaired.files;
          dependencies = repaired.dependencies;
        }

        validateSyntaxOrThrow(files);
        console.log(`Parsed ${files.length} files successfully`);
        return { files, dependencies };
      },
    );
    const files = parsedProject.files;
    let dependencies = parsedProject.dependencies;

    // Step 4: Lint and fix code (parallel linting for all files)
    await sendProgress(
      projectId,
      "[5/7] Running lint and quality checks on all files...",
    );
    const { fixedFiles, lintReport } = await step.run(
      "lint-and-repair",
      async () => {
        console.log(`Starting linting for ${files.length} files...`);
        let workingFiles = files;
        let workingDependencies = dependencies;
        let lintResult = await lintAllFiles(workingFiles);

        for (
          let attempt = 1;
          lintResult.lintReport.errors > 0 &&
          attempt <= MAX_LINT_REPAIR_ATTEMPTS;
          attempt++
        ) {
          if (await checkIfCancelled(projectId)) {
            throw new Error("Generation cancelled by user");
          }

          const firstIssue = lintResult.lintIssues[0];
          console.warn(
            `[LintRepair] Attempt ${attempt} - ${lintResult.lintReport.errors} lint errors. First issue: ${firstIssue?.path}:${firstIssue?.line}:${firstIssue?.column} ${firstIssue?.message}`,
          );
          await sendProgress(
            projectId,
            `[5/7] Fixing ${lintResult.lintReport.errors} code issue(s) (pass ${attempt}/${MAX_LINT_REPAIR_ATTEMPTS})...`,
          );

          const repaired = await repairProjectFromLintFeedback({
            originalPrompt: prompt,
            files: workingFiles,
            dependencies: workingDependencies,
            lintIssues: lintResult.lintIssues,
          });

          workingFiles = repaired.files;
          workingDependencies = repaired.dependencies;
          lintResult = await lintAllFiles(workingFiles);
        }

        if (lintResult.lintReport.errors > 0) {
          const firstIssue = lintResult.lintIssues[0];
          throw new Error(
            `Lint failed after repair attempts. First issue: ${firstIssue?.path}:${firstIssue?.line}:${firstIssue?.column} ${firstIssue?.message}`,
          );
        }

        dependencies = workingDependencies;
        return {
          fixedFiles: workingFiles,
          lintReport: lintResult.lintReport,
        };
      },
    );
    // Step 5: Notify completion via API
    await sendProgress(
      projectId,
      "[6/7] Finalizing generated files and saving results...",
    );
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
            files: fixedFiles,
            dependencies,
            lintReport,
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

    await sendProgress(projectId, "[7/7] Generation complete.");

    return {
      files: fixedFiles,
      dependencies,
      lintReport,
      model: "gemini",
      originalPrompt: prompt,
      detectedTheme: detectedTheme,
    };
  },
);

