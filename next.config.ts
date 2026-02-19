import type { NextConfig } from "next";

let supabaseImageHost: string | null = null;
try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    supabaseImageHost = new URL(supabaseUrl).hostname;
  }
} catch {
  supabaseImageHost = null;
}

const nextConfig: NextConfig = {
  serverExternalPackages: ["eslint"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "replicate.delivery" },
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      ...(supabaseImageHost
        ? [{ protocol: "https" as const, hostname: supabaseImageHost }]
        : []),
    ],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // Required by WebContainer (SharedArrayBuffer + worker transfer)
        { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      ],
    },
    {
      source: "/api/(.*)",
      headers: [
        { key: "Cache-Control", value: "no-store, max-age=0" },
      ],
    },
  ],
  poweredByHeader: false,
};

export default nextConfig;
