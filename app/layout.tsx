import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SupabaseAuthProvider } from "@/lib/supabase-auth/client";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import MaintenanceCheck from "./components/MaintenanceCheck";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('pocket-dev-theme');if(t==='light'){}else{document.documentElement.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}})()`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-bg-primary text-text-primary selection:bg-blue-500/30`}>
        <SupabaseAuthProvider>
          <ThemeProvider>
            <AuthProvider>
              <MaintenanceCheck />
              {children}
            </AuthProvider>
          </ThemeProvider>
        </SupabaseAuthProvider>
      </body>
    </html>
  );
}

