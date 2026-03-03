import { NextResponse } from "next/server";

// Dedup concurrent requests for the same sandboxId to prevent double sandbox creation
const inflightRequests = new Map<string, Promise<Response>>();

export async function POST(request: Request) {
  const { sandboxId, files } = await request.json();

  if (!process.env.E2B_API_KEY) {
    return NextResponse.json(
      { error: "E2B_API_KEY not configured" },
      { status: 400 },
    );
  }

  if (!files || Object.keys(files).length === 0) {
    return NextResponse.json(
      { error: "No files provided" },
      { status: 400 },
    );
  }

  // Dedup: if there's already an inflight request for this sandboxId, return that
  const dedupKey = sandboxId || "create-new";
  const existing = inflightRequests.get(dedupKey);
  if (existing) {
    console.log(`[Sandbox Start] Dedup: returning inflight request for ${dedupKey}`);
    return existing;
  }

  const resultPromise = handleStart(sandboxId, files);
  inflightRequests.set(dedupKey, resultPromise);

  try {
    return await resultPromise;
  } finally {
    inflightRequests.delete(dedupKey);
  }
}

async function handleStart(
  sandboxId: string | null,
  files: Record<string, string>,
) {
  try {
    const { Sandbox } = await import("e2b");

    let sandbox: InstanceType<typeof Sandbox>;
    let reused = false;

    if (sandboxId && sandboxId !== "create-new") {
      try {
        sandbox = await Sandbox.connect(sandboxId);
        reused = true;
        console.log(`[Sandbox Start] Reconnected to existing sandbox ${sandboxId}`);
      } catch (connectErr) {
        console.warn(
          `[Sandbox Start] Could not reconnect to sandbox ${sandboxId}. Session expired.`,
          connectErr instanceof Error ? connectErr.message : connectErr,
        );
        return NextResponse.json(
          {
            error:
              "Sandbox session expired. Please refresh to start a new session.",
          },
          { status: 410 },
        );
      }
    } else {
      sandbox = await Sandbox.create("code-interpreter-v1", { timeoutMs: 30 * 60 * 1000 });
      console.log(`[Sandbox Start] Created fresh sandbox ${sandbox.sandboxId}`);
    }

    // Write all project files
    console.log(`[Sandbox Start] Writing ${Object.keys(files).length} files...`);
    for (const [path, content] of Object.entries(files)) {
      await sandbox.files.write(`/home/user/project/${path}`, content);
    }

    // npm install
    console.log("[Sandbox Start] Running npm install...");
    const installResult = await sandbox.commands.run(
      "cd /home/user/project && npm install --legacy-peer-deps --no-audit --no-fund 2>&1 || true",
      { timeoutMs: 180_000 },
    );
    console.log(`[Sandbox Start] npm install exit code: ${installResult.exitCode}`);

    // Start next dev using nohup + file redirect (no pipes that can break)
    // Don't await — the backgrounded process makes the shell return, but sandbox.commands.run
    // may still hang. Fire-and-forget with timeoutMs: 0.
    console.log("[Sandbox Start] Starting next dev on 0.0.0.0:3000...");
    sandbox.commands.run(
      "cd /home/user/project && nohup npx next dev --hostname 0.0.0.0 --port 3000 > /tmp/next-dev.log 2>&1 &",
      { timeoutMs: 0 },
    ).catch(() => {});

    const previewUrl = `https://${sandbox.getHost(3000)}`;
    console.log(`[Sandbox Start] Preview URL: ${previewUrl}`);

    // Wait for Next.js "Ready" in logs
    const pollStart = Date.now();
    const maxWait = 60_000;
    let serverReady = false;

    while (Date.now() - pollStart < maxWait) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const check = await sandbox.commands.run(
          "grep -q 'Ready in' /tmp/next-dev.log 2>/dev/null && echo 'ready' || echo 'waiting'",
          { timeoutMs: 5_000 },
        );
        if (check.stdout.trim() === "ready") {
          serverReady = true;
          console.log(`[Sandbox Start] Next.js ready in ${Date.now() - pollStart}ms`);
          break;
        }
      } catch {}
    }

    if (!serverReady) {
      try {
        const logs = await sandbox.commands.run(
          "tail -20 /tmp/next-dev.log 2>/dev/null || echo 'no logs'",
          { timeoutMs: 5_000 },
        );
        console.error(`[Sandbox Start] Dev server did not start. Logs:\n${logs.stdout}`);
      } catch {}
    }

    if (serverReady) {
      // Verify port is listening
      try {
        const portCheck = await sandbox.commands.run(
          "ss -tln 2>/dev/null | grep ':3000' || echo 'port not found'",
          { timeoutMs: 5_000 },
        );
        console.log(`[Sandbox Start] Port check: ${portCheck.stdout.trim()}`);
      } catch {}

      // Warm up: trigger first page compilation from inside the sandbox
      // Using code-interpreter-v1 template (2048MB RAM) so this won't OOM
      console.log("[Sandbox Start] Warming up (first page compile)...");
      const warmupStart = Date.now();
      try {
        await sandbox.commands.run(
          "curl -s -o /dev/null --connect-timeout 5 --max-time 120 http://localhost:3000/ 2>/dev/null || true",
          { timeoutMs: 130_000 },
        );
        console.log(`[Sandbox Start] Warmup done in ${Date.now() - warmupStart}ms`);
      } catch {
        console.warn(`[Sandbox Start] Warmup timed out after ${Date.now() - warmupStart}ms`);
      }

      // Verify process is still alive and port is still listening after warmup
      try {
        const aliveCheck = await sandbox.commands.run(
          "pgrep -f 'next dev' > /dev/null 2>&1 && echo 'alive' || echo 'dead'",
          { timeoutMs: 5_000 },
        );
        console.log(`[Sandbox Start] Process after warmup: ${aliveCheck.stdout.trim()}`);

        const portRecheck = await sandbox.commands.run(
          "ss -tln 2>/dev/null | grep ':3000' || echo 'port not found'",
          { timeoutMs: 5_000 },
        );
        console.log(`[Sandbox Start] Port after warmup: ${portRecheck.stdout.trim()}`);

        // If process died, restart it
        if (aliveCheck.stdout.trim() === "dead") {
          console.warn("[Sandbox Start] Next.js crashed during warmup — restarting...");
          sandbox.commands.run(
            "cd /home/user/project && nohup npx next dev --hostname 0.0.0.0 --port 3000 > /tmp/next-dev.log 2>&1 &",
            { timeoutMs: 0 },
          ).catch(() => {});
          // Wait for restart
          await new Promise((r) => setTimeout(r, 5000));
        }
      } catch {}
    }

    return NextResponse.json({
      sandboxId: sandbox.sandboxId,
      previewUrl,
      reused,
      serverReady,
    });
  } catch (err) {
    console.error("[Sandbox Start] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start sandbox" },
      { status: 500 },
    );
  }
}
