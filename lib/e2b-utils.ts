interface GeneratedFile {
  path: string;
  content: string;
}

export interface ReactProject {
  files: GeneratedFile[];
  dependencies: Record<string, string>;
}

export interface E2BFiles {
  [path: string]: string;
}

export function hasAuthentication(project: ReactProject): boolean {
  return project.files.some(
    (f) =>
      f.content.includes("@supabase/supabase-js") ||
      f.content.includes("supabase.auth") ||
      f.content.includes("createClient("),
  );
}

export function prepareE2BFiles(project: ReactProject): E2BFiles {
  const files: E2BFiles = {};

  const managedConfigFiles = new Set([
    "package.json",
    "tsconfig.json",
    "next.config.js",
    "next.config.ts",
    "tailwind.config.js",
    "tailwind.config.ts",
    "postcss.config.js",
    "postcss.config.mjs",
  ]);

  let aiDeps: Record<string, string> = {};
  const aiPkgFile = project.files.find((f) => f.path === "package.json");
  if (aiPkgFile) {
    try {
      const aiPkg = JSON.parse(aiPkgFile.content);
      aiDeps = aiPkg.dependencies || {};
    } catch {
      // ignore malformed package
    }
  }

  project.files.forEach((f) => {
    if (managedConfigFiles.has(f.path)) return;
    files[f.path] = f.content;
  });

  let supabaseImageHost = "";
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      supabaseImageHost = new URL(supabaseUrl).hostname;
    }
  } catch {
    supabaseImageHost = "";
  }

  files["package.json"] = JSON.stringify(
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
        ...project.dependencies,
        next: "^14.0.0",
        react: "^18.2.0",
        "react-dom": "^18.2.0",
        "lucide-react": "^0.294.0",
        tailwindcss: "^3.3.0",
        postcss: "^8.4.31",
        autoprefixer: "^10.4.16",
        ...(hasAuthentication(project)
          ? { "@supabase/supabase-js": "^2.57.4", "@supabase/ssr": "^0.7.0" }
          : {}),
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

  files["next.config.js"] = `/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'replicate.delivery',
      },
      {
        protocol: 'https',
        hostname: 'utfs.io',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },${
        supabaseImageHost
          ? `
      {
        protocol: 'https',
        hostname: '${supabaseImageHost}',
      },`
          : ""
      }
    ],
  },
};
module.exports = nextConfig;`;

  files["tailwind.config.js"] = `/** @type {import('tailwindcss').Config} */
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
}`;

  files["postcss.config.js"] = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`;

  files["tsconfig.json"] = JSON.stringify(
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
  );

  if (!files["app/globals.css"]) {
    files["app/globals.css"] = `@tailwind base;
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
}`;
  }

  if (!files["app/global-error.tsx"]) {
    files["app/global-error.tsx"] = `"use client";
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
}`;
  }

  const hasAuthIntegration = project.files.some(
    (f) =>
      f.content.includes("@supabase/supabase-js") ||
      f.content.includes("supabase.auth"),
  );
  if (hasAuthIntegration) {
    files["README.md"] = `# Your Generated Next.js App

This app was generated by Pocket Dev.

## Stack
- Next.js App Router
- Tailwind CSS
- Supabase Authentication
- Prisma + Supabase Postgres
- Supabase Storage (for file uploads)
`;
  }

  return files;
}

export function computeFileDiff(
  oldFiles: Record<string, string>,
  newFiles: Record<string, string>,
): {
  toWrite: Array<{ path: string; data: string }>;
  toDelete: string[];
} {
  const toWrite: Array<{ path: string; data: string }> = [];
  const toDelete: string[] = [];

  for (const [path, content] of Object.entries(newFiles)) {
    if (oldFiles[path] !== content) {
      toWrite.push({ path, data: content });
    }
  }

  for (const path of Object.keys(oldFiles)) {
    if (!(path in newFiles)) {
      toDelete.push(path);
    }
  }

  return { toWrite, toDelete };
}

