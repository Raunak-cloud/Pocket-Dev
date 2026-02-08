import { NextRequest, NextResponse } from "next/server";

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID; // optional, for team deployments

interface ProjectFile {
  path: string;
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!VERCEL_TOKEN) {
      throw new Error("VERCEL_TOKEN not configured");
    }

    const { files, dependencies, projectId, title } = (await request.json()) as {
      files: ProjectFile[];
      dependencies: Record<string, string>;
      projectId: string;
      title?: string;
    };

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: "No projectId provided" }, { status: 400 });
    }

    // Build the full Next.js project file list for Vercel
    const vercelFiles: { file: string; data: string }[] = [];

    // Add all project source files under app/
    for (const f of files) {
      vercelFiles.push({
        file: f.path,
        data: Buffer.from(f.content, "utf-8").toString("base64"),
      });
    }

    // Add package.json
    const packageJson = {
      name: `pocketdev-${projectId}`,
      version: "1.0.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
      },
      dependencies: {
        ...dependencies,
        next: "^14.2.0",
        react: "^18.2.0",
        "react-dom": "^18.2.0",
      },
      devDependencies: {
        typescript: "^5",
        "@types/node": "^20",
        "@types/react": "^18",
        "@types/react-dom": "^18",
        autoprefixer: "^10.4.0",
        postcss: "^8.4.0",
        tailwindcss: "^3.4.0",
      },
    };
    vercelFiles.push({
      file: "package.json",
      data: Buffer.from(JSON.stringify(packageJson, null, 2), "utf-8").toString("base64"),
    });

    // Add tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: "ES2017",
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: false,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
        paths: { "@/*": ["./*"] },
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    };
    vercelFiles.push({
      file: "tsconfig.json",
      data: Buffer.from(JSON.stringify(tsconfig, null, 2), "utf-8").toString("base64"),
    });

    // Add next.config.js (simple, no special settings needed)
    const nextConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports = nextConfig;
`;
    vercelFiles.push({
      file: "next.config.js",
      data: Buffer.from(nextConfig, "utf-8").toString("base64"),
    });

    // Add tailwind.config.js
    const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
`;
    vercelFiles.push({
      file: "tailwind.config.js",
      data: Buffer.from(tailwindConfig, "utf-8").toString("base64"),
    });

    // Add postcss.config.js
    const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
    vercelFiles.push({
      file: "postcss.config.js",
      data: Buffer.from(postcssConfig, "utf-8").toString("base64"),
    });

    // Add globals.css if not already in files (Tailwind directives)
    const hasGlobalsCss = files.some(
      (f) => f.path === "app/globals.css" || f.path === "app/global.css",
    );
    if (!hasGlobalsCss) {
      vercelFiles.push({
        file: "app/globals.css",
        data: Buffer.from(
          `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`,
          "utf-8",
        ).toString("base64"),
      });
    }

    // Deploy to Vercel
    const projectName = `pocketdev-${projectId}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 52);

    const deployPayload: Record<string, unknown> = {
      name: projectName,
      files: vercelFiles,
      target: "production",
      projectSettings: {
        framework: "nextjs",
        buildCommand: "next build",
        outputDirectory: ".next",
        installCommand: "npm install",
      },
    };

    const teamQuery = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : "";

    const deployResponse = await fetch(
      `https://api.vercel.com/v13/deployments${teamQuery}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(deployPayload),
      },
    );

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error("Vercel API error:", deployResponse.status, errorText);
      throw new Error(`Vercel API returned ${deployResponse.status}: ${errorText}`);
    }

    const deployData = await deployResponse.json();
    const deploymentUrl = `https://${deployData.url}`;
    const deploymentId = deployData.id;

    return NextResponse.json({
      success: true,
      url: deploymentUrl,
      deploymentId,
      projectName,
      isUpdate: false,
    });
  } catch (error) {
    console.error("Publish error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!VERCEL_TOKEN) {
      throw new Error("VERCEL_TOKEN not configured");
    }

    const { deploymentId } = await request.json();

    if (!deploymentId) {
      return NextResponse.json({ error: "No deploymentId provided" }, { status: 400 });
    }

    const teamQuery = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : "";

    const response = await fetch(
      `https://api.vercel.com/v13/deployments/${deploymentId}${teamQuery}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
        },
      },
    );

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      console.error("Vercel delete error:", response.status, errorText);
      throw new Error(`Failed to delete deployment: ${response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unpublish error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to unpublish" },
      { status: 500 },
    );
  }
}
