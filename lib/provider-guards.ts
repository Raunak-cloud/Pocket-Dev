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

function repairCorruptedLayoutSignature(content: string): string {
  let next = content;

  next = next.replace(
    /(export\s+default\s+function\s+[A-Za-z0-9_]+\s*)\(\s*[^)]*<[^)]*\{\s*children\s*\}\s*:\s*\{\s*children\s*:\s*React\.ReactNode\s*\}[^)]*\)/g,
    "$1({ children }: { children: React.ReactNode })",
  );
  next = next.replace(
    /(export\s+default\s+function\s+[A-Za-z0-9_]+\s*)\(\s*[^)]*<[^)]*\{\s*children\s*\}[^)]*\)/g,
    "$1({ children })",
  );

  return next;
}

function wrapChildrenWithProviders(content: string, providers: string[]): string {
  if (providers.length === 0) return content;
  if (!/\{\s*children\s*\}/.test(content)) return content;

  const wrapper = providers.reduceRight(
    (acc, provider) => `<${provider}>${acc}</${provider}>`,
    "{children}",
  );

  if (/<body\b[^>]*>/i.test(content)) {
    const bodyMatch = content.match(/<body\b[^>]*>/i);
    if (bodyMatch?.index !== undefined) {
      const start = bodyMatch.index + bodyMatch[0].length;
      const before = content.slice(0, start);
      const after = content.slice(start).replace(/\{\s*children\s*\}/, wrapper);
      return `${before}${after}`;
    }
  }

  const returnIdx = content.indexOf("return");
  if (returnIdx >= 0) {
    const before = content.slice(0, returnIdx);
    const after = content.slice(returnIdx).replace(/\{\s*children\s*\}/, wrapper);
    return `${before}${after}`;
  }

  return content;
}

function applyProviderGuards(files: FileEntry[]): FileEntry[] {
  const layoutCandidates = [
    "app/layout.tsx",
    "app/layout.jsx",
    "app/layout.ts",
    "app/layout.js",
    "src/app/layout.tsx",
    "src/app/layout.jsx",
    "src/app/layout.ts",
    "src/app/layout.js",
  ];
  const layout = files.find((f) => layoutCandidates.includes(f.path));
  if (!layout) return files;

  const providerToPath = collectProviderExports(files);
  const requiredProviders = collectRequiredProviders(files);
  if (requiredProviders.size === 0) return files;

  let nextLayout = repairCorruptedLayoutSignature(layout.content);
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
    f.path === layout.path ? { ...f, content: nextLayout } : f,
  );
}

export function ensureProviderGuardsForGeneratedFiles<T extends FileEntry>(
  files: T[]
): T[] {
  return applyProviderGuards(files) as T[];
}

export function ensureProviderGuardsForFileMap(
  files: Record<string, string>
): Record<string, string> {
  const entries: FileEntry[] = Object.entries(files).map(([path, content]) => ({
    path,
    content,
  }));
  const guarded = applyProviderGuards(entries);
  const next: Record<string, string> = {};
  for (const file of guarded) {
    next[file.path] = file.content;
  }
  return next;
}
