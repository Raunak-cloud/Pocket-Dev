type FileEntry = {
  path: string;
  content: string;
};

const SOURCE_EXT_REGEX = /\.(tsx|ts|jsx|js)$/;

function toModulePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/").replace(SOURCE_EXT_REGEX, "");
  return `@/${normalized}`;
}

function collectProviderExports(files: FileEntry[]): Map<string, string> {
  const providerToPath = new Map<string, string>();
  const exportRegex = /export\s+(?:const|function)\s+([A-Za-z0-9_]+Provider)\b/g;

  for (const file of files) {
    if (!SOURCE_EXT_REGEX.test(file.path)) continue;
    let match: RegExpExecArray | null;
    while ((match = exportRegex.exec(file.content)) !== null) {
      providerToPath.set(match[1], file.path);
    }
  }

  return providerToPath;
}

function collectRequiredProviders(files: FileEntry[]): Set<string> {
  const required = new Set<string>();
  const guardRegex = /must be used within\s+([A-Za-z0-9_]+Provider)\b/gi;

  for (const file of files) {
    if (!SOURCE_EXT_REGEX.test(file.path)) continue;
    let match: RegExpExecArray | null;
    while ((match = guardRegex.exec(file.content)) !== null) {
      required.add(match[1]);
    }
  }

  return required;
}

function ensureImport(content: string, providerName: string, providerPath: string): string {
  const importWithProviderRegex = new RegExp(
    `import\\s+\\{[^}]*\\b${providerName}\\b[^}]*\\}\\s+from\\s+['"][^'"]+['"];?`
  );
  if (importWithProviderRegex.test(content)) {
    return content;
  }

  const importLine = `import { ${providerName} } from "${toModulePath(providerPath)}";`;
  const importLines = content.match(/^import[^\n]*$/gm);
  if (!importLines || importLines.length === 0) {
    return `${importLine}\n${content}`;
  }

  const lastImport = importLines[importLines.length - 1];
  const idx = content.lastIndexOf(lastImport);
  if (idx === -1) {
    return `${importLine}\n${content}`;
  }

  const insertAt = idx + lastImport.length;
  return `${content.slice(0, insertAt)}\n${importLine}${content.slice(insertAt)}`;
}

function wrapChildrenWithProviders(content: string, providers: string[]): string {
  if (providers.length === 0) return content;
  if (!/\{children\}/.test(content)) return content;

  const wrapper = providers.reduceRight(
    (acc, provider) => `<${provider}>${acc}</${provider}>`,
    "{children}"
  );

  return content.replace("{children}", wrapper);
}

function applyProviderGuards(files: FileEntry[]): FileEntry[] {
  const layout = files.find((f) => f.path === "app/layout.tsx");
  if (!layout) return files;

  const providerToPath = collectProviderExports(files);
  const requiredProviders = collectRequiredProviders(files);
  if (requiredProviders.size === 0) return files;

  let nextLayout = layout.content;
  const missingProviders: string[] = [];

  for (const provider of requiredProviders) {
    const alreadyUsed = new RegExp(`<${provider}\\b`).test(nextLayout);
    if (alreadyUsed) continue;

    const providerPath = providerToPath.get(provider);
    if (!providerPath) continue;

    nextLayout = ensureImport(nextLayout, provider, providerPath);
    missingProviders.push(provider);
  }

  if (missingProviders.length === 0) return files;

  nextLayout = wrapChildrenWithProviders(nextLayout, missingProviders);

  return files.map((f) =>
    f.path === "app/layout.tsx" ? { ...f, content: nextLayout } : f
  );
}

function normalizeClerkMiddleware(files: FileEntry[]): FileEntry[] {
  const middlewarePaths = new Set([
    "middleware.ts",
    "middleware.js",
    "src/middleware.ts",
    "src/middleware.js",
  ]);

  const modernMiddleware = `import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};`;

  return files.map((file) => {
    const normalizedPath = file.path.replace(/\\/g, "/");
    if (!middlewarePaths.has(normalizedPath)) return file;

    const usesDeprecatedAuthMiddleware =
      /authMiddleware/.test(file.content) &&
      /@clerk\/nextjs/.test(file.content);
    if (usesDeprecatedAuthMiddleware) {
      return {
        ...file,
        content: modernMiddleware,
      };
    }

    // Normalize Clerk v6 callback API usage in generated middleware.
    if (
      /clerkMiddleware/.test(file.content) &&
      /auth\(\)\.protect\(\)/.test(file.content)
    ) {
      let content = file.content.replace(
        /auth\(\)\.protect\(\)/g,
        "await auth.protect()",
      );

      // Ensure the middleware callback is async if we inserted await.
      content = content.replace(
        /clerkMiddleware\(\s*\(([^)]*)\)\s*=>/g,
        "clerkMiddleware(async ($1) =>",
      );

      return {
        ...file,
        content,
      };
    }

    return file;
  });
}

function normalizeClerkServerAuth(files: FileEntry[]): FileEntry[] {
  const serverLikeFile = (path: string) =>
    /(^|\/)(app\/.*\/page|app\/.*\/layout|app\/.*\/loading|app\/.*\/error|app\/.*\/not-found|app\/.*\/template|app\/.*\/default|app\/.*\/route|middleware)\.(ts|tsx|js|jsx)$/.test(
      path,
    );

  return files.map((file) => {
    const normalizedPath = file.path.replace(/\\/g, "/");
    if (!SOURCE_EXT_REGEX.test(normalizedPath) || !serverLikeFile(normalizedPath)) {
      return file;
    }

    let next = file.content;

    // Ensure server-side Clerk import when auth() is used.
    const usesAuthCall = /\bauth\s*\(/.test(next);
    if (usesAuthCall) {
      next = next.replace(
        /from\s+["']@clerk\/nextjs["']/g,
        'from "@clerk/nextjs/server"',
      );

      // If auth() is used without await in common destructuring cases, fix it.
      next = next.replace(
        /\b(const|let|var)\s+(\{[^}]*\})\s*=\s*auth\(\s*\)\s*;/g,
        "$1 $2 = await auth();",
      );
    }

    return next === file.content ? file : { ...file, content: next };
  });
}

export function ensureProviderGuardsForGeneratedFiles<T extends FileEntry>(
  files: T[]
): T[] {
  return applyProviderGuards(
    normalizeClerkServerAuth(normalizeClerkMiddleware(files)),
  ) as T[];
}

export function ensureProviderGuardsForFileMap(
  files: Record<string, string>
): Record<string, string> {
  const entries: FileEntry[] = Object.entries(files).map(([path, content]) => ({
    path,
    content,
  }));
  const guarded = applyProviderGuards(
    normalizeClerkServerAuth(normalizeClerkMiddleware(entries)),
  );
  const next: Record<string, string> = {};
  for (const file of guarded) {
    next[file.path] = file.content;
  }
  return next;
}
