import { NextRequest } from "next/server";
import { generateWebsite } from "@/lib/website-generator";

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        // Stream real-time progress from the generator
        const website = await generateWebsite(prompt, (message) => {
          send({ type: "progress", message });
        });

        send({ type: "result", data: { html: website.html } });
      } catch (error) {
        send({
          type: "error",
          message:
            error instanceof Error ? error.message : "Failed to generate website",
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
