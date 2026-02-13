/**
 * Smart Edit Router - Classifies edits and routes to appropriate strategy
 *
 * Fixes:
 * 1. Logo changes affecting all images
 * 2. Drastic changes breaking the site
 * 3. Vague prompts causing unintended changes
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { WebsiteConfig } from "./templates/types";

const MODEL = "gemini-3-flash-preview";

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not found");
  }
  return new GoogleGenerativeAI(apiKey);
}

// ── Edit Classification ──────────────────────────────────────────

type EditType =
  | "logo-only"           // Only logo change
  | "styling"             // Colors, fonts, theme
  | "content"             // Text, copy, headlines
  | "structure-minor"     // Add/remove/reorder sections
  | "structure-major"     // Complete redesign
  | "images"              // Image descriptions
  | "contact-info"        // Phone, email, address
  | "navigation";         // Nav links, menu items

interface EditClassification {
  type: EditType;
  scope: "narrow" | "moderate" | "wide";
  shouldRegenerate: boolean;
  targetFields: string[];
  reasoning: string;
}

/**
 * Step 1: Classify the edit to determine strategy
 */
export async function classifyEdit(
  editPrompt: string,
  currentConfig: WebsiteConfig
): Promise<EditClassification> {
  const client = getGeminiClient();

  const classificationPrompt = `You are an edit classifier for a website builder.

CURRENT WEBSITE:
- Template: ${currentConfig.templateId}
- Business: ${currentConfig.business.name}
- Theme: ${currentConfig.theme.background} with ${currentConfig.theme.primary} primary color
- Sections: ${currentConfig.sections.map(s => s.type).join(", ")}

USER EDIT REQUEST: "${editPrompt}"

Classify this edit into ONE of these types:

1. "logo-only" - ONLY changing the logo/brand image (e.g., "change logo", "update brand image")
2. "styling" - Colors, fonts, theme changes (e.g., "make it dark", "change colors to blue")
3. "content" - Text, headlines, descriptions (e.g., "update hero text", "change tagline")
4. "structure-minor" - Add/remove/reorder 1-2 sections (e.g., "add testimonials", "remove pricing")
5. "structure-major" - Complete redesign, template change (e.g., "make it a SaaS page", "totally redesign")
6. "images" - Non-logo images (e.g., "change hero image", "update gallery photos")
7. "contact-info" - Phone, email, address (e.g., "update phone number")
8. "navigation" - Menu links (e.g., "add About link to nav")

Respond ONLY with valid JSON:
{
  "type": "<edit-type>",
  "scope": "narrow" | "moderate" | "wide",
  "shouldRegenerate": true/false,
  "targetFields": ["business.logoUrl", ...],
  "reasoning": "brief explanation"
}

RULES:
- If changing template type or completely redesigning: structure-major + shouldRegenerate=true
- If only logo: logo-only + targetFields=["business.logoUrl"]
- If 3+ major changes: structure-major + shouldRegenerate=true
- If adding/removing many sections: structure-major + shouldRegenerate=true`;

  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.3, // Low temp for classification
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: classificationPrompt }] }],
  });

  const classification = JSON.parse(result.response.text()) as EditClassification;

  console.log(`📊 Edit classified as: ${classification.type} (${classification.scope})`);
  console.log(`   Target fields: ${classification.targetFields.join(", ")}`);
  console.log(`   Regenerate: ${classification.shouldRegenerate}`);

  return classification;
}

// ── Surgical Edit (Narrow Changes) ──────────────────────────────

/**
 * Step 2a: Surgical edit for narrow-scope changes
 * Only touches specific fields, leaves everything else intact
 */
export async function surgicalEdit(
  currentConfig: WebsiteConfig,
  editPrompt: string,
  classification: EditClassification
): Promise<WebsiteConfig> {
  const client = getGeminiClient();

  const surgicalPrompt = `You are editing a website configuration. Make ONLY the requested change.

CURRENT CONFIG:
${JSON.stringify(currentConfig, null, 2)}

USER REQUEST: "${editPrompt}"

EDIT TYPE: ${classification.type}
TARGET FIELDS: ${classification.targetFields.join(", ")}

CRITICAL RULES:
1. ONLY modify fields in TARGET FIELDS list
2. If changing logo: ONLY change business.logoUrl (NOT imageDescriptions)
3. If changing theme colors: ONLY change theme.primary/secondary/accent
4. If changing content: ONLY change text fields (headlines, descriptions)
5. Keep ALL sections, pages, structure identical unless explicitly changing structure
6. Do NOT regenerate image descriptions unless user explicitly asks
7. Preserve all IDs, variants, and structure

Return the COMPLETE updated config with MINIMAL changes.`;

  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      maxOutputTokens: 16384,
      temperature: 0.3, // Low temp for precision
      responseMimeType: "application/json",
    },
  });

  console.log(`🔧 Performing surgical edit on: ${classification.targetFields.join(", ")}`);

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: surgicalPrompt }] }],
  });

  const updatedConfig = JSON.parse(result.response.text()) as WebsiteConfig;

  // Verify only target fields changed
  const changes = detectChanges(currentConfig, updatedConfig);
  console.log(`   Changed fields: ${changes.join(", ")}`);

  return updatedConfig;
}

// ── Helper: Detect Changes ──────────────────────────────────────

function detectChanges(oldConfig: any, newConfig: any, path = ""): string[] {
  const changes: string[] = [];

  for (const key in newConfig) {
    const fullPath = path ? `${path}.${key}` : key;

    if (typeof newConfig[key] === "object" && newConfig[key] !== null && !Array.isArray(newConfig[key])) {
      changes.push(...detectChanges(oldConfig[key] || {}, newConfig[key], fullPath));
    } else if (JSON.stringify(oldConfig[key]) !== JSON.stringify(newConfig[key])) {
      changes.push(fullPath);
    }
  }

  return changes;
}

// ── Export Main Function ─────────────────────────────────────────

/**
 * Smart edit that classifies first, then chooses strategy
 */
export async function smartEdit(
  currentConfig: WebsiteConfig,
  editPrompt: string,
  onProgress?: (message: string) => void,
  uploadedImages?: Array<{ url: string; name: string }>
): Promise<{ config: WebsiteConfig; shouldRegenerate: boolean }> {
  // Step 1: Classify edit
  onProgress?.("Analyzing edit request...");
  const classification = await classifyEdit(editPrompt, currentConfig);

  // Step 2: Check for fast-path edits (no AI needed)
  if (classification.type === "logo-only") {
    onProgress?.("Updating logo...");
    const { updateLogo, extractLogoUrl } = await import("./field-updaters");
    const logoUrl = extractLogoUrl(editPrompt, uploadedImages);

    if (logoUrl) {
      console.log(`🎨 Fast-path logo update: ${logoUrl}`);
      return { config: updateLogo(currentConfig, logoUrl), shouldRegenerate: false };
    }
    // If can't extract URL, fall through to AI
  }

  // Step 3: Route to appropriate strategy
  if (classification.shouldRegenerate) {
    onProgress?.("Major changes detected, regenerating from scratch...");
    console.log(`⚠️  Major edit detected, should regenerate site from scratch`);
    return { config: currentConfig, shouldRegenerate: true };
  } else {
    onProgress?.("Applying surgical changes...");
    const updatedConfig = await surgicalEdit(currentConfig, editPrompt, classification);
    return { config: updatedConfig, shouldRegenerate: false };
  }
}
