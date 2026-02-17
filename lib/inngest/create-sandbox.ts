/**
 * Inngest Function: Sandbox Creation
 *
 * Creates and configures Vercel Sandbox cloud environments for Next.js preview
 * Handles file uploads, npm install, and dev server startup
 */

import { inngest } from "@/lib/inngest-client";
import { Sandbox } from "@vercel/sandbox";

function getVercelAuth(): Record<string, string> {
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (token && teamId && projectId) {
    return { token, teamId, projectId };
  }
  return {};
}

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
    name: "Create Sandbox",
    retries: 2,
  },
  { event: "app/sandbox.create" },
  async ({ event, step }) => {
    const { files, userId, projectId } = event.data;

    // Step 1: Create sandbox
    await sendProgress(projectId, "🚀 Creating cloud sandbox environment...");
    const sandboxId = await step.run("create-sandbox", async () => {
      const sandbox = await Sandbox.create({
        ...getVercelAuth(),
        runtime: "node22",
        timeout: 30 * 60 * 1000, // 30 minutes
        ports: [3000],
      });

      console.log(`Sandbox created: ${sandbox.sandboxId}`);
      return sandbox.sandboxId;
    });

    // Step 2: Upload files
    await sendProgress(projectId, "📁 Uploading project files to sandbox...");
    await step.run("upload-files", async () => {
      const sandbox = await Sandbox.get({ sandboxId, ...getVercelAuth() });

      const fileEntries = Object.entries(files).map(([path, content]) => ({
        path,
        content: Buffer.from(content as string),
      }));

      await sandbox.writeFiles(fileEntries);
      console.log(`Uploaded ${fileEntries.length} files`);
    });

    // Step 3: Install dependencies
    await sendProgress(projectId, "📦 Installing dependencies (this might take 1-2 minutes)...");
    await step.run("install-dependencies", async () => {
      const sandbox = await Sandbox.get({ sandboxId, ...getVercelAuth() });

      const result = await sandbox.runCommand({
        cmd: "npm",
        args: ["install"],
        cwd: "/vercel/sandbox",
        signal: AbortSignal.timeout(10 * 60 * 1000),
      });

      if (result.exitCode !== 0) {
        const err = (await result.stderr()) || (await result.stdout());
        throw new Error(`npm install failed (exit ${result.exitCode}): ${err}`);
      }

      console.log("Dependencies installed");
    });

    // Step 4: Start dev server
    await sendProgress(projectId, "⚡ Starting development server...");
    await step.run("start-dev-server", async () => {
      const sandbox = await Sandbox.get({ sandboxId, ...getVercelAuth() });

      await sandbox.runCommand({
        cmd: "npm",
        args: ["run", "dev"],
        cwd: "/vercel/sandbox",
        detached: true,
      });

      console.log("Dev server started");
    });

    // Step 5: Wait for server to be ready
    await sendProgress(projectId, "🔄 Waiting for server to be ready...");
    const url = await step.run("wait-for-ready", async () => {
      const sandbox = await Sandbox.get({ sandboxId, ...getVercelAuth() });

      const url = sandbox.domain(3000);

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
