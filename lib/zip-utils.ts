/**
 * Simple ZIP file creation utility without external dependencies
 * Uses browser's native APIs
 */

import type { SplitWebsite } from "./file-splitter";

/**
 * Create a ZIP file from split website files
 * Returns a Blob that can be downloaded
 */
export async function createWebsiteZip(
  split: SplitWebsite,
  filename: string = "website"
): Promise<Blob> {
  // We'll use JSZip if available, otherwise create individual files
  // For now, let's create a simple implementation using dynamic import

  try {
    // Try to use JSZip if available (we'll add it as dependency)
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    // Add main files
    zip.file("index.html", split.html);
    zip.file("styles.css", split.css);
    zip.file("script.js", split.js);

    // Add assets folder if there are images
    if (split.images.length > 0) {
      const assetsFolder = zip.folder("assets");
      if (assetsFolder) {
        split.images.forEach((img) => {
          // Convert base64 data URL to blob
          const base64Data = img.data.split(",")[1];
          assetsFolder.file(img.filename, base64Data, { base64: true });
        });
      }
    }

    // Generate ZIP file
    const blob = await zip.generateAsync({ type: "blob" });
    return blob;
  } catch (error) {
    console.error("JSZip not available, creating fallback:", error);
    // Fallback: create a text file with instructions
    const readmeContent = `Website Files
===============

This website consists of the following files:

${split.images.length > 0 ? "website/\n├── index.html\n├── styles.css\n├── script.js\n└── assets/\n" + split.images.map((img, i) => `    ${i === split.images.length - 1 ? "└──" : "├──"} ${img.filename}`).join("\n") : "website/\n├── index.html\n├── styles.css\n└── script.js"}

Please create these files manually:

1. Create a folder named 'website'
2. Save the HTML, CSS, and JS from the interface
3. Create an 'assets' folder for images
4. Extract base64 images from the original HTML

Alternatively, use the "Download All Files" button in the interface.
`;

    return new Blob([readmeContent], { type: "text/plain" });
  }
}

/**
 * Trigger download of a blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download individual file
 */
export function downloadFile(content: string, filename: string, type: string = "text/plain"): void {
  const blob = new Blob([content], { type });
  downloadBlob(blob, filename);
}
