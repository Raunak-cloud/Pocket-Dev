import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Sandbox } from "@vercel/sandbox";

const SNAPSHOT_FILE = path.join(os.tmpdir(), "pocket-dev-base-snapshot.json");
const SNAPSHOT_MAX_AGE_MS = 6 * 24 * 60 * 60 * 1000; // 6 days (expire before 7-day Vercel limit)

interface SnapshotCache {
  snapshotId: string;
  createdAt: number;
}

/** Read cached snapshot ID if still valid. */
export function getCachedSnapshotId(): string | null {
  try {
    const data: SnapshotCache = JSON.parse(
      fs.readFileSync(SNAPSHOT_FILE, "utf-8"),
    );
    if (Date.now() - data.createdAt < SNAPSHOT_MAX_AGE_MS) {
      return data.snapshotId;
    }
  } catch {
    /* no cache or corrupt */
  }
  return null;
}

function cacheSnapshotId(snapshotId: string): void {
  const tmp = SNAPSHOT_FILE + ".tmp";
  fs.writeFileSync(
    tmp,
    JSON.stringify({ snapshotId, createdAt: Date.now() } satisfies SnapshotCache),
  );
  fs.renameSync(tmp, SNAPSHOT_FILE);
}

// Prevent concurrent snapshot creation
let inflight: Promise<string | null> | null = null;

/**
 * Create a base snapshot with common Next.js dependencies pre-installed.
 * The snapshot includes node_modules so future sandboxes skip the long npm install.
 * Returns the snapshotId or null on failure.
 */
export function ensureBaseSnapshot(
  auth: { token: string; teamId: string; projectId: string } | Record<string, never>,
): Promise<string | null> {
  const cached = getCachedSnapshotId();
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;

  inflight = createBaseSnapshot(auth).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function createBaseSnapshot(
  auth: { token: string; teamId: string; projectId: string } | Record<string, never>,
): Promise<string | null> {
  console.log("[Snapshot] Creating base snapshot with pre-installed deps...");

  try {
    const sandbox = await Sandbox.create({
      ...auth,
      runtime: "node22",
      timeout: 15 * 60 * 1000,
      ports: [3000],
    });

    // Base package.json covering the most common generated-app dependencies.
    const basePkg = JSON.stringify(
      {
        name: "generated-nextjs-app",
        version: "0.1.0",
        private: true,
        scripts: {
          dev: "next dev",
          build: "next build",
          start: "next start",
          lint: "next lint",
        },
        dependencies: {
          next: "^14.0.0",
          react: "^18.2.0",
          "react-dom": "^18.2.0",
          "lucide-react": "^0.294.0",
          tailwindcss: "3.4.17",
          postcss: "^8.4.31",
          autoprefixer: "^10.4.16",
          "@supabase/supabase-js": "^2.57.4",
          "@supabase/ssr": "^0.7.0",
        },
        devDependencies: {
          "@types/node": "^20",
          "@types/react": "^18",
          "@types/react-dom": "^18",
          typescript: "^5",
        },
      },
      null,
      2,
    );

    await sandbox.writeFiles([
      { path: "package.json", content: Buffer.from(basePkg) },
    ]);

    const result = await sandbox.runCommand({
      cmd: "npm",
      args: [
        "install",
        "--include=dev",
        "--no-audit",
        "--no-fund",
        "--progress=false",
      ],
      cwd: "/vercel/sandbox",
      env: { CI: "true", npm_config_update_notifier: "false" },
      signal: AbortSignal.timeout(10 * 60 * 1000),
    });

    if (result.exitCode !== 0) {
      const err = (await result.stderr()) || (await result.stdout());
      throw new Error(`npm install failed (exit ${result.exitCode}): ${err}`);
    }

    // snapshot() captures filesystem (including node_modules) and stops the sandbox.
    const snapshot = await sandbox.snapshot();
    const id = snapshot.snapshotId;
    cacheSnapshotId(id);
    console.log(`[Snapshot] Base snapshot created: ${id}`);
    return id;
  } catch (err) {
    console.error("[Snapshot] Failed to create base snapshot:", err);
    return null;
  }
}
