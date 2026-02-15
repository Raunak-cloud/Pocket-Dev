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

interface GeneratedFile {
  path: string;
  content: string;
}

interface AIGeneratedProject {
  files: GeneratedFile[];
  dependencies: Record<string, string>;
  lintReport: {
    passed: boolean;
    errors: number;
    warnings: number;
  };
  attempts: number;
}

interface ParsedAIResponse {
  files?: GeneratedFile[];
  dependencies?: Record<string, string>;
  _checks?: Record<string, unknown>;
}

interface LintIssue {
  path: string;
  line: number;
  column: number;
  rule: string | null;
  message: string;
}

const SYSTEM_PROMPT = `You are a senior Next.js App Router engineer and UI designer.

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
  }
}
- Keep code compatible with Next.js App Router + TypeScript + Tailwind utility classes.
- Never return lockfiles.
- If app/globals.css has @layer base/components/utilities, include matching:
  @tailwind base; @tailwind components; @tailwind utilities;
- Never use variant utilities inside @apply (examples forbidden: selection:*, hover:*, focus:* in @apply).
- If a hook guard says "must be used within XProvider", ensure XProvider wraps {children} in app/layout.tsx.
- If authentication is required, use Clerk (@clerk/nextjs) with NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. Do not use Firebase/Auth0/Supabase.
- In server components/routes, import auth helpers from "@clerk/nextjs/server" and call \`await auth()\`.
- For authenticated apps, enforce tenant isolation with Clerk Organizations:
  - Use NEXT_PUBLIC_POCKET_APP_SLUG as the app tenant slug.
  - Scope all user-owned data to the active organization id (never global user-only scope).
  - If org context is missing, block protected data/actions until organization is selected/created.
- Do not output malformed PostCSS config shapes.

DESIGN GOALS:
- Premium, modern look with strong typography, spacing, gradients, and subtle motion.
- Mobile-first responsive layout.
- Accessible contrast and semantic structure.
- Cohesive visual system with reusable components.

OUTPUT RULES:
- Return complete project files needed to run.
- Escape newlines with \\n and tabs with \\t inside JSON string content.
- Prefer stable, maintainable code over novelty.`;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not found");
  }
  return new GoogleGenerativeAI(apiKey);
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

async function repairProjectFromLintFeedback(args: {
  originalPrompt: string;
  files: GeneratedFile[];
  dependencies: Record<string, string>;
  lintIssues: LintIssue[];
}) {
  const { originalPrompt, files, dependencies, lintIssues } = args;
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
- Do not include markdown or explanations.`;

  const text = await generateWithGemini(SYSTEM_PROMPT, repairPrompt);
  const parsed = parseAIGeneratedJSON(text);

  const repairedDependencies = parsed.dependencies || dependencies;
  let repairedFiles = parsed.files || files;
  repairedFiles = ensureRequiredFiles(repairedFiles, repairedDependencies);
  validateSyntaxOrThrow(repairedFiles);

  return { files: repairedFiles, dependencies: repairedDependencies };
}

function ensureRequiredFiles(
  files: GeneratedFile[],
  dependencies: Record<string, string>,
): GeneratedFile[] {
  function ensureTailwindLayerDirectives(content: string): string {
    const stripUnsupportedApplyUtilities = (css: string): string =>
      css.replace(/@apply\s+([^;]+);/g, (_match, utilityGroup: string) => {
        const utilities = utilityGroup
          .split(/\s+/)
          .map((u) => u.trim())
          .filter(Boolean);
        const filtered = utilities.filter((u) => !u.startsWith("selection:"));

        if (filtered.length === 0) {
          return "";
        }

        return `@apply ${filtered.join(" ")};`;
      });

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
    return stripUnsupportedApplyUtilities(normalized);
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

  files = ensureProviderGuardsForGeneratedFiles(files);
  return files;
}

function validateSyntaxOrThrow(files: GeneratedFile[]) {
  const sourceFiles = files.filter((f) =>
    /\.(tsx|ts|jsx|js)$/.test(f.path.toLowerCase()),
  );

  const syntaxIssues: string[] = [];

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

    if (sf.parseDiagnostics.length === 0) continue;

    const first = sf.parseDiagnostics[0];
    const message = ts.flattenDiagnosticMessageText(first.messageText, "\n");
    const pos = first.start ?? 0;
    const lineCol = sf.getLineAndCharacterOfPosition(pos);
    syntaxIssues.push(
      `${file.path}:${lineCol.line + 1}:${lineCol.character + 1} ${message}`,
    );
  }

  if (syntaxIssues.length > 0) {
    throw new Error(
      `Generated code contains syntax errors. First issue: ${syntaxIssues[0]}`,
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
    const { prompt, userId, projectId } = event.data;

    // Check if cancelled before starting
    if (await checkIfCancelled(projectId)) {
      console.log(`[Inngest] Generation cancelled before start: ${projectId}`);
      throw new Error("Generation cancelled by user");
    }

    // Step 1: Build user prompt
    await sendProgress(projectId, "📝 Analyzing your requirements...");
    const userPrompt = await step.run("build-prompt", async () => {
      return `Build a production-ready, visually premium Next.js website for this request:
${prompt}

STRICT IMPLEMENTATION RULES:
- Keep output compatible with Next.js App Router + TypeScript.
- Use Tailwind utility classes for styling.
- In app/globals.css, if any @layer base/components/utilities is present, include matching @tailwind directives.
- Never use variant classes inside @apply (forbidden examples: selection:*, hover:*, focus:* in @apply).
- If code contains a guard like "must be used within XProvider", ensure app/layout.tsx wraps {children} with XProvider.
- If auth is implemented, use Clerk Organizations and tenant-scope the app with NEXT_PUBLIC_POCKET_APP_SLUG.
- Preserve accessibility and responsive behavior.

DESIGN DIRECTION:
- Bold hero section, clear hierarchy, strong spacing rhythm.
- Modern gradient accents and subtle motion.
- High contrast and readable typography.
- Professional, cohesive sections and CTA flow.`;
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
      "🤖 AI is generating your code (this takes 20-50 seconds)...",
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
    await sendProgress(projectId, "📦 Preparing project files...");
    const parsedProject = await step.run(
      "parse-generated-code",
      async () => {
        console.log("Parsing AI response, length:", generatedText.length);

        let parsed;
        try {
          parsed = parseAIGeneratedJSON(generatedText);
        } catch (parseError) {
          console.error("Failed to parse AI response:", parseError);
          // Save the failed response for debugging
          console.log(
            "Raw response first 1000 chars:",
            generatedText.substring(0, 1000),
          );
          console.log(
            "Raw response last 500 chars:",
            generatedText.substring(Math.max(0, generatedText.length - 500)),
          );

          // Check for common issues
          if (!generatedText.includes("{")) {
            throw new Error(
              "AI response doesn't contain JSON (no opening brace)",
            );
          }
          if (!generatedText.includes("}")) {
            throw new Error(
              "AI response doesn't contain valid JSON (no closing brace)",
            );
          }

          throw parseError;
        }

        let files: GeneratedFile[] = parsed.files || [];
        const dependencies = parsed.dependencies || getDefaultDependencies();

        console.log(`Parsed ${files.length} files successfully`);
        files = ensureRequiredFiles(files, dependencies);
        validateSyntaxOrThrow(files);

        return { files, dependencies };
      },
    );
    const files = parsedProject.files;
    let dependencies = parsedProject.dependencies;

    // Step 4: Lint and fix code (parallel linting for all files)
    await sendProgress(projectId, "🔍 Running quality checks on all files...");
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
            `🛠️ Fixing ${lintResult.lintReport.errors} code issue(s) (pass ${attempt}/${MAX_LINT_REPAIR_ATTEMPTS})...`,
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
    await sendProgress(projectId, "✅ Finalizing your project...");
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

    return {
      files: fixedFiles,
      dependencies,
      lintReport,
      model: "gemini",
    };
  },
);
