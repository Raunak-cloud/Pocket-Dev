/**
 * Generation Router — entry point for website generation.
 *
 * Full AI Code Generation: AI generates complete Next.js 15 projects from scratch
 * Uses shadcn/ui, Framer Motion, and Tailwind CSS
 */

import { generateFullCode, editFullCode } from "./ai-code-generator";
import type { GeneratedFile } from "./website-config-types";

export interface AIGeneratedProject {
  files: GeneratedFile[];
  dependencies: Record<string, string>;
  lintReport: {
    passed: boolean;
    errors: number;
    warnings: number;
  };
  attempts: number;
}

/**
 * Main entry point: generate a website from a user prompt.
 *
 * Full AI code generation:
 * 1. AI generates complete Next.js 15 project
 * 2. Includes shadcn/ui, Framer Motion, parallax effects
 * 3. Validates with ESLint and auto-fixes
 */
export async function generateProject(
  prompt: string,
  images?: any[], // Optional uploaded images
  onProgress?: (message: string) => void,
): Promise<AIGeneratedProject> {
  console.log("🤖 Starting full AI code generation...");

  // Generate complete project with AI
  const result = await generateFullCode(prompt, onProgress);

  console.log(
    `✅ AI generation complete - ${result.files.length} files, ${result.attempts} attempt(s)`
  );

  return result;
}

/**
 * Edit a project using full AI code generation.
 */
export async function editProject(
  editPrompt: string,
  currentConfig: any, // Deprecated, kept for compatibility
  currentFiles: GeneratedFile[],
  onProgress?: (message: string) => void,
): Promise<AIGeneratedProject> {
  console.log("🤖 Editing project with AI...");

  // Use AI to edit the full codebase
  const result = await editFullCode(currentFiles, editPrompt, onProgress);

  console.log(`✅ AI edit complete - ${result.files.length} files updated`);

  return result;
}

// Template system removed - now using full AI code generation
