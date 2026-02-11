import type { WebsiteConfig } from "../types";
import { getFontUrl, getHeadingFontFamily, getBodyFontFamily } from "../utils/theme";
import { esc } from "../utils/helpers";

export function renderLayout(config: WebsiteConfig): string {
  const fontUrl = getFontUrl(config.theme.fontStyle);
  const headingFont = getHeadingFontFamily(config.theme.fontStyle);
  const bodyFont = getBodyFontFamily(config.theme.fontStyle);
  const isDark = config.theme.background === "dark";

  return `import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "${esc(config.business.name)} - ${esc(config.business.tagline)}",
  description: "${esc(config.business.description)}",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en"${isDark ? ' className="dark"' : ""}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="${fontUrl}" />
        <script dangerouslySetInnerHTML={{ __html: \`
          window.addEventListener("error", function(e) {
            if (e.message && (e.message.includes("Loading chunk") || e.message.includes("ChunkLoadError"))) {
              console.warn("[chunk-recovery] Chunk load failed, reloading...");
              setTimeout(function() { window.location.reload(); }, 500);
            }
          });
          window.addEventListener("unhandledrejection", function(e) {
            var msg = e.reason && (e.reason.message || String(e.reason));
            if (msg && (msg.includes("Loading chunk") || msg.includes("ChunkLoadError"))) {
              console.warn("[chunk-recovery] Chunk promise rejected, reloading...");
              setTimeout(function() { window.location.reload(); }, 500);
            }
          });
        \` }} />
      </head>
      <body className={\`\${inter.className} ${isDark ? "bg-gray-950 text-white" : "bg-white text-gray-900"}\`} style={{ fontFamily: "${bodyFont}" }}>
        <Navbar />
        <main className="min-h-screen">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
`;
}
