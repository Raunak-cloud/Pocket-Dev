import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { lintCode } from "./eslint-lint";

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
const GEMINI_FLASH_MODEL = "gemini-3-flash-preview"; // For code generation
const GEMINI_PRO_MODEL = "gemini-3-pro"; // For architecture/planning
const MAX_TOKENS = 64000; // Increased to support larger multi-file projects

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not found in environment variables");
  }
  return new GoogleGenerativeAI(apiKey);
}

/** Check if error is due to insufficient credits/quota */
function isInsufficientCreditsError(error: any): boolean {
  const errorType = error?.error?.type || "";
  const errorMessage = error?.error?.message || error?.message || "";
  const errorCode = error?.status || error?.error?.status_code || 0;

  return (
    errorType === "invalid_request_error" ||
    errorType === "permission_error" ||
    errorCode === 403 ||
    errorCode === 402 ||
    errorMessage.toLowerCase().includes("credit") ||
    errorMessage.toLowerCase().includes("quota") ||
    errorMessage.toLowerCase().includes("billing") ||
    errorMessage.toLowerCase().includes("payment")
  );
}

const SYSTEM_PROMPT = `You are an expert Next.js developer who creates professional, production-ready Next.js applications.

🚨 MANDATORY REQUIREMENTS 🚨

1. Generate a COMPLETE Next.js project with multiple files
2. Use Next.js 14 App Router for navigation (app/ directory structure)
3. Use Tailwind CSS for styling
4. Create at least 3-4 pages based on the prompt
5. All code must be properly linted (no unused vars, use const/let, semicolons)
6. Every component must be complete with real content (no placeholders)

📸 USER-UPLOADED IMAGES:
If the user provides image URLs (Firebase Storage URLs starting with https://), you MUST:
- Use EXACTLY those URLs in your img src attributes
- Example: <img src="https://firebasestorage.googleapis.com/..." alt="User uploaded image" className="w-full h-auto" />
- DO NOT use placeholder URLs like via.placeholder.com or unsplash when user has uploaded images
- Place the user's images prominently (hero sections, galleries, cards, etc.)
- The user expects to see their ACTUAL uploaded images in the generated website
- These are real hosted images, not placeholders

For design reference (when images are shown visually):
- Carefully analyze the design, layout, colors, typography, and style from the images
- Replicate the visual design as closely as possible using Tailwind CSS
- Match the color scheme (use exact hex colors when possible)
- Match the layout structure and spacing

TECH STACK:
- Next.js ^14.0.0
- React 18
- TypeScript
- Tailwind CSS
- Lucide React (for icons)

FILE STRUCTURE YOU MUST GENERATE:

1. app/layout.tsx - Root layout with Navbar/Footer
2. app/page.tsx - Home page (/)
3. app/about/page.tsx - About page (/about)
4. app/[pageName]/page.tsx - Additional pages
5. app/components/Navbar.tsx - Navigation bar
6. app/components/Footer.tsx - Footer component
7. app/components/[Others].tsx - Reusable components

REQUIRED PAGES BY TYPE:

E-COMMERCE:
- app/page.tsx (hero, featured products)
- app/products/page.tsx (product grid with filtering)
- app/products/[id]/page.tsx (individual product page)
- app/cart/page.tsx (shopping cart)
- app/about/page.tsx

RESTAURANT:
- app/page.tsx (hero, highlights)
- app/menu/page.tsx (full menu with categories)
- app/reservations/page.tsx (booking form)
- app/about/page.tsx

SAAS:
- app/page.tsx (hero, features)
- app/features/page.tsx (detailed features)
- app/pricing/page.tsx (pricing tiers)
- app/about/page.tsx

PORTFOLIO:
- app/page.tsx (hero, featured work)
- app/projects/page.tsx (project gallery)
- app/about/page.tsx
- app/contact/page.tsx

NEXT.JS REQUIREMENTS:
- Use TypeScript (.tsx) for all components
- Pages are Server Components by default (no 'use client' unless needed)
- Use 'use client' directive for interactive components (forms, buttons, state)
- Export metadata from page.tsx files for SEO
- Use Next.js Link component for navigation: import Link from 'next/link'
- Follow Next.js naming: page.tsx (route), layout.tsx (layout), loading.tsx (optional)
- Use proper TypeScript types for props and params
- IMPORTANT: Use regular <img> tags for images (NOT next/image) - it requires extra configuration for external URLs
- Example: <img src="https://images.unsplash.com/..." alt="Description" className="w-full h-auto" />

CODE REQUIREMENTS:

✅ Use functional components with hooks
✅ Use const/let (never var)
✅ Use === (never ==)
✅ Add semicolons
✅ No unused variables
✅ Proper TypeScript types
✅ Clean, readable code with proper indentation
✅ Responsive design (mobile-first)
✅ Smooth animations and transitions

CONTENT REQUIREMENTS:

✅ NO placeholder text or "Lorem ipsum"
✅ EVERY page has complete, realistic content
✅ Products/menu items: minimum 8-12 with descriptions and prices
✅ About sections: 3-4 full paragraphs
✅ Use regular <img> tags for all images (NOT next/image)
✅ Allowed image sources: images.unsplash.com, via.placeholder.com, firebasestorage.googleapis.com, picsum.photos

ROUTING SETUP:

Example app/layout.tsx structure:
\`\`\`tsx
import type { Metadata } from 'next';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: 'App Name',
  description: 'App description',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
\`\`\`

Example app/page.tsx structure:
\`\`\`tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Home',
};

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold">Welcome</h1>
      {/* Page content */}
    </div>
  );
}
\`\`\`

Example app/components/Navbar.tsx structure:
\`\`\`tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="bg-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="text-xl font-bold">
            Logo
          </Link>
          <div className="hidden md:flex space-x-8">
            <Link href="/" className="hover:text-blue-600">Home</Link>
            <Link href="/about" className="hover:text-blue-600">About</Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
\`\`\`

EDITING EXISTING CODE:
When modifying an existing app, follow these rules strictly:
- Do EXACTLY what the user requested - nothing more, nothing less
- DO NOT add unrequested features, components, or improvements
- DO NOT refactor or reorganize code unless specifically asked
- DO NOT change styling, colors, or layout unless specifically asked
- Keep all unmodified parts of the code EXACTLY as they were
- Only touch the specific files/sections needed for the requested change

OUTPUT FORMAT (CRITICAL):

You MUST return ONLY a valid JSON object. No markdown code blocks, no explanations, no extra text.

Structure:
{
  "files": [
    {"path": "App.jsx", "content": "import { BrowserRouter as Router..."},
    {"path": "pages/Home.jsx", "content": "import React from 'react'..."},
    {"path": "pages/About.jsx", "content": "import React from 'react'..."},
    {"path": "components/Navbar.jsx", "content": "import React from 'react'..."},
    {"path": "components/Footer.jsx", "content": "import React from 'react'..."}
  ],
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.294.0"
  }
}

🚨 CRITICAL: Your ENTIRE response must be ONLY this JSON object. Do NOT wrap it in markdown code blocks. Do NOT add any explanatory text before or after. Just pure JSON starting with { and ending with }.`;

interface GeneratedFile {
  path: string;
  content: string;
}

export interface UploadedImage {
  name: string;
  type: string;
  dataUrl: string;
  downloadUrl?: string; // Firebase Storage URL for embedding in generated code
}

interface LintResult {
  passed: boolean;
  errors: number;
  warnings: number;
  fileResults: Array<{
    path: string;
    passed: boolean;
    errors: number;
    warnings: number;
    messages: Array<{
      line: number;
      column: number;
      severity: string;
      rule: string | null;
      message: string;
    }>;
  }>;
}

export interface GeneratedReactProject {
  files: GeneratedFile[];
  dependencies: Record<string, string>;
  lintReport: LintResult;
  attempts: number;
}

/** Extract JSON from various formats */
function extractJSON(text: string): string {
  // Remove any markdown code blocks
  text = text
    .replace(/```json\s*/gi, "")
    .replace(/```javascript\s*/gi, "")
    .replace(/```\s*$/gi, "")
    .trim();

  // Remove any leading/trailing text before the JSON
  const jsonStartIndex = text.indexOf("{");
  const jsonEndIndex = text.lastIndexOf("}");

  if (
    jsonStartIndex !== -1 &&
    jsonEndIndex !== -1 &&
    jsonEndIndex > jsonStartIndex
  ) {
    text = text.substring(jsonStartIndex, jsonEndIndex + 1);
  }

  return text;
}

/** Lint all generated files */
async function lintAllFiles(files: GeneratedFile[]): Promise<LintResult> {
  const fileResults = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of files) {
    // Only lint JS/JSX/TS/TSX files
    if (!file.path.endsWith(".tsx") && !file.path.endsWith(".ts") &&
        !file.path.endsWith(".jsx") && !file.path.endsWith(".js")) {
      continue;
    }

    const result = await lintCode(file.content);

    fileResults.push({
      path: file.path,
      passed: result.errorCount === 0,
      errors: result.errorCount,
      warnings: result.warningCount,
      messages: result.messages,
    });

    totalErrors += result.errorCount;
    totalWarnings += result.warningCount;
  }

  return {
    passed: totalErrors === 0,
    errors: totalErrors,
    warnings: totalWarnings,
    fileResults,
  };
}

/** Build multimodal content for the API */
function buildUserContent(
  prompt: string,
  images?: UploadedImage[],
): Anthropic.MessageCreateParams["messages"][0]["content"] {
  const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

  // Add images and PDFs first if provided
  if (images && images.length > 0) {
    for (const file of images) {
      // Extract base64 data from dataUrl
      const base64Match = file.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (base64Match) {
        const mimeType = base64Match[1];
        const base64Data = base64Match[2];

        // Handle PDFs
        if (mimeType === "application/pdf") {
          content.push({
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Data,
            },
          } as any);
        }
        // Handle images
        else if (mimeType.startsWith("image/")) {
          const mediaType = mimeType as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp";

          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Data,
            },
          });
        }
      }
    }
  }

  // Add the text prompt
  let textPrompt = prompt;
  if (images && images.length > 0) {
    // Check if any images have downloadUrl (Firebase Storage URLs)
    const imagesWithUrls = images.filter((img) => img.downloadUrl);

    if (imagesWithUrls.length > 0) {
      // If Firebase URLs are available, include them prominently in the prompt
      const imageUrlList = imagesWithUrls
        .map((img, i) => `${i + 1}. ${img.name}: ${img.downloadUrl}`)
        .join("\n");

      textPrompt = `I've uploaded ${images.length} image(s) above for design inspiration.

🚨 CRITICAL: USER-UPLOADED IMAGES 🚨
The user has provided ${imagesWithUrls.length} image(s) hosted on Firebase Storage. You MUST use these EXACT URLs in your generated code:

${imageUrlList}

REQUIREMENTS FOR THESE IMAGES:
1. Use EXACTLY these URLs in your img src attributes
2. Example: <img src="${imagesWithUrls[0].downloadUrl}" alt="${imagesWithUrls[0].name}" className="w-full h-auto" />
3. DO NOT use placeholder URLs (via.placeholder.com, unsplash, etc.)
4. Place these images prominently (hero sections, galleries, product images, etc.)
5. The user expects to see their ACTUAL uploaded images in the final website
6. These are real, hosted images - not placeholders

${prompt}`;
    } else {
      // Fallback for when only dataUrl is available
      textPrompt = `I've uploaded ${images.length} image(s) above. Please analyze these images for design inspiration.\n\n${prompt}`;
    }
  }

  content.push({
    type: "text",
    text: textPrompt,
  });

  return content;
}

/** Generate using Gemini */
async function generateWithGemini(
  prompt: string,
  images?: UploadedImage[],
  onProgress?: (msg: string) => void,
  useProForPlanning: boolean = false,
): Promise<string> {
  const genAI = getGeminiClient();
  // Use Gemini 3 Pro for architecture/planning, Flash for code generation
  const modelName = useProForPlanning ? GEMINI_PRO_MODEL : GEMINI_FLASH_MODEL;
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      maxOutputTokens: 65536, // Max output tokens for Gemini
      temperature: 0.7,
      topP: 0.95,
    },
  });

  onProgress?.(useProForPlanning ? "Planning with Gemini 3 Pro" : "Generating with Gemini 3 Flash");

  const parts: any[] = [];

  // Add images and PDFs first if provided
  if (images && images.length > 0) {
    for (const file of images) {
      const base64Match = file.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (base64Match) {
        const mimeType = base64Match[1];
        const base64Data = base64Match[2];

        // Gemini supports both images and PDFs
        if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
          parts.push({
            inlineData: {
              mimeType,
              data: base64Data,
            },
          });
        }
      }
    }
  }

  // Add text prompt
  let textPrompt = prompt;
  if (images && images.length > 0) {
    // Check if any images have downloadUrl (Firebase Storage URLs)
    const imagesWithUrls = images.filter((img) => img.downloadUrl);

    if (imagesWithUrls.length > 0) {
      // If Firebase URLs are available, include them prominently in the prompt
      const imageUrlList = imagesWithUrls
        .map((img, i) => `${i + 1}. ${img.name}: ${img.downloadUrl}`)
        .join("\n");

      textPrompt = `I've uploaded ${images.length} image(s) above for design inspiration.

🚨 CRITICAL: USER-UPLOADED IMAGES 🚨
The user has provided ${imagesWithUrls.length} image(s) hosted on Firebase Storage. You MUST use these EXACT URLs in your generated code:

${imageUrlList}

REQUIREMENTS FOR THESE IMAGES:
1. Use EXACTLY these URLs in your img src attributes
2. Example: <img src="${imagesWithUrls[0].downloadUrl}" alt="${imagesWithUrls[0].name}" className="w-full h-auto" />
3. DO NOT use placeholder URLs (via.placeholder.com, unsplash, etc.)
4. Place these images prominently (hero sections, galleries, product images, etc.)
5. The user expects to see their ACTUAL uploaded images in the final website
6. These are real, hosted images - not placeholders

${prompt}`;
    } else {
      // Fallback for when only dataUrl is available
      textPrompt = `I've uploaded ${images.length} image(s) above. Please analyze these images for design inspiration.\n\n${prompt}`;
    }
  }
  // Add additional instructions for Gemini to keep responses concise
  const geminiInstructions = `

⚠️ IMPORTANT: Keep your response CONCISE and COMPLETE:
- Generate ONLY the essential files needed
- Keep component code clean and minimal
- Ensure the JSON is COMPLETE and ends with }
- DO NOT truncate the response - finish the JSON properly
`;

  parts.push({ text: SYSTEM_PROMPT + geminiInstructions + "\n\nUser Request: " + textPrompt });

  try {
    const result = await model.generateContent(parts);
    const response = result.response;
    const text = response.text();

    // Log response length for debugging
    console.log(`Gemini response length: ${text.length} characters`);

    return text;
  } catch (error: any) {
    console.error("Gemini generation error:", error);
    throw new Error(`Gemini API error: ${error.message || "Unknown error"}`);
  }
}

/** Generate React project with retry on lint errors */
async function generateWithLinting(
  client: Anthropic,
  prompt: string,
  images?: UploadedImage[],
  onProgress?: (msg: string) => void,
  useGemini: boolean = false,
): Promise<GeneratedReactProject> {
  let attempts = 1;
  const maxAttempts = 3;

  // Build user content with images if provided
  const userContent = buildUserContent(prompt, images);

  while (attempts <= maxAttempts) {
    try {
      onProgress?.(
        `Generating React project (attempt ${attempts}/${maxAttempts})`,
      );

      let text: string;

      if (useGemini) {
        // Use Gemini Flash for code generation
        text = await generateWithGemini(prompt, images, onProgress, false);
      } else {
        // Generate code with Anthropic streaming
        const stream = client.messages.stream({
          model: CLAUDE_MODEL,
          max_tokens: MAX_TOKENS,
          temperature: 0.7,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContent }],
        });

        const response = await stream.finalMessage();
        text =
          response.content[0].type === "text" ? response.content[0].text : "";
      }

      const jsonText = extractJSON(text);

      // Check if JSON appears complete
      if (!jsonText.trim().endsWith("}")) {
        console.error("JSON response appears truncated - does not end with }");
        console.error("Response length:", jsonText.length);
        console.error("Last 200 chars:", jsonText.substring(Math.max(0, jsonText.length - 200)));

        if (attempts === maxAttempts) {
          if (useGemini) {
            throw new Error(
              `Gemini response was truncated (${jsonText.length} chars). ` +
              `The model may have hit its output limit. Try a simpler prompt with fewer pages.`,
            );
          }
          throw new Error(
            `Generated JSON appears incomplete (response was ${jsonText.length} chars). ` +
              `Try a simpler prompt or reduce the number of pages/components requested.`,
          );
        }
        attempts++;
        continue;
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch (e) {
        console.error("JSON parse error:", e);
        console.error("Response length:", jsonText.length);
        console.error("First 1000 chars:", jsonText.substring(0, 1000));
        console.error(
          "Last 500 chars:",
          jsonText.substring(Math.max(0, jsonText.length - 500)),
        );

        if (attempts === maxAttempts) {
          throw new Error(
            `Failed to parse generated JSON after ${maxAttempts} attempts. ` +
              `Response length: ${jsonText.length} chars. ` +
              `The AI response may be incomplete or malformed. Please try a simpler prompt or try again.`,
          );
        }
        attempts++;
        continue;
      }

      // Validate structure
      if (
        !parsed.files ||
        !Array.isArray(parsed.files) ||
        parsed.files.length === 0
      ) {
        console.error("Invalid JSON structure - missing or empty files array");
        if (attempts === maxAttempts) {
          throw new Error(
            "Generated code has invalid structure. Please try again.",
          );
        }
        attempts++;
        continue;
      }

      const { files, dependencies } = parsed;

      // Validate files have required properties
      const invalidFile = files.find((f: any) => !f.path || !f.content);
      if (invalidFile) {
        console.error("Invalid file structure:", invalidFile);
        if (attempts === maxAttempts) {
          throw new Error(
            "Generated files have invalid structure. Please try again.",
          );
        }
        attempts++;
        continue;
      }

      // Lint all files
      onProgress?.("Linting generated code with ESLint");
      let lintReport: LintResult;
      try {
        lintReport = await lintAllFiles(files);
      } catch (lintError) {
        console.error("Linting error:", lintError);
        // If linting fails, create a passing report and continue
        lintReport = {
          passed: true,
          errors: 0,
          warnings: 0,
          fileResults: [],
        };
      }

      if (lintReport.passed) {
        onProgress?.("✓ All files passed linting!");
        return { files, dependencies, lintReport, attempts };
      }

      // If linting failed and we have attempts left, ask AI to fix
      if (attempts < maxAttempts) {
        onProgress?.(`Found ${lintReport.errors} linting errors, fixing...`);

        const errorSummary = lintReport.fileResults
          .filter((f) => f.errors > 0)
          .map(
            (f) =>
              `${f.path}: ${f.messages.map((m) => `Line ${m.line}: ${m.message}`).join(", ")}`,
          )
          .join("\n");

        let fixText: string;
        try {
          if (useGemini) {
            // Use Gemini Flash for fixing code
            const fixPrompt = `${prompt}\n\nThe generated code has ESLint errors. Fix them and return the complete JSON again:\n\n${errorSummary}\n\nReturn ONLY valid JSON with all files.`;
            fixText = await generateWithGemini(fixPrompt, images, onProgress, false);
          } else {
            // Use Anthropic for fix
            const fixStream = client.messages.stream({
              model: CLAUDE_MODEL,
              max_tokens: MAX_TOKENS,
              temperature: 0.2,
              system: SYSTEM_PROMPT,
              messages: [
                { role: "user", content: prompt },
                { role: "assistant", content: jsonText },
                {
                  role: "user",
                  content: `The code has ESLint errors. Fix them and return the complete JSON again:\n\n${errorSummary}\n\nReturn ONLY valid JSON with all files.`,
                },
              ],
            });
            const fixResponse = await fixStream.finalMessage();
            fixText =
              fixResponse.content[0].type === "text"
                ? fixResponse.content[0].text
                : "";
          }
        } catch (fixError: any) {
          // If fix attempt fails due to API issues, continue to next attempt
          console.error(
            "Fix attempt API error:",
            fixError?.error?.type || fixError?.message,
          );
          throw fixError; // Will be caught by outer catch
        }

        const fixedJsonText = extractJSON(fixText);

        try {
          // Check if JSON appears complete
          if (!fixedJsonText.trim().endsWith("}")) {
            console.error("Fixed JSON response appears truncated");
            throw new Error("Incomplete JSON");
          }

          const fixedParsed = JSON.parse(fixedJsonText);
          if (!fixedParsed.files || !Array.isArray(fixedParsed.files)) {
            throw new Error("Invalid structure");
          }

          const fixedLintReport = await lintAllFiles(fixedParsed.files);

          if (fixedLintReport.passed) {
            onProgress?.("✓ Fixed all linting errors!");
            return {
              files: fixedParsed.files,
              dependencies: fixedParsed.dependencies,
              lintReport: fixedLintReport,
              attempts: attempts + 1,
            };
          }
        } catch (e) {
          console.error("Fix attempt failed:", e);
          // Continue to next attempt
        }
      }
    } catch (apiError: any) {
      // Handle insufficient credits - throw to trigger Gemini fallback
      if (!useGemini && isInsufficientCreditsError(apiError)) {
        console.error(
          "Insufficient credits detected, will try Gemini fallback",
        );
        throw apiError; // This will be caught by the outer function to retry with Gemini
      }

      // Handle API errors like overloaded, rate limits, etc.
      if (
        apiError?.error?.type === "overloaded_error" ||
        apiError?.status === 529
      ) {
        console.error(`API overloaded on attempt ${attempts}`);
        if (attempts < maxAttempts) {
          const delayMs = 2000 * attempts; // Exponential backoff: 2s, 4s, 6s
          onProgress?.(`API is overloaded, retrying in ${delayMs / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          attempts++;
          continue;
        }
        throw new Error(
          "The AI service is currently experiencing high demand. Please try again in a few moments.",
        );
      }

      // Handle rate limit errors
      if (
        apiError?.status === 429 ||
        apiError?.error?.type === "rate_limit_error"
      ) {
        throw new Error(
          "Rate limit exceeded. Please wait a moment before trying again.",
        );
      }

      // For other API errors, rethrow with helpful message
      throw new Error(
        `AI service error: ${apiError?.error?.message || apiError?.message || "Unknown error"}. Please try again.`,
      );
    }

    attempts++;
  }

  // Return last result even if it has lint errors
  onProgress?.("⚠ Returning code with some linting issues");
  try {
    let text: string;

    if (useGemini) {
      // Use Gemini Flash for fallback code generation
      text = await generateWithGemini(prompt, images, onProgress, false);
    } else {
      const stream = client.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.7,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      });

      const response = await stream.finalMessage();
      text =
        response.content[0].type === "text" ? response.content[0].text : "";
    }

    const jsonText = extractJSON(text);
    const parsed = JSON.parse(jsonText);

    if (!parsed.files || !Array.isArray(parsed.files)) {
      throw new Error("Invalid response structure");
    }

    const lintReport = await lintAllFiles(parsed.files);
    return { ...parsed, lintReport, attempts };
  } catch (e: any) {
    // Handle API errors specifically
    if (e?.error?.type === "overloaded_error" || e?.status === 529) {
      throw new Error(
        "The AI service is currently experiencing high demand. Please try again in a few moments.",
      );
    }
    if (e?.status === 429 || e?.error?.type === "rate_limit_error") {
      throw new Error(
        "Rate limit exceeded. Please wait a moment before trying again.",
      );
    }

    throw new Error(
      "Failed to generate React project. " +
        (e?.error?.message ||
          e?.message ||
          "The AI response could not be parsed correctly.") +
        " Please try again with a clearer description.",
    );
  }
}

export async function generateReactProject(
  prompt: string,
  images?: UploadedImage[],
  onProgress?: (message: string) => void,
): Promise<GeneratedReactProject> {
  const client = getAnthropicClient();

  try {
    // Try Claude first
    onProgress?.("Using Claude AI");
    return await generateWithLinting(client, prompt, images, onProgress, false);
  } catch (error: any) {
    // If Claude fails with any API error, fallback to Gemini
    console.log(
      "Claude API failed, falling back to Gemini:",
      error?.message || error,
    );
    onProgress?.("⚠️ Switching to Gemini AI (Claude API error)");

    try {
      return await generateWithLinting(
        client,
        prompt,
        images,
        onProgress,
        true,
      );
    } catch (geminiError: any) {
      // If Gemini also fails, throw a combined error
      throw new Error(
        `Both AI services failed. Claude: ${error?.error?.message || error?.message || "Unknown error"}. ` +
          `Gemini: ${geminiError?.message || "Unknown error"}. Please check your API keys and try again.`,
      );
    }
  }
}
