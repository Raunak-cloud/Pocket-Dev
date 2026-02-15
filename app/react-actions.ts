"use server";

import { editProject } from "@/lib/generation-router";

export async function editReact(
  editPrompt: string,
  currentConfig: any,
  currentFiles: { path: string; content: string }[],
  imageCache?: Record<string, string>,
) {
  // imageCache is deprecated and no longer used
  return editProject(editPrompt, currentConfig, currentFiles);
}
