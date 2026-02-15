/**
 * Inngest Function: E2B Sandbox Creation
 *
 * Creates and configures E2B cloud sandboxes for Next.js preview
 * Handles file uploads, npm install, and dev server startup
 */

import { inngest } from "@/lib/inngest-client";
import { Sandbox } from "@e2b/code-interpreter";

async function sendProgress(projectId: string, message: string) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/inngest/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        event: "progress",
        progress: message,
      }),
    });
  } catch (err) {
    console.error("Failed to send progress:", err);
  }
}

export const createSandboxFunction = inngest.createFunction(
  {
    id: "create-sandbox",
    name: "Create E2B Sandbox",
    retries: 2,
  },
  { event: "app/sandbox.create" },
  async ({ event, step }) => {
    const { files, userId, projectId } = event.data;

    // Step 1: Create sandbox
    await sendProgress(projectId, "🚀 Creating cloud sandbox environment...");
    const sandboxId = await step.run("create-sandbox", async () => {
      const sandbox = await Sandbox.create({
        apiKey: process.env.E2B_API_KEY!,
        timeoutMs: 15 * 60 * 1000, // 15 minutes
      });

      console.log(`Sandbox created: ${sandbox.sandboxId}`);
      return sandbox.sandboxId;
    });

    // Step 2: Upload files
    await sendProgress(projectId, "📁 Uploading project files to sandbox...");
    await step.run("upload-files", async () => {
      const sandbox = await Sandbox.connect(sandboxId, {
        apiKey: process.env.E2B_API_KEY!,
      });

      const fileEntries = Object.entries(files).map(([path, content]) => ({
        path: `/home/user/${path}`,
        data: content as string,
      }));

      await sandbox.files.write(fileEntries);
      console.log(`Uploaded ${fileEntries.length} files`);
    });

    // Step 3: Install dependencies
    await sendProgress(projectId, "📦 Installing dependencies (this might take 1-2 minutes)...");
    await step.run("install-dependencies", async () => {
      const sandbox = await Sandbox.connect(sandboxId, {
        apiKey: process.env.E2B_API_KEY!,
      });

      await sandbox.commands.run("npm install", {
        cwd: "/home/user",
        timeoutMs: 10 * 60 * 1000, // 10 minutes timeout for npm install
      });

      console.log("Dependencies installed");
    });

    // Step 4: Start dev server
    await sendProgress(projectId, "⚡ Starting development server...");
    await step.run("start-dev-server", async () => {
      const sandbox = await Sandbox.connect(sandboxId, {
        apiKey: process.env.E2B_API_KEY!,
      });

      await sandbox.commands.run("npm run dev", {
        cwd: "/home/user",
        background: true,
      });

      console.log("Dev server started");
    });

    // Step 5: Wait for server to be ready
    await sendProgress(projectId, "🔄 Waiting for server to be ready...");
    const url = await step.run("wait-for-ready", async () => {
      const sandbox = await Sandbox.connect(sandboxId, {
        apiKey: process.env.E2B_API_KEY!,
      });

      const host = sandbox.getHost(3000);
      const url = `https://${host}`;

      // Poll until server responds
      let ready = false;
      for (let i = 0; i < 60; i++) {
        try {
          const res = await fetch(url, { method: "HEAD" });
          if (res.ok) {
            ready = true;
            break;
          }
        } catch {
          // Server not ready yet
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (!ready) {
        throw new Error("Dev server timeout after 60 seconds");
      }

      console.log(`Server ready at ${url}`);
      return url;
    });

    // Step 6: Notify completion via API
    await sendProgress(projectId, "✅ Sandbox ready! Launching preview...");
    await step.run("notify-completion", async () => {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/inngest/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          event: "sandbox.ready",
          data: {
            sandboxId,
            url,
          },
        }),
      });
    });

    return {
      sandboxId,
      url,
    };
  }
);
