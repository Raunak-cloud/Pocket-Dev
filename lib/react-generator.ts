import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { lintCode } from "./eslint-lint";

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
const GEMINI_MODEL = "gemini-3-flash-preview";
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

const SYSTEM_PROMPT = `You are an expert React developer who creates professional, production-ready React applications.

🚨 MANDATORY REQUIREMENTS 🚨

1. Generate a COMPLETE React project with multiple files
2. Use React Router v6 for navigation
3. Use Tailwind CSS for styling
4. Create at least 3-4 pages based on the prompt
5. All code must be properly linted (no unused vars, use const/let, semicolons)
6. Every component must be complete with real content (no placeholders)

📸 USER-UPLOADED IMAGES:
If the user provides images with paths like /images/user-image-1.jpg, you MUST:
- Use EXACTLY those image paths in your img src attributes
- Example: <img src="/images/user-image-1.jpg" alt="User uploaded image" className="w-full h-auto" />
- DO NOT use placeholder URLs like via.placeholder.com or unsplash when user has uploaded images
- Place the user's images prominently (hero sections, galleries, cards, etc.)
- The user expects to see their ACTUAL uploaded images in the generated website

For design reference images:
- Carefully analyze the design, layout, colors, typography, and style from the images
- Replicate the visual design as closely as possible using Tailwind CSS
- Match the color scheme (use exact hex colors when possible)
- Match the layout structure and spacing

TECH STACK:
- React 18
- React Router v6
- Tailwind CSS
- Lucide React (for icons)

FILE STRUCTURE YOU MUST GENERATE:

1. App.jsx - Main app component with routes
2. pages/Home.jsx - Home page
3. pages/About.jsx - About page
4. pages/[OtherPages].jsx - Additional pages based on website type
5. components/Navbar.jsx - Navigation bar
6. components/Footer.jsx - Footer component
7. components/[Others].jsx - Additional reusable components

REQUIRED PAGES BY TYPE:

E-COMMERCE:
- Home.jsx (hero, featured products)
- Products.jsx (product grid with filtering)
- ProductDetail.jsx (individual product page)
- Cart.jsx (shopping cart)
- About.jsx

RESTAURANT:
- Home.jsx (hero, highlights)
- Menu.jsx (full menu with categories)
- Reservations.jsx (booking form)
- About.jsx

SAAS:
- Home.jsx (hero, features)
- Features.jsx (detailed features)
- Pricing.jsx (pricing tiers)
- About.jsx

PORTFOLIO:
- Home.jsx (hero, featured work)
- Projects.jsx (project gallery)
- About.jsx
- Contact.jsx

CODE REQUIREMENTS:

✅ Use functional components with hooks
✅ Use const/let (never var)
✅ Use === (never ==)
✅ Add semicolons
✅ No unused variables
✅ Proper PropTypes or JSDoc comments
✅ Clean, readable code with proper indentation
✅ Responsive design (mobile-first)
✅ Smooth animations and transitions

CONTENT REQUIREMENTS:

✅ NO placeholder text or "Lorem ipsum"
✅ EVERY page has complete, realistic content
✅ Products/menu items: minimum 8-12 with descriptions and prices
✅ About sections: 3-4 full paragraphs
✅ All images use proper placeholder service (via.placeholder.com or unsplash)

ROUTING SETUP:

App.jsx must include:
- BrowserRouter with Routes
- Route for each page
- Navbar (appears on all pages)
- Footer (appears on all pages)

Example App.jsx structure:
\`\`\`jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import About from './pages/About';
// ... other imports

function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            {/* other routes */}
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
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
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
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
    // Only lint JS/JSX files
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".js")) {
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

  // Add images first if provided
  if (images && images.length > 0) {
    for (const image of images) {
      // Extract base64 data from dataUrl (remove "data:image/png;base64," prefix)
      const base64Match = image.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (base64Match) {
        const mediaType = base64Match[1] as
          | "image/jpeg"
          | "image/png"
          | "image/gif"
          | "image/webp";
        const base64Data = base64Match[2];

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

  // Add the text prompt
  let textPrompt = prompt;
  if (images && images.length > 0) {
    textPrompt = `I've uploaded ${images.length} image(s) above. Please analyze these images for design inspiration. The data URLs for embedding these images are included in the prompt below.\n\n${prompt}`;
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
): Promise<string> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  onProgress?.("Using Gemini AI as fallback");

  const parts: any[] = [];

  // Add images first if provided
  if (images && images.length > 0) {
    for (const image of images) {
      const base64Match = image.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (base64Match) {
        const mimeType = base64Match[1];
        const base64Data = base64Match[2];
        parts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
      }
    }
  }

  // Add text prompt
  let textPrompt = prompt;
  if (images && images.length > 0) {
    textPrompt = `I've uploaded ${images.length} image(s) above. Please analyze these images for design inspiration. The data URLs for embedding these images are included in the prompt below.\n\n${prompt}`;
  }
  parts.push({ text: SYSTEM_PROMPT + "\n\nUser Request: " + textPrompt });

  const result = await model.generateContent(parts);
  const response = result.response;
  return response.text();
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
        // Use Gemini
        text = await generateWithGemini(prompt, images, onProgress);
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
        if (attempts === maxAttempts) {
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
            // Use Gemini for fix
            const fixPrompt = `${prompt}\n\nThe generated code has ESLint errors. Fix them and return the complete JSON again:\n\n${errorSummary}\n\nReturn ONLY valid JSON with all files.`;
            fixText = await generateWithGemini(fixPrompt, images, onProgress);
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
      text = await generateWithGemini(prompt, images, onProgress);
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
    // Try Anthropic first
    return await generateWithLinting(client, prompt, images, onProgress, false);
  } catch (error: any) {
    // If Anthropic fails due to insufficient credits, try Gemini
    if (isInsufficientCreditsError(error)) {
      console.log(
        "Anthropic API has insufficient credits, falling back to Gemini",
      );
      onProgress?.("⚠️ Switching to Gemini AI (Anthropic credits exhausted)");

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
          `Both AI services failed. Anthropic: ${error?.error?.message || error?.message || "Insufficient credits"}. ` +
            `Gemini: ${geminiError?.message || "Unknown error"}. Please check your API keys and try again.`,
        );
      }
    }

    // If not a credits issue, rethrow the original error
    throw error;
  }
}
