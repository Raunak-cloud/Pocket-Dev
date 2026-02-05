"use server";

import "server-only";

import {
  generateWebsite,
  editWebsite as editWebsiteFn,
  type GeneratedWebsite,
} from "@/lib/website-generator";

export async function createWebsite(prompt: string): Promise<{
  success: boolean;
  data?: GeneratedWebsite;
  error?: string;
}> {
  try {
    const result = await generateWebsite(prompt);
    return { success: true, data: result };
  } catch (error) {
    console.error("Website generation error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate website",
    };
  }
}

export async function editWebsite(
  currentHtml: string,
  editPrompt: string
): Promise<{
  success: boolean;
  data?: GeneratedWebsite;
  error?: string;
}> {
  try {
    const result = await editWebsiteFn(currentHtml, editPrompt);
    return { success: true, data: result };
  } catch (error) {
    console.error("Website edit error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to edit website",
    };
  }
}
