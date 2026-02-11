"use server";

import { generateProject, editProject } from "@/lib/generation-router";

export async function generateReact(
  prompt: string,
  images?: { name: string; type: string; dataUrl: string; downloadUrl?: string }[]
) {
  return generateProject(prompt, images);
}

export async function editReact(
  editPrompt: string,
  currentConfig: any,
  currentFiles: { path: string; content: string }[],
  imageCache?: Record<string, string>,
) {
  return editProject(editPrompt, currentConfig, currentFiles, undefined, imageCache);
}
