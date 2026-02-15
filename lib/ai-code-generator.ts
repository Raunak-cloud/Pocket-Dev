/**
 * Full AI Code Generator - Next.js 15 + shadcn/ui + Framer Motion
 *
 * Replaces template system with full AI generation
 * Generates complete React components from scratch
 *
 * Uses Gemini 3 Flash Preview
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { lintCode } from "./eslint-lint";
import ts from "typescript";

const MODEL = "gemini-3-flash-preview";
const MAX_TOKENS = 32768;

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

function validateSyntaxOrThrow(files: GeneratedFile[]) {
  const sourceFiles = files.filter((f) =>
    /\.(tsx|ts|jsx|js)$/.test(f.path.toLowerCase()),
  );

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
    throw new Error(
      `Generated code contains syntax errors in ${file.path}:${lineCol.line + 1}:${lineCol.character + 1} - ${message}`,
    );
  }
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not found");
  }
  return new GoogleGenerativeAI(apiKey);
}

const SYSTEM_PROMPT = `You are an expert Next.js 15 developer. Generate production-ready code with shadcn/ui, Framer Motion, and Tailwind CSS.

REQUIREMENTS:
- Next.js 15 App Router
- shadcn/ui components
- Framer Motion animations
- react-scroll-parallax for parallax
- Lucide icons
- TypeScript strict mode
- Responsive design
- Dark mode support
- If authentication is implemented, use Clerk only (@clerk/nextjs), never Firebase/Auth0/Supabase.
- In server components/routes, import auth helpers from "@clerk/nextjs/server" and call \`await auth()\`.
- For authenticated apps, enforce Clerk Organizations tenant isolation using NEXT_PUBLIC_POCKET_APP_SLUG.
- Scope all protected data/actions by active organization id, not only by user id.

OUTPUT FORMAT: Return JSON only:
{
  "files": [{"path": "app/layout.tsx", "content": "..."}],
  "dependencies": {"next": "^15.0.0"}
}`;

export async function generateFullCode(
  prompt: string,
  onProgress?: (message: string) => void,
  maxAttempts = 3
): Promise<AIGeneratedProject> {
  const client = getGeminiClient();
  let attempts = 0;
  let lastError: Error | null = null;

  while (attempts < maxAttempts) {
    attempts++;
    onProgress?.(`Generating code (attempt ${attempts}/${maxAttempts})...`);

    try {
      console.log(`Generating full Next.js code with Gemini (attempt ${attempts})...`);
      const startTime = Date.now();

      const userPrompt = `Create a complete Next.js 15 website for: ${prompt}

Requirements:
- Modern, professional design
- Responsive (mobile, tablet, desktop)
- Smooth animations with Framer Motion
- Parallax scrolling effects
- shadcn/ui components
- Lucide icons
- Dark mode support
- SEO optimized
- TypeScript strict mode

Include homepage with hero, features, testimonials, CTA, navigation, and footer.`;

      const model = client.getGenerativeModel({
        model: MODEL,
        generationConfig: {
          maxOutputTokens: MAX_TOKENS,
          temperature: 0.8,
          responseMimeType: "application/json",
        },
      });

      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [{ text: `${SYSTEM_PROMPT}\n\n${userPrompt}` }],
        }],
      });

      const text = result.response.text();
      const elapsed = Date.now() - startTime;
      console.log(`Code generated in ${elapsed}ms`);

      onProgress?.("Parsing generated code...");
      const parsed = JSON.parse(text);
      let files: GeneratedFile[] = parsed.files || [];
      const dependencies = parsed.dependencies || getDefaultDependencies();

      console.log(`Generated ${files.length} files`);

      files = ensureRequiredFiles(files, dependencies);
      validateSyntaxOrThrow(files);

      onProgress?.("Validating code quality...");
      const { fixedFiles, lintReport } = await lintAllFiles(files);

      if (lintReport.passed || attempts === maxAttempts) {
        console.log(`Lint ${lintReport.passed ? "PASSED" : "completed"}`);
        return { files: fixedFiles, dependencies, lintReport, attempts };
      } else {
        console.log(`Lint FAILED - retrying...`);
        lastError = new Error(`Lint failed: ${lintReport.errors} errors`);
      }
    } catch (err) {
      console.error(`Generation attempt ${attempts} failed:`, err);
      lastError = err as Error;
      if (attempts < maxAttempts) {
        onProgress?.("Retrying generation...");
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw new Error(`Failed after ${maxAttempts} attempts: ${lastError?.message}`);
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

function ensureRequiredFiles(
  files: GeneratedFile[],
  dependencies: Record<string, string>
): GeneratedFile[] {
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
        2
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
  }

  return files;
}

async function lintAllFiles(
  files: GeneratedFile[]
): Promise<{
  fixedFiles: GeneratedFile[];
  lintReport: { passed: boolean; errors: number; warnings: number };
}> {
  const fixedFiles: GeneratedFile[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of files) {
    if (
      file.path.endsWith(".ts") ||
      file.path.endsWith(".tsx") ||
      file.path.endsWith(".js") ||
      file.path.endsWith(".jsx")
    ) {
      try {
        const result = await lintCode(file.content);
        fixedFiles.push({
          path: file.path,
          content: file.content, // Linting doesn't fix code, just validates
        });
        totalErrors += result.errorCount;
        totalWarnings += result.warningCount;
      } catch (err) {
        console.error(`Failed to lint ${file.path}:`, err);
        fixedFiles.push(file);
      }
    } else {
      fixedFiles.push(file);
    }
  }

  return {
    fixedFiles,
    lintReport: {
      passed: totalErrors === 0,
      errors: totalErrors,
      warnings: totalWarnings,
    },
  };
}

export async function editFullCode(
  currentFiles: GeneratedFile[],
  editPrompt: string,
  onProgress?: (message: string) => void
): Promise<AIGeneratedProject> {
  const client = getGeminiClient();
  onProgress?.("Analyzing current code...");

  const fileSummary = currentFiles.map((f) => ({
    path: f.path,
    preview: f.content.slice(0, 500),
  }));

  const userPrompt = `Current files: ${JSON.stringify(fileSummary, null, 2)}

User change: "${editPrompt}"

Generate COMPLETE updated files with changes applied. Output JSON only.`;

  onProgress?.("Generating updated code...");

  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      maxOutputTokens: MAX_TOKENS,
      temperature: 0.6,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent({
    contents: [{
      role: "user",
      parts: [{ text: `${SYSTEM_PROMPT}\n\n${userPrompt}` }],
    }],
  });

  const text = result.response.text();
  const parsed = JSON.parse(text);

  const files: GeneratedFile[] = parsed.files || [];
  const dependencies = parsed.dependencies || getDefaultDependencies();
  validateSyntaxOrThrow(files);

  onProgress?.("Validating updated code...");
  const { fixedFiles, lintReport } = await lintAllFiles(files);

  return {
    files: fixedFiles,
    dependencies,
    lintReport,
    attempts: 1,
  };
}
