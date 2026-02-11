/**
 * Image persistence for React apps - no longer needed since we use
 * Firebase Storage URLs directly for user uploads and CSS/SVG for other images.
 * This function now just returns files unchanged.
 */

interface GeneratedFile {
  path: string;
  content: string;
}

/**
 * Previously used to persist external image URLs to Firebase Storage.
 * Now a no-op since we use Firebase URLs directly for user uploads
 * and CSS/SVG placeholders for other images in React apps.
 */
export async function persistPollinationsImages(
  files: GeneratedFile[],
  userId: string,
): Promise<GeneratedFile[]> {
  // No longer persisting external images - React apps use Firebase URLs directly
  console.log(
    "ℹ️  Image persistence skipped - using direct Firebase URLs for React apps",
  );
  return files;
}
