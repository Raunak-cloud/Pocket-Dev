/**
 * Field-specific updaters for precise changes
 * Prevents AI from changing unrelated fields
 */

import type { WebsiteConfig } from "./templates/types";

/**
 * Update ONLY the logo URL, nothing else
 */
export function updateLogo(config: WebsiteConfig, newLogoUrl: string): WebsiteConfig {
  return {
    ...config,
    business: {
      ...config.business,
      logoUrl: newLogoUrl,
    },
  };
}

/**
 * Update ONLY theme colors, nothing else
 */
export function updateThemeColors(
  config: WebsiteConfig,
  updates: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: "light" | "dark";
  }
): WebsiteConfig {
  return {
    ...config,
    theme: {
      ...config.theme,
      ...updates,
    },
  };
}

/**
 * Update ONLY business contact info
 */
export function updateContactInfo(
  config: WebsiteConfig,
  updates: {
    phone?: string;
    email?: string;
    address?: string;
    hours?: string;
  }
): WebsiteConfig {
  return {
    ...config,
    business: {
      ...config.business,
      ...updates,
    },
  };
}

/**
 * Update ONLY hero content
 */
export function updateHero(
  config: WebsiteConfig,
  updates: {
    headline?: string;
    subheadline?: string;
    ctaText?: string;
    ctaHref?: string;
    imageDescription?: string;
  }
): WebsiteConfig {
  return {
    ...config,
    hero: {
      ...config.hero,
      ...updates,
    },
  };
}

/**
 * Extract logo URL from AI-generated text responses
 * Handles: URLs, "logo.png", file uploads, etc.
 */
export function extractLogoUrl(userInput: string, uploadedImages?: Array<{ url: string; name: string }>): string | null {
  // Check if user uploaded a file
  if (uploadedImages && uploadedImages.length > 0) {
    const logoImage = uploadedImages.find(
      img => img.name.toLowerCase().includes("logo") || uploadedImages.length === 1
    );
    if (logoImage) return logoImage.url;
  }

  // Extract URL from text
  const urlMatch = userInput.match(/https?:\/\/[^\s]+/);
  if (urlMatch) return urlMatch[0];

  return null;
}

/**
 * Parse color names/hex values from user input
 */
export function extractColors(userInput: string): {
  primary?: string;
  secondary?: string;
  accent?: string;
} {
  const colors: { primary?: string; secondary?: string; accent?: string } = {};

  // Tailwind colors
  const tailwindColors = [
    "slate", "gray", "zinc", "neutral", "stone",
    "red", "orange", "amber", "yellow", "lime",
    "green", "emerald", "teal", "cyan", "sky",
    "blue", "indigo", "violet", "purple", "fuchsia",
    "pink", "rose"
  ];

  const lowerInput = userInput.toLowerCase();

  // Try to extract primary color
  const primaryMatch = lowerInput.match(/primary[:\s]+(\w+)|make it (\w+)|change to (\w+)/);
  if (primaryMatch) {
    const colorName = primaryMatch[1] || primaryMatch[2] || primaryMatch[3];
    if (tailwindColors.includes(colorName)) {
      colors.primary = colorName;
    }
  }

  return colors;
}
