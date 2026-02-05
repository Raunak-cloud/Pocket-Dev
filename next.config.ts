import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["eslint"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // Increased for editing websites with embedded images
    },
  },
};

export default nextConfig;
