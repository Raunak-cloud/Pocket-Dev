import type { WebsiteConfig } from "../types";

export function renderPackageJson(config: WebsiteConfig): string {
  const pkg = {
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
      "framer-motion": "^10.16.4",
      "recharts": "^2.10.0",
      "react-countup": "^6.5.3",
      "react-type-animation": "^3.2.0",
      "react-intersection-observer": "^9.13.0",
      "embla-carousel-react": "^8.3.0",
      "date-fns": "^3.6.0",
      "@radix-ui/react-accordion": "^1.2.0",
      "@radix-ui/react-tabs": "^1.1.0",
      "@radix-ui/react-dialog": "^1.1.0",
      "@radix-ui/react-tooltip": "^1.1.0",
      "@radix-ui/react-progress": "^1.1.0",
      "class-variance-authority": "^0.7.0",
      "clsx": "^2.1.0",
      "tailwind-merge": "^2.5.0",
    } as Record<string, string>,
    devDependencies: {
      "@types/node": "^20",
      "@types/react": "^18",
      "@types/react-dom": "^18",
      typescript: "^5",
      tailwindcss: "^3.3.0",
      autoprefixer: "^10.4.16",
      postcss: "^8.4.31",
    },
  };

  return JSON.stringify(pkg, null, 2);
}

export function getBaseDependencies(): Record<string, string> {
  return {
    next: "^14.0.0",
    react: "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.294.0",
    "framer-motion": "^10.16.4",
    "recharts": "^2.10.0",
    "react-countup": "^6.5.3",
    "react-type-animation": "^3.2.0",
    "react-intersection-observer": "^9.13.0",
    "embla-carousel-react": "^8.3.0",
    "date-fns": "^3.6.0",
    "@radix-ui/react-accordion": "^1.2.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "@radix-ui/react-progress": "^1.1.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0",
  };
}
