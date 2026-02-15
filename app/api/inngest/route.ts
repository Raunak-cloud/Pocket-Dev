/**
 * Inngest API Route
 *
 * Serves all Inngest functions via Next.js API route
 */

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest-client";
import { generateCodeFunction } from "@/lib/inngest/generate-code";
import { createSandboxFunction } from "@/lib/inngest/create-sandbox";
import { processImagesFunction } from "@/lib/inngest/process-images";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateCodeFunction,
    createSandboxFunction,
    processImagesFunction,
  ],
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
