/**
 * Inngest Function: Image Generation
 *
 * Generates images via Replicate with global concurrency control.
 * Invoked by generate-code via step.invoke() so that all users share
 * a single throttled queue (concurrency: 5 global, 2 per-user).
 */

import { inngest } from "@/lib/inngest-client";
import Replicate from "replicate";
import {
  type ImageReference,
  type ImagePromptResult,
  type GeneratedFile,
  collectImageReferences,
  generateImagePrompts,
  fallbackPromptGeneration,
  resolveImageGenConfig,
  getAspectRatioDimensions,
  generateReplicateImageWithRetry,
  uploadImageFromUrl,
  ensureBucketExists,
  createFallbackImageDataUri,
  buildSiteContentSample,
  applyReplacements,
  lockExistingImageSourcesFromUrls,
} from "@/lib/server/persist-generated-images";
import { getInngestStatusApiUrl } from "@/lib/server/app-base-url";

async function sendProgress(projectId: string, message: string) {
  try {
    await fetch(getInngestStatusApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        event: "progress",
        progress: message,
      }),
    });
  } catch (err) {
    console.error("[generate-images] Failed to send progress:", err);
  }
}

export const generateImagesFunction = inngest.createFunction(
  {
    id: "generate-images",
    name: "Generate Images",
    retries: 2,
    cancelOn: [
      {
        event: "app/generate.cancelled",
        if: "async.data.projectId == event.data.projectId",
      },
    ],
    concurrency: [
      { limit: 5 },                            // Global max
      { limit: 2, key: "event.data.userId" },  // Per-user fairness
    ],
  },
  { event: "app/images.generate" },
  async ({ event, step }) => {
    const {
      files,
      userId,
      projectId,
      originalPrompt,
      detectedTheme,
      preserveExistingImages,
      previousImageUrls,
      maxImages,
    } = event.data as {
      files: GeneratedFile[];
      userId: string;
      projectId: string;
      originalPrompt?: string;
      detectedTheme?: string;
      preserveExistingImages?: boolean;
      previousImageUrls?: string[];
      maxImages?: number | null;
    };

    // Step 1: Lock existing images if this is an edit with preservation
    const lockedFiles = await step.run("lock-existing-images", async () => {
      if (preserveExistingImages && previousImageUrls?.length) {
        console.log(
          `[generate-images] Locking ${previousImageUrls.length} existing image sources`,
        );
        return lockExistingImageSourcesFromUrls(files, previousImageUrls);
      }
      return files;
    });

    // Step 2: Collect image references
    const imageRefs = await step.run("collect-image-refs", async () => {
      const refs = collectImageReferences(lockedFiles);
      console.log(`[generate-images] Found ${refs.length} images to generate`);
      return refs;
    });

    if (imageRefs.length === 0) {
      return { replacements: {} as Record<string, string>, files: lockedFiles };
    }

    const normalizedMaxImages =
      typeof maxImages === "number" && Number.isFinite(maxImages) && maxImages > 0
        ? Math.floor(maxImages)
        : null;
    const refsToGenerate =
      normalizedMaxImages && imageRefs.length > normalizedMaxImages
        ? imageRefs.slice(0, normalizedMaxImages)
        : imageRefs;
    const overflowRefs =
      normalizedMaxImages && imageRefs.length > normalizedMaxImages
        ? imageRefs.slice(normalizedMaxImages)
        : [];
    const replacements: Record<string, string> = {};

    if (overflowRefs.length > 0) {
      await sendProgress(
        projectId,
        `Image quota reached: generating ${refsToGenerate.length}/${imageRefs.length}; using deterministic placeholders for ${overflowRefs.length} overflow image(s).`,
      );
      overflowRefs.forEach((ref, i) => {
        replacements[ref.source] = createFallbackImageDataUri(
          ref.source,
          ref.altText || "Generated placeholder visual",
          refsToGenerate.length + i + 1,
        );
      });
    }

    // Step 3: Check for Replicate API key — fallback to SVGs if missing
    const apiKey = process.env.REPLICATE_API_TOKEN;
    if (!apiKey) {
      console.warn(
        "[generate-images] REPLICATE_API_TOKEN not configured. Using SVG fallbacks.",
      );
      const fallbackReplacements = await step.run("svg-fallbacks", async () => {
        const map: Record<string, string> = {};
        imageRefs.forEach((ref: ImageReference, i: number) => {
          map[ref.source] = createFallbackImageDataUri(
            ref.source,
            ref.altText || "",
            i + 1,
          );
        });
        return map;
      });
      const replacementMap = new Map(Object.entries(fallbackReplacements));
      return {
        replacements: fallbackReplacements,
        files: applyReplacements(lockedFiles, replacementMap),
      };
    }

    const config = resolveImageGenConfig();

    // Step 4: Enhance prompts via Gemini LLM (or fallback)
    const prompts = await step.run("enhance-prompts", async () => {
      if (config.enableLlmPromptEnhancement) {
        const siteContentSample = buildSiteContentSample(lockedFiles);
        return await generateImagePrompts(refsToGenerate as ImageReference[], {
          originalPrompt: originalPrompt || "",
          detectedTheme,
          isUserProvidedPrompt: false,
          siteContentSample,
        });
      }
      return fallbackPromptGeneration(refsToGenerate as ImageReference[]);
    });

    // Step 5: Ensure storage bucket exists
    const bucket =
      process.env.SUPABASE_GENERATED_IMAGES_BUCKET ||
      process.env.SUPABASE_STORAGE_BUCKET ||
      "generated-images";

    await step.run("ensure-bucket", async () => {
      await ensureBucketExists(bucket);
    });

    // Steps 6-N: Generate each image as its own step (keeps each under 60s)
    const replicate = new Replicate({ auth: apiKey });

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i] as ImagePromptResult;
      const imageResult = await step.run(
        `generate-image-${i}`,
        async () => {
          await sendProgress(
            projectId,
            `Generating image ${i + 1}/${prompts.length}...`,
          );

          const dimensions = getAspectRatioDimensions(
            prompt.aspectRatio,
            config,
          );

          try {
            const replicateUrl = await generateReplicateImageWithRetry({
              replicate,
              prompt: prompt.prompt,
              source: prompt.source,
              width: dimensions.width,
              height: dimensions.height,
              model: config.replicateModel,
              maxRetries: config.maxRetries,
              retryDelayMs: config.retryDelayMs,
            });

            const storedUrl = await uploadImageFromUrl({
              imageUrl: replicateUrl,
              userId,
              bucket,
              index: i + 1,
            });

            console.log(
              `[generate-images] Generated ${i + 1}/${prompts.length}: ${prompt.source}`,
            );
            return { source: prompt.source, url: storedUrl, success: true };
          } catch (error) {
            console.error(
              `[generate-images] Failed ${i + 1}/${prompts.length} for "${prompt.source}":`,
              error,
            );
            return {
              source: prompt.source,
              url: createFallbackImageDataUri(
                prompt.source,
                prompt.prompt,
                i + 1,
              ),
              success: false,
            };
          }
        },
      );

      replacements[imageResult.source] = imageResult.url;
    }

    // Apply all replacements to files
    const replacementMap = new Map(Object.entries(replacements));
    const finalFiles = applyReplacements(lockedFiles, replacementMap);

    const fallbackCount = Object.values(replacements).filter((u) =>
      u.startsWith("data:image/svg"),
    ).length;
    console.log(
      `[generate-images] Complete: ${Object.keys(replacements).length}/${imageRefs.length} resolved (${fallbackCount} fallbacks)`,
    );

    return { replacements, files: finalFiles };
  },
);
