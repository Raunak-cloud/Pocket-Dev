"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/contexts/ThemeContext";

interface ThemeToggleProps {
  size?: number;
  className?: string;
  compact?: boolean;
}

export default function ThemeToggle({
  size = 16,
  className = "",
  compact = false,
}: ThemeToggleProps) {
  const { theme, setThemeMode } = useTheme();

  if (compact) {
    return (
      <div
        className={`inline-flex items-center p-1 rounded-xl bg-bg-tertiary/60 border border-border-secondary/60 ${className}`}
        role="group"
        aria-label="Theme selector"
      >
        <button
          type="button"
          onClick={() => setThemeMode("light")}
          className={`p-1.5 rounded-lg transition ${
            theme === "light"
              ? "bg-blue-500 text-white shadow-sm"
              : "text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
          aria-pressed={theme === "light"}
          aria-label="Light mode"
          title="Light mode"
        >
          <Sun size={size} />
        </button>
        <button
          type="button"
          onClick={() => setThemeMode("dark")}
          className={`p-1.5 rounded-lg transition ${
            theme === "dark"
              ? "bg-blue-500 text-white shadow-sm"
              : "text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
          aria-pressed={theme === "dark"}
          aria-label="Dark mode"
          title="Dark mode"
        >
          <Moon size={size} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex w-full items-center p-1 rounded-xl bg-bg-tertiary/60 border border-border-secondary/60 ${className}`}
      role="group"
      aria-label="Theme selector"
    >
      <button
        type="button"
        onClick={() => setThemeMode("light")}
        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
          theme === "light"
            ? "bg-blue-500 text-white shadow-sm"
            : "text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"
        }`}
        aria-pressed={theme === "light"}
      >
        Light
      </button>
      <button
        type="button"
        onClick={() => setThemeMode("dark")}
        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
          theme === "dark"
            ? "bg-blue-500 text-white shadow-sm"
            : "text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"
        }`}
        aria-pressed={theme === "dark"}
      >
        Dark
      </button>
    </div>
  );
}
