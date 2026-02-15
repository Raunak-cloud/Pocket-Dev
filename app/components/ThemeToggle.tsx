"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/app/contexts/ThemeContext";

interface ThemeToggleProps {
  size?: number;
  className?: string;
}

export default function ThemeToggle({ size = 18, className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-lg transition-colors bg-bg-tertiary/60 hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary ${className}`}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun size={size} /> : <Moon size={size} />}
    </button>
  );
}
