/**
 * Inngest API Route
 *
 * Serves all Inngest functions via Next.js API route
 */

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest-client";
import { generateCodeFunction } from "@/lib/inngest/generate-code";
import { processImagesFunction } from "@/lib/inngest/process-images";

// Allow up to 5 minutes per Inngest step invocation.
// The E2B typecheck step (sandbox create + npm install + tsc) needs ~2-3 min.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateCodeFunction,
    processImagesFunction,
  ],
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
