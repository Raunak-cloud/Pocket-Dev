"use server";

import { generateReactProject, type GeneratedReactProject, type UploadedImage } from "@/lib/react-generator";

export async function generateReact(
  prompt: string,
  images?: UploadedImage[]
): Promise<GeneratedReactProject> {
  return generateReactProject(prompt, images);
}
