/**
 * Splits a single HTML file into separate HTML, CSS, JS files
 * and extracts image data into assets
 */

export interface SplitWebsite {
  html: string;
  css: string;
  js: string;
  images: { filename: string; data: string }[];
}

export function splitHtmlIntoFiles(html: string): SplitWebsite {
  // Extract CSS from <style> tags
  const cssMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  const css = cssMatches
    .map((match) => {
      const content = match.replace(/<style[^>]*>|<\/style>/gi, "");
      return content.trim();
    })
    .join("\n\n");

  // Extract JavaScript from <script> tags (excluding external scripts)
  const jsMatches = html.match(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi) || [];
  const js = jsMatches
    .map((match) => {
      const content = match.replace(/<script[^>]*>|<\/script>/gi, "");
      return content.trim();
    })
    .filter((content) => content.length > 0)
    .join("\n\n");

  // Extract inline images (base64 data URLs)
  const images: { filename: string; data: string }[] = [];
  let imageCounter = 1;

  // Replace inline images with asset references
  let processedHtml = html.replace(
    /src=["'](data:image\/[^;]+;base64,[^"']+)["']/gi,
    (match, dataUrl) => {
      const extension = dataUrl.match(/data:image\/([^;]+)/)?.[1] || "png";
      const filename = `image-${imageCounter}.${extension}`;
      images.push({ filename, data: dataUrl });
      imageCounter++;
      return `src="assets/${filename}"`;
    }
  );

  // Remove <style> tags from HTML
  processedHtml = processedHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Remove <script> tags from HTML (keep external scripts)
  processedHtml = processedHtml.replace(
    /<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/gi,
    ""
  );

  // Add links to external CSS and JS files in the <head>
  processedHtml = processedHtml.replace(
    /<\/head>/i,
    '  <link rel="stylesheet" href="styles.css">\n</head>'
  );

  // Add link to external JS file before closing </body>
  processedHtml = processedHtml.replace(
    /<\/body>/i,
    '  <script src="script.js"></script>\n</body>'
  );

  // Clean up extra whitespace
  processedHtml = processedHtml.replace(/\n{3,}/g, "\n\n");

  return {
    html: processedHtml.trim(),
    css: css || "/* No styles found */",
    js: js || "// No JavaScript found",
    images,
  };
}

/**
 * Create a text representation of the file structure
 */
export function createFileStructureText(split: SplitWebsite): string {
  const lines = [
    "website/",
    "├── index.html",
    "├── styles.css",
    "├── script.js",
  ];

  if (split.images.length > 0) {
    lines.push("└── assets/");
    split.images.forEach((img, i) => {
      const isLast = i === split.images.length - 1;
      lines.push(`    ${isLast ? "└──" : "├──"} ${img.filename}`);
    });
  }

  return lines.join("\n");
}
