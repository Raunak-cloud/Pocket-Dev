import { NextRequest, NextResponse } from "next/server";
import {
  acquireAuthConfigForBindingKey,
  getAuthConfigForBindingKey,
} from "@/lib/supabase-project-pool";
import { POCKET_ANALYTICS_COMPONENT } from "@/lib/analytics-tracking-script";

interface ProjectFile {
  path: string;
  content: string;
}

const VERCEL_TOKEN = process.env.VERCEL_TOKEN || "";
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || "";

function vercelHeaders() {
  return {
    Authorization: `Bearer ${VERCEL_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function teamQuery() {
  return VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : "";
}

function parseDotEnvContent(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1);
  }
  return env;
}

function projectLikelyNeedsManagedAuth(files: ProjectFile[]): boolean {
  return files.some((file) => {
    if (/^app\/api\/auth\/.+/.test(file.path)) return true;
    if (/^lib\/supabase\/.+/.test(file.path)) return true;
    return /@supabase\/supabase-js|@supabase\/ssr|supabase\.auth|NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY/i.test(
      file.content,
    );
  });
}

function hasAuthentication(files: ProjectFile[]): boolean {
  return files.some(
    (f) =>
      f.content.includes("@supabase/supabase-js") ||
      f.content.includes("supabase.auth") ||
      f.content.includes("createClient("),
  );
}

// ── Production file builder ──────────────────────────────────────

function buildProductionFiles(
  files: ProjectFile[],
  dependencies: Record<string, string>,
): Map<string, string> {
  const result = new Map<string, string>();

  const managedConfigFiles = new Set([
    "package.json",
    "tsconfig.json",
    "next.config.js",
    "next.config.ts",
    "tailwind.config.js",
    "tailwind.config.ts",
    "postcss.config.js",
    "postcss.config.mjs",
    ".env.local",
    ".env",
  ]);

  let aiDeps: Record<string, string> = {};
  const aiPkgFile = files.find((f) => f.path === "package.json");
  if (aiPkgFile) {
    try {
      aiDeps = JSON.parse(aiPkgFile.content).dependencies || {};
    } catch {
      // ignore malformed package.json
    }
  }

  // Include source files, skip managed config files
  for (const f of files) {
    const normalizedPath = f.path.replace(/\\/g, "/").replace(/^\.\//, "");
    if (managedConfigFiles.has(normalizedPath)) continue;
    result.set(normalizedPath, f.content);
  }

  // Generate package.json
  result.set(
    "package.json",
    JSON.stringify(
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
          ...aiDeps,
          ...dependencies,
          next: "^16.1.6",
          react: "^19.2.3",
          "react-dom": "^19.2.3",
          "lucide-react": "^0.468.0",
          tailwindcss: "^3.3.0",
          postcss: "^8.4.31",
          autoprefixer: "^10.4.16",
          ...(hasAuthentication(files)
            ? { "@supabase/supabase-js": "^2.57.4", "@supabase/ssr": "^0.7.0" }
            : {}),
        },
        devDependencies: {
          "@types/node": "^20",
          "@types/react": "^19",
          "@types/react-dom": "^19",
          typescript: "^5",
        },
      },
      null,
      2,
    ),
  );

  result.set(
    "next.config.js",
    `/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};
module.exports = nextConfig;`,
  );

  result.set(
    "tailwind.config.js",
    `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: '#2563eb', 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a' },
        secondary: { DEFAULT: '#7c3aed', 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95' },
        accent: { DEFAULT: '#f59e0b', 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f' },
      },
    },
  },
  plugins: [],
}`,
  );

  result.set(
    "postcss.config.js",
    `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`,
  );

  result.set(
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          incremental: true,
          plugins: [{ name: "next" }],
          paths: {
            "@/*": ["./*"],
          },
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        exclude: ["node_modules"],
      },
      null,
      2,
    ),
  );

  // Image proxy route (same as sandbox-utils.ts)
  result.set(
    "app/api/image-proxy/route.ts",
    `import { NextRequest, NextResponse } from "next/server";

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const encoded = request.nextUrl.searchParams.get("url");
  if (!encoded) {
    return badRequest("Missing url query parameter");
  }

  let target: URL;
  try {
    target = new URL(encoded);
  } catch {
    return badRequest("Invalid image URL");
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return badRequest("Only http/https image URLs are allowed");
  }
  if (BLOCKED_HOSTS.has(target.hostname)) {
    return badRequest("Blocked host");
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), { redirect: "follow" });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch upstream image" },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: \`Upstream image request failed with status \${upstream.status}\` },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return NextResponse.json(
      { error: "Upstream response is not an image" },
      { status: 415 },
    );
  }

  const arr = await upstream.arrayBuffer();
  if (arr.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Image too large for preview proxy" },
      { status: 413 },
    );
  }

  return new NextResponse(arr, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
`,
  );

  // Ensure globals.css exists
  if (!result.has("app/globals.css")) {
    result.set(
      "app/globals.css",
      `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 214, 219, 220;
  --background-end-rgb: 255, 255, 255;
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-start-rgb: 0, 0, 0;
    --background-end-rgb: 0, 0, 0;
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
      to bottom,
      transparent,
      rgb(var(--background-end-rgb))
    )
    rgb(var(--background-start-rgb));
}`,
    );
  }

  // Ensure global-error.tsx exists
  if (!result.has("app/global-error.tsx")) {
    result.set(
      "app/global-error.tsx",
      `"use client";
import { useEffect } from "react";
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (error.name === "ChunkLoadError" || error.message?.includes("Loading chunk")) {
      window.location.reload();
    }
  }, [error]);
  return (
    <html><body style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui", background: "#0a0a0a", color: "#fff" }}>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ marginBottom: 16 }}>Something went wrong</h2>
        <button onClick={() => reset()} style={{ padding: "8px 20px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Try again</button>
      </div>
    </body></html>
  );
}`,
    );
  }

  // Ensure loading.tsx exists
  if (!result.has("app/loading.tsx")) {
    result.set(
      "app/loading.tsx",
      `"use client";\nexport default function Loading() {\n  return (\n    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">\n      <div className="flex flex-col items-center gap-4">\n        <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />\n        <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>\n      </div>\n    </div>\n  );\n}\n`,
    );
  }

  // ── Inject Pocket Analytics tracking component ──────────────
  result.set("app/components/PocketAnalytics.tsx", POCKET_ANALYTICS_COMPONENT);

  // Inject analytics import + component into layout.tsx
  const layoutPath = result.has("app/layout.tsx") ? "app/layout.tsx" : null;
  if (layoutPath) {
    let layout = result.get(layoutPath)!;
    // Add import at the top (after existing imports or after "use client")
    const analyticsImport = `import PocketAnalytics from "./components/PocketAnalytics";\n`;
    if (!layout.includes("PocketAnalytics")) {
      // Insert import after the last import statement
      const lastImportIdx = layout.lastIndexOf("\nimport ");
      if (lastImportIdx !== -1) {
        const endOfLine = layout.indexOf("\n", lastImportIdx + 1);
        layout = layout.slice(0, endOfLine + 1) + analyticsImport + layout.slice(endOfLine + 1);
      } else {
        layout = analyticsImport + layout;
      }
      // Insert <PocketAnalytics /> right after <body...>
      layout = layout.replace(
        /(<body[^>]*>)/,
        "$1\n        <PocketAnalytics />",
      );
      result.set(layoutPath, layout);
    }
  }

  return result;
}

// ── Vercel env var upsert ────────────────────────────────────────

async function upsertVercelEnvVars(
  projectName: string,
  envVars: Array<{
    key: string;
    value: string;
    target: string[];
    type: string;
  }>,
) {
  if (envVars.length === 0) return;

  // Get existing env vars to find IDs for updates
  const getRes = await fetch(
    `https://api.vercel.com/v9/projects/${projectName}/env${teamQuery()}`,
    { headers: vercelHeaders() },
  );

  const existingByKey = new Map<string, string>();
  if (getRes.ok) {
    const data = await getRes.json();
    for (const env of data.envs || []) {
      existingByKey.set(env.key, env.id);
    }
  }

  for (const envVar of envVars) {
    const existingId = existingByKey.get(envVar.key);
    if (existingId) {
      // Update existing env var
      await fetch(
        `https://api.vercel.com/v9/projects/${projectName}/env/${existingId}${teamQuery()}`,
        {
          method: "PATCH",
          headers: vercelHeaders(),
          body: JSON.stringify({
            value: envVar.value,
            target: envVar.target,
            type: envVar.type,
          }),
        },
      );
    } else {
      // Create new env var
      await fetch(
        `https://api.vercel.com/v10/projects/${projectName}/env${teamQuery()}`,
        {
          method: "POST",
          headers: vercelHeaders(),
          body: JSON.stringify(envVar),
        },
      );
    }
  }
}

// ── POST: Deploy to Vercel ───────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    if (!VERCEL_TOKEN) {
      throw new Error("VERCEL_TOKEN not configured");
    }

    const { files, dependencies = {}, projectId, title } = (await request.json()) as {
      files: ProjectFile[];
      dependencies?: Record<string, string>;
      projectId: string;
      title?: string;
    };

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "No projectId provided" }, { status: 400 });
    }

    const vercelProjectName = `pocket-${projectId}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .slice(0, 52);

    console.log(`[vercel] Starting deployment for project: ${vercelProjectName}`);

    // ── Build production files ─────────────────────────────────
    const productionFiles = buildProductionFiles(files, dependencies);

    // ── Managed Supabase credentials ───────────────────────────
    const needsAuth = projectLikelyNeedsManagedAuth(files);
    let managedAuthConfig = await getAuthConfigForBindingKey(projectId);
    if (!managedAuthConfig && needsAuth) {
      managedAuthConfig = await acquireAuthConfigForBindingKey(projectId);
    }
    if (needsAuth && !managedAuthConfig) {
      throw new Error(
        "Managed Supabase allocation failed. Configure SUPABASE_PREPROVISIONED_POOL or Supabase Management API credentials.",
      );
    }

    // Parse .env.local from project files for fallback values
    const envFile = files.find(
      (f) => f.path === ".env.local" || f.path === ".env",
    );
    const parsedFileEnv = envFile ? parseDotEnvContent(envFile.content) : {};

    // ── Ensure Vercel project exists ───────────────────────────
    const createProjectRes = await fetch(
      `https://api.vercel.com/v10/projects${teamQuery()}`,
      {
        method: "POST",
        headers: vercelHeaders(),
        body: JSON.stringify({
          name: vercelProjectName,
          framework: "nextjs",
        }),
      },
    );

    if (!createProjectRes.ok) {
      const err = await createProjectRes.json();
      const errCode = err.error?.code || "";
      const errMsg = (err.error?.message || "").toLowerCase();
      // 409 / duplicate name means project already exists — fine
      const alreadyExists =
        errCode === "project_already_exists" ||
        errCode === "duplicate-project-name" ||
        errMsg.includes("already exists");
      if (!alreadyExists) {
        throw new Error(
          `Failed to create Vercel project: ${err.error?.message || JSON.stringify(err)}`,
        );
      }
    }

    // ── Upsert environment variables ───────────────────────────
    const envVars: Array<{
      key: string;
      value: string;
      target: string[];
      type: string;
    }> = [];

    const supabaseUrl =
      managedAuthConfig?.supabaseUrl ||
      parsedFileEnv.NEXT_PUBLIC_SUPABASE_URL ||
      parsedFileEnv.SUPABASE_URL ||
      "";
    const supabaseAnonKey =
      managedAuthConfig?.anonKey ||
      parsedFileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      parsedFileEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      "";

    if (supabaseUrl) {
      envVars.push(
        {
          key: "NEXT_PUBLIC_SUPABASE_URL",
          value: supabaseUrl,
          target: ["production", "preview"],
          type: "plain",
        },
        {
          key: "SUPABASE_URL",
          value: supabaseUrl,
          target: ["production", "preview"],
          type: "plain",
        },
      );
    }
    if (supabaseAnonKey) {
      envVars.push(
        {
          key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
          value: supabaseAnonKey,
          target: ["production", "preview"],
          type: "plain",
        },
        {
          key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
          value: supabaseAnonKey,
          target: ["production", "preview"],
          type: "plain",
        },
      );
    }

    const pocketDevUrl = (
      parsedFileEnv.NEXT_PUBLIC_POCKET_DEV_URL ||
      process.env.NEXT_PUBLIC_PRODUCTION_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      (process.env.NEXT_PUBLIC_APP_URL?.includes("localhost") ? "" : process.env.NEXT_PUBLIC_APP_URL) ||
      ""
    ).replace(/\/$/, "");
    if (pocketDevUrl) {
      envVars.push({
        key: "NEXT_PUBLIC_POCKET_DEV_URL",
        value: pocketDevUrl,
        target: ["production", "preview"],
        type: "plain",
      });
    }
    const pocketProjectId =
      parsedFileEnv.NEXT_PUBLIC_POCKET_PROJECT_ID || projectId;
    envVars.push({
      key: "NEXT_PUBLIC_POCKET_PROJECT_ID",
      value: pocketProjectId,
      target: ["production", "preview"],
      type: "plain",
    });

    await upsertVercelEnvVars(vercelProjectName, envVars);

    // ── Create deployment ──────────────────────────────────────
    const vercelFiles = Array.from(productionFiles.entries()).map(
      ([filePath, content]) => ({
        file: filePath,
        data: Buffer.from(content, "utf-8").toString("base64"),
        encoding: "base64" as const,
      }),
    );

    const deployRes = await fetch(
      `https://api.vercel.com/v13/deployments${teamQuery()}`,
      {
        method: "POST",
        headers: vercelHeaders(),
        body: JSON.stringify({
          name: vercelProjectName,
          files: vercelFiles,
          target: "production",
          projectSettings: {
            framework: "nextjs",
          },
        }),
      },
    );

    if (!deployRes.ok) {
      const err = await deployRes.json();
      throw new Error(
        `Vercel deployment failed: ${err.error?.message || JSON.stringify(err)}`,
      );
    }

    const deployData = await deployRes.json();
    const deploymentVercelId = deployData.id;

    console.log(
      `[vercel] Deployment created: ${deploymentVercelId}, waiting for build...`,
    );

    // ── Poll until deployment is ready ─────────────────────────
    const maxWaitMs = 120_000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const statusRes = await fetch(
        `https://api.vercel.com/v13/deployments/${deploymentVercelId}${teamQuery()}`,
        { headers: vercelHeaders() },
      );

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.readyState === "READY") {
          console.log(`[vercel] Deployment ready!`);
          break;
        }
        if (
          statusData.readyState === "ERROR" ||
          statusData.readyState === "CANCELED"
        ) {
          throw new Error(
            `Vercel build failed: ${statusData.errorMessage || statusData.readyState}`,
          );
        }
        console.log(`[vercel] Build state: ${statusData.readyState}...`);
      }
    }

    const productionUrl = `https://${vercelProjectName}.vercel.app`;
    console.log(`[vercel] Deployed: ${productionUrl}`);

    return NextResponse.json({
      success: true,
      url: productionUrl,
      deploymentId: vercelProjectName,
      projectName: vercelProjectName,
    });
  } catch (error) {
    console.error("[vercel] Publish error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to publish to Vercel",
      },
      { status: 500 },
    );
  }
}

// ── DELETE: Unpublish from Vercel ────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    if (!VERCEL_TOKEN) {
      throw new Error("VERCEL_TOKEN not configured");
    }

    const body = await request.json();
    const projectName = body.projectName || body.deploymentId;

    if (!projectName) {
      return NextResponse.json(
        { error: "No projectName or deploymentId provided" },
        { status: 400 },
      );
    }

    const deleteRes = await fetch(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(projectName)}${teamQuery()}`,
      {
        method: "DELETE",
        headers: vercelHeaders(),
      },
    );

    if (!deleteRes.ok) {
      const err = await deleteRes.json().catch(() => ({}));
      // Ignore 404 (project already deleted)
      if (deleteRes.status !== 404) {
        console.warn("[vercel] Delete warning:", err);
      }
    }

    console.log(`[vercel] Deleted project: ${projectName}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[vercel] Unpublish error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to unpublish from Vercel",
      },
      { status: 500 },
    );
  }
}
