"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setThemeMode: (mode: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "pocket-dev-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored === "light" ? "light" : "dark";
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";

      // Add transition class for smooth animation
      document.documentElement.classList.add("theme-transition");

      // Toggle .dark class
      if (next === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }

      // Persist
      localStorage.setItem(STORAGE_KEY, next);

      // Remove transition class after animation completes
      setTimeout(() => {
        document.documentElement.classList.remove("theme-transition");
      }, 350);

      return next;
    });
  }, []);

  const setThemeMode = useCallback((mode: Theme) => {
    setTheme((prev) => {
      if (prev === mode) return prev;

      document.documentElement.classList.add("theme-transition");

      if (mode === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }

      localStorage.setItem(STORAGE_KEY, mode);

      setTimeout(() => {
        document.documentElement.classList.remove("theme-transition");
      }, 350);

      return mode;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
