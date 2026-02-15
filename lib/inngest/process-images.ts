/**
 * Inngest Function: Image Processing
 *
 * Handles image generation, optimization, and Firebase persistence
 * Currently a no-op but ready for future image processing needs
 */

import { inngest } from "@/lib/inngest-client";

interface GeneratedFile {
  path: string;
  content: string;
}

export const processImagesFunction = inngest.createFunction(
  {
    id: "process-images",
    name: "Process Images",
    retries: 2,
  },
  { event: "app/images.process" },
  async ({ event, step }) => {
    const { files, userId, projectId } = event.data;

    // Step 1: Identify image files
    const imageFiles = await step.run("identify-images", async () => {
      const images = files.filter((f: GeneratedFile) =>
        /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(f.path)
      );
      console.log(`Found ${images.length} image files`);
      return images;
    });

    // Step 2: Process each image (currently no-op)
    const processedFiles = await step.run("process-images", async () => {
      // Future: Optimize, resize, or upload to Firebase Storage
      console.log("Image processing skipped - using direct URLs");
      return files;
    });

    // Step 3: Notify completion via API
    await step.run("notify-completion", async () => {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/inngest/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          event: "images.processed",
          data: {
            files: processedFiles,
            processedCount: imageFiles.length,
          },
        }),
      });
    });

    return {
      files: processedFiles,
      processedCount: imageFiles.length,
    };
  }
);
