import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./contexts/AuthContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pocket Dev - AI App Generator",
  description: "Generate professional React applications with AI. Describe your app and watch it come to life.",
  keywords: ["AI", "React", "App Generator", "Code Generator", "Web Development"],
  authors: [{ name: "Pocket Dev" }],
  openGraph: {
    title: "Pocket Dev - AI App Generator",
    description: "Generate professional React applications with AI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-slate-950 text-white selection:bg-blue-500/30`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
