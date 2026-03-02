/**
 * Inngest API Route
 *
 * Serves all Inngest functions via Next.js API route
 */

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest-client";
import { generateCodeFunction } from "@/lib/inngest/generate-code";
import { processImagesFunction } from "@/lib/inngest/process-images";

// Max timeout per Inngest step invocation (Hobby plan caps at 60s).
export const maxDuration = 60;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateCodeFunction,
    processImagesFunction,
  ],
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
