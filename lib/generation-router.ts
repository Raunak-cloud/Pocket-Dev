/**
 * Generation Router — entry point for website generation.
 *
 * Template-based: AI generates ~3K config → deterministic compile → inject images
 */

import { generateConfig, editConfig } from "./config-generator";
import { compileTemplate } from "./templates/compiler";
import type { WebsiteConfig, GeneratedFile, UploadedImage } from "./templates/types";
import { resolveImagePlaceholders, generateLogo } from "./image-generator";
import { validateCustomSections } from "./eslint-lint";

export type { UploadedImage };

export interface TemplateGeneratedProject {
  files: GeneratedFile[];
  dependencies: Record<string, string>;
  lintReport: {
    passed: boolean;
    errors: number;
    warnings: number;
    fileResults: never[];
  };
  attempts: number;
  config: WebsiteConfig;
  imageCache: Record<string, string>;
}

/**
 * Main entry point: generate a website from a user prompt.
 *
 * 1. AI generates a config (fast, cheap)
 * 2. Compile deterministically
 * 3. Inject Replicate images
 */
export async function generateProject(
  prompt: string,
  images?: UploadedImage[],
  onProgress?: (message: string) => void,
): Promise<TemplateGeneratedProject> {
  // Step 1: Generate config
  onProgress?.("Designing your website...");
  const config = await generateConfig(prompt, images, onProgress);
  console.log(`📋 Config OK: templateId=${config.templateId}, sections=${config.sections.length}, pages=${config.pages.length}`);

  // Step 1.5: Validate custom sections (lint AI-generated code)
  config.sections = await validateCustomSections(config.sections);
  for (const page of config.pages) {
    page.sections = await validateCustomSections(page.sections);
  }

  // Step 2: Generate logo if user didn't provide one
  if (!config.business.logoUrl) {
    onProgress?.("Generating logo...");
    const logoUrl = await generateLogo(
      config.business.name,
      config.templateId,
      config.theme.primary,
    );
    if (logoUrl) {
      config.business.logoUrl = logoUrl;
    }
  }

  // Step 3: Compile template (deterministic, instant)
  onProgress?.("Building your website...");
  const compiled = compileTemplate(config);
  console.log(`🏗️ Compiled ${compiled.files.length} files successfully`);

  // Step 4: Inject images
  try {
    onProgress?.("Generating AI images...");
    const { files: filesWithImages, imageCache } = await injectImagesIntoFiles(compiled.files);

    console.log("✅ Template generation complete");
    return {
      files: filesWithImages,
      dependencies: compiled.dependencies,
      lintReport: { passed: true, errors: 0, warnings: 0, fileResults: [] },
      attempts: 1,
      config,
      imageCache,
    };
  } catch (imageError) {
    // Image injection failed but compilation succeeded — return without images
    console.error("⚠️ Image injection failed, returning without images:", imageError);
    return {
      files: compiled.files,
      dependencies: compiled.dependencies,
      lintReport: { passed: true, errors: 0, warnings: 0, fileResults: [] },
      attempts: 1,
      config,
      imageCache: {},
    };
  }
}

/**
 * Edit a project. Updates config + recompiles.
 * If no config exists (legacy project), generates a fresh config from the edit prompt.
 */
export async function editProject(
  editPrompt: string,
  currentConfig: WebsiteConfig | undefined,
  currentFiles: GeneratedFile[],
  onProgress?: (message: string) => void,
  imageCache?: Record<string, string>,
): Promise<TemplateGeneratedProject> {
  let newConfig: WebsiteConfig;
  let shouldFullRegenerate = false;

  if (currentConfig) {
    // Smart edit: classifies edit type and chooses strategy
    const { smartEdit } = await import("./smart-edit-router");
    const result = await smartEdit(currentConfig, editPrompt, onProgress);

    if (result.shouldRegenerate) {
      // Major changes detected - regenerate from scratch
      onProgress?.("Major changes detected, regenerating...");
      newConfig = await generateConfig(editPrompt, undefined, onProgress);
      shouldFullRegenerate = true;
    } else {
      // Surgical edit applied
      newConfig = result.config;
    }
  } else {
    // No config (legacy project) — generate a fresh config from the edit prompt
    onProgress?.("Redesigning your website...");
    newConfig = await generateConfig(editPrompt, undefined, onProgress);
    shouldFullRegenerate = true;
  }

  // Validate custom sections (lint AI-generated code)
  newConfig.sections = await validateCustomSections(newConfig.sections);
  for (const page of newConfig.pages) {
    page.sections = await validateCustomSections(page.sections);
  }

  // Generate logo if none exists
  if (!newConfig.business.logoUrl) {
    onProgress?.("Generating logo...");
    const logoUrl = await generateLogo(
      newConfig.business.name,
      newConfig.templateId,
      newConfig.theme.primary,
    );
    if (logoUrl) {
      newConfig.business.logoUrl = logoUrl;
    }
  }

  onProgress?.("Rebuilding...");
  const compiled = compileTemplate(newConfig);

  try {
    onProgress?.("Generating AI images...");
    const { files: filesWithImages, imageCache: newCache } = await injectImagesIntoFiles(compiled.files, imageCache);

    return {
      files: filesWithImages,
      dependencies: compiled.dependencies,
      lintReport: { passed: true, errors: 0, warnings: 0, fileResults: [] },
      attempts: 1,
      config: newConfig,
      imageCache: newCache,
    };
  } catch (imageError) {
    console.error("⚠️ Image injection failed, returning without images:", imageError);
    return {
      files: compiled.files,
      dependencies: compiled.dependencies,
      lintReport: { passed: true, errors: 0, warnings: 0, fileResults: [] },
      attempts: 1,
      config: newConfig,
      imageCache: imageCache ?? {},
    };
  }
}

// ── Image injection ─────────────────────────────────────────────

async function injectImagesIntoFiles(
  files: GeneratedFile[],
  existingCache?: Record<string, string>,
): Promise<{ files: GeneratedFile[]; imageCache: Record<string, string> }> {
  // Step 1: Find all unique REPLICATE_IMG_N keys across all files
  const seen = new Set<string>();
  const altMap = new Map<string, string>();

  for (const file of files) {
    const keyRe = /REPLICATE_IMG_(\d+)/gi;
    let m;
    while ((m = keyRe.exec(file.content)) !== null) {
      seen.add(m[0]);
    }

    // Extract alt text from <img> tags
    const imgRe = /<img[^>]*>/gi;
    let tag;
    while ((tag = imgRe.exec(file.content)) !== null) {
      const srcM = tag[0].match(/src=\{?["'](REPLICATE_IMG_\d+)["']\}?/i);
      if (!srcM) continue;
      const key = srcM[1];
      if (altMap.has(key)) continue;
      const altM = tag[0].match(/alt=\{?["']([^"'}]*)["']\}?/i);
      if (altM && altM[1].length > 5) {
        altMap.set(key, altM[1]);
      }
    }
  }

  if (seen.size === 0) {
    console.log("No REPLICATE_IMG placeholders found in compiled files");
    return { files, imageCache: existingCache ?? {} };
  }

  // Build placeholder list sorted by number
  const sortedKeys = Array.from(seen).sort((a, b) => {
    const na = parseInt(a.match(/\d+/)![0]);
    const nb = parseInt(b.match(/\d+/)![0]);
    return na - nb;
  });

  const placeholders = sortedKeys.map((key) => ({
    key,
    alt: altMap.get(key) || "a professional photograph, high quality, modern design",
  }));

  console.log(`🎨 Found ${placeholders.length} image placeholders in compiled files`);
  placeholders.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.key} - "${p.alt.substring(0, 80)}..."`);
  });

  // Generate all images via Replicate (with cache for unchanged descriptions)
  const urlMap = await resolveImagePlaceholders(placeholders, existingCache);

  console.log(`✅ Resolved ${urlMap.size}/${placeholders.length} images`);

  // Build updated cache: alt → URL
  const imageCache: Record<string, string> = { ...(existingCache ?? {}) };
  for (const { key, alt } of placeholders) {
    const url = urlMap.get(key);
    if (url) {
      imageCache[alt] = url;
    }
  }

  // Replace placeholders in all files
  const updatedFiles = files.map((file) => {
    let content = file.content;
    for (const [key, url] of urlMap) {
      content = content.split(key).join(url);
    }
    return { ...file, content };
  });

  return { files: updatedFiles, imageCache };
}
