import { NextRequest, NextResponse } from "next/server";
import { execFileSync } from "child_process";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

interface ProjectFile {
  path: string;
  content: string;
}

type ProjectFileWithNormalizedPath = ProjectFile & { normalizedPath: string };
type ResolvedComponent = {
  file: ProjectFileWithNormalizedPath;
  localName: string;
};
const WRANGLER_VERSION = process.env.WRANGLER_VERSION || "4.64.0";
const WRANGLER_EXEC_CWD = join(tmpdir(), "pocketdev-wrangler-exec");

// ── Helpers ─────────────────────────────────────────────────────

function normalizeProjectPath(path: string): string {
  let normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  if (normalized.startsWith("src/")) normalized = normalized.slice(4);
  return normalized;
}

function withNormalizedPaths(files: ProjectFile[]): ProjectFileWithNormalizedPath[] {
  return files.map((file) => ({ ...file, normalizedPath: normalizeProjectPath(file.path) }));
}

function fileDir(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

function resolveRelativeImport(baseFilePath: string, importPath: string): string {
  if (!importPath.startsWith(".")) return importPath;

  const baseParts = fileDir(baseFilePath).split("/").filter(Boolean);
  const importParts = importPath.split("/");
  for (const part of importParts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      baseParts.pop();
      continue;
    }
    baseParts.push(part);
  }
  return baseParts.join("/");
}

function findFileByCandidates(
  files: ProjectFileWithNormalizedPath[],
  candidates: string[],
): ProjectFileWithNormalizedPath | undefined {
  const candidateSet = new Set(candidates.map(normalizeProjectPath));
  return files.find((f) => candidateSet.has(f.normalizedPath));
}

function findFirstFileByRegex(
  files: ProjectFileWithNormalizedPath[],
  re: RegExp,
): ProjectFileWithNormalizedPath | undefined {
  return files.find((f) => re.test(f.normalizedPath));
}

function getImportMap(pageCode: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /import\s+([\s\S]*?)\s+from\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pageCode)) !== null) {
    const clause = m[1].trim();
    const source = m[2].trim();

    // import Foo from "..."
    const defaultMatch = clause.match(/^([A-Za-z_$][\w$]*)/);
    if (defaultMatch) {
      map.set(defaultMatch[1], source);
    }

    // import { A, B as C } from "..."
    const namedMatch = clause.match(/\{([^}]+)\}/);
    if (namedMatch) {
      const names = namedMatch[1]
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      for (const name of names) {
        const asMatch = name.match(
          /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/,
        );
        if (asMatch) {
          map.set(asMatch[2], source);
        } else if (/^[A-Za-z_$][\w$]*$/.test(name)) {
          map.set(name, source);
        }
      }
    }
  }
  return map;
}

function resolveImportBasePaths(
  pageFilePath: string,
  importPath: string,
): string[] {
  const candidates: string[] = [];

  if (importPath.startsWith(".")) {
    candidates.push(resolveRelativeImport(pageFilePath, importPath));
  } else if (importPath.startsWith("@/") || importPath.startsWith("~/")) {
    const stripped = importPath.slice(2);
    if (stripped) {
      candidates.push(stripped);
      if (!stripped.startsWith("app/")) {
        candidates.push(`app/${stripped}`);
      } else {
        candidates.push(stripped.slice(4));
      }
    }
  } else if (importPath.startsWith("/")) {
    const stripped = importPath.slice(1);
    if (stripped) {
      candidates.push(stripped);
      if (!stripped.startsWith("app/")) {
        candidates.push(`app/${stripped}`);
      } else {
        candidates.push(stripped.slice(4));
      }
    }
  } else if (importPath.startsWith("app/")) {
    candidates.push(importPath, importPath.slice(4));
  } else if (importPath.startsWith("components/")) {
    candidates.push(importPath, `app/${importPath}`);
  }

  return Array.from(
    new Set(
      candidates
        .map((p) => normalizeProjectPath(p))
        .filter((p) => p.length > 0),
    ),
  );
}

function findByImportPath(
  files: ProjectFileWithNormalizedPath[],
  pageFilePath: string,
  importPath: string,
): ProjectFileWithNormalizedPath | undefined {
  const exts = ["tsx", "jsx", "ts", "js"];
  const basePaths = resolveImportBasePaths(pageFilePath, importPath);
  if (basePaths.length === 0) return undefined;

  for (const basePath of basePaths) {
    const hasExt = /\.[a-zA-Z0-9]+$/.test(basePath);
    const candidates = hasExt
      ? [basePath]
      : [
          ...exts.map((ext) => `${basePath}.${ext}`),
          ...exts.map((ext) => `${basePath}/index.${ext}`),
        ];

    const match = findFileByCandidates(files, candidates);
    if (match) return match;
  }

  return undefined;
}

function getImportSources(code: string): string[] {
  const sources = new Set<string>();
  const importFromRe = /import\s+[\s\S]*?\s+from\s+["']([^"']+)["']/g;
  const sideEffectImportRe = /import\s+["']([^"']+)["']/g;

  let match: RegExpExecArray | null;
  while ((match = importFromRe.exec(code)) !== null) {
    sources.add(match[1]);
  }
  while ((match = sideEffectImportRe.exec(code)) !== null) {
    sources.add(match[1]);
  }

  return Array.from(sources);
}

function collectTransitiveLocalFiles(
  files: ProjectFileWithNormalizedPath[],
  entryFiles: ProjectFileWithNormalizedPath[],
): ProjectFileWithNormalizedPath[] {
  const queue = [...entryFiles];
  const entrySet = new Set(entryFiles.map((f) => f.normalizedPath));
  const scanned = new Set<string>();
  const collected = new Map<string, ProjectFileWithNormalizedPath>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (scanned.has(current.normalizedPath)) continue;
    scanned.add(current.normalizedPath);

    const importSources = getImportSources(current.content);
    for (const importSource of importSources) {
      const dep = findByImportPath(files, current.normalizedPath, importSource);
      if (!dep) continue;
      if (!dep.normalizedPath.match(/\.(tsx|jsx|ts|js)$/)) continue;

      if (!entrySet.has(dep.normalizedPath) && !collected.has(dep.normalizedPath)) {
        collected.set(dep.normalizedPath, dep);
      }
      if (!scanned.has(dep.normalizedPath)) {
        queue.push(dep);
      }
    }
  }

  return Array.from(collected.values()).sort((a, b) =>
    a.normalizedPath.localeCompare(b.normalizedPath),
  );
}

function resolveComponentFromImports(
  files: ProjectFileWithNormalizedPath[],
  sourceFile: ProjectFileWithNormalizedPath,
  preferredNames: string[],
  fallbackNamePattern?: RegExp,
): ResolvedComponent | undefined {
  const importMap = getImportMap(sourceFile.content);

  for (const preferredName of preferredNames) {
    const importPath = importMap.get(preferredName);
    if (!importPath) continue;
    const file = findByImportPath(files, sourceFile.normalizedPath, importPath);
    if (file) {
      return { file, localName: preferredName };
    }
  }

  if (fallbackNamePattern) {
    for (const [localName, importPath] of importMap.entries()) {
      if (!fallbackNamePattern.test(localName)) continue;
      const file = findByImportPath(files, sourceFile.normalizedPath, importPath);
      if (file) {
        return { file, localName };
      }
    }
  }

  return undefined;
}

function detectPrimaryExportName(rawCode: string, cleanedCode: string): string | null {
  const defaultNamedFn = rawCode.match(
    /export\s+default\s+function\s+([A-Za-z_$][\w$]*)/,
  )?.[1];
  if (defaultNamedFn) return defaultNamedFn;

  const defaultNamedRef = rawCode.match(
    /export\s+default\s+([A-Za-z_$][\w$]*)\s*;?/,
  )?.[1];
  if (defaultNamedRef) return defaultNamedRef;

  const firstDeclaration = cleanedCode.match(
    /\b(?:function|const|class)\s+([A-Za-z_$][\w$]*)\b/,
  )?.[1];
  if (firstDeclaration) return firstDeclaration;

  return null;
}

function buildAliasedComponentCode(
  file: ProjectFileWithNormalizedPath,
  expectedName: string,
): string {
  const cleaned = cleanComponent(file.content);
  if (
    new RegExp(`\\b(?:function|const|class)\\s+${expectedName}\\b`).test(
      cleaned,
    )
  ) {
    return cleaned;
  }

  const exportName = detectPrimaryExportName(file.content, cleaned);
  if (exportName && exportName !== expectedName) {
    return `${cleaned}\n\nconst ${expectedName} = ${exportName};`;
  }

  return cleaned;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function runWrangler(args: string[], timeout: number): string {
  mkdirSync(WRANGLER_EXEC_CWD, { recursive: true });
  return execFileSync(
    "npm",
    [
      "exec",
      "--yes",
      "--package",
      `wrangler@${WRANGLER_VERSION}`,
      "--",
      "wrangler",
      ...args,
    ],
    {
      encoding: "utf-8",
      timeout,
      cwd: WRANGLER_EXEC_CWD,
      env: {
        ...process.env,
        CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
        CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
      },
    },
  );
}

/** Strip imports, exports, "use client", and basic TypeScript syntax from a component file */
function cleanComponent(code: string): string {
  const cleaned = code
    // Remove "use client" directive
    .replace(/^["']use client["'];?\s*\n?/m, "")
    // Remove all import statements
    .replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, "")
    .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, "")
    // Remove common export forms
    .replace(/export\s+default\s+async\s+function\s+/g, "async function ")
    .replace(/export\s+default\s+function\s+/g, "function ")
    .replace(/export\s+async\s+function\s+/g, "async function ")
    .replace(/export\s+function\s+/g, "function ")
    .replace(/export\s+const\s+/g, "const ")
    .replace(/export\s+let\s+/g, "let ")
    .replace(/export\s+var\s+/g, "var ")
    .replace(/export\s+class\s+/g, "class ")
    .replace(/^export\s+\{[\s\S]*?\}\s*;?\s*$/gm, "")
    .replace(/^export\s+\*\s+from\s+['"][^'"]+['"]\s*;?\s*$/gm, "")
    .replace(/^export\s+\*\s+as\s+\w+\s+from\s+['"][^'"]+['"]\s*;?\s*$/gm, "")
    .replace(/^export\s+default\s+/gm, "")
    .replace(/^export\s+/gm, "")
    // Remove interface definitions (single line and multi-line)
    .replace(/^interface\s+\w+\s*\{[\s\S]*?\}\s*$/gm, "")
    // Remove type definitions
    .replace(/^type\s+\w+\s*=[\s\S]*?;$/gm, "")
    // Remove inline type annotations from destructured parameters: ({ prop }: { prop: string }) => ({ prop })
    .replace(/\(\s*\{([^}]+)\}\s*:\s*\{[^}]+\}\s*\)/g, "({ $1 })")
    // Remove type annotations from function return types
    .replace(/\):\s*(?:JSX\.Element|React\.ReactElement|React\.ReactNode|ReactNode)/g, ")")
    // Remove React.FC and similar type annotations
    .replace(/:\s*React\.FC(<[^>]+>)?/g, "")
    .replace(/:\s*FC(<[^>]+>)?/g, "")
    // Remove generic type parameters from function declarations
    .replace(/function\s+(\w+)\s*<[^>]+>\s*\(/g, "function $1(")
    // Clean up excessive newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}

/** Strip @tailwind directives (CDN handles them) but keep custom CSS */
function cleanCss(css: string): string {
  return css.replace(/@tailwind\s+\w+;?\s*/g, "").trim();
}

function componentTagUsed(code: string, componentName: string): boolean {
  const re = new RegExp(`<\\s*${componentName}(\\s|/|>)`);
  return re.test(code);
}

function normalizeClassTokens(raw: string): string {
  return raw
    .replace(/\$\{[^}]+\}/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractClassNameFromTag(source: string, tagName: "html" | "body"): string {
  const tagMatch = source.match(new RegExp(`<${tagName}[^>]*>`, "i"));
  if (!tagMatch) return "";
  const tag = tagMatch[0];

  const directDouble = tag.match(/className\s*=\s*"([^"]*)"/i);
  if (directDouble?.[1]) return normalizeClassTokens(directDouble[1]);

  const directSingle = tag.match(/className\s*=\s*'([^']*)'/i);
  if (directSingle?.[1]) return normalizeClassTokens(directSingle[1]);

  const braceDouble = tag.match(/className\s*=\s*\{\s*"([^"]*)"\s*\}/i);
  if (braceDouble?.[1]) return normalizeClassTokens(braceDouble[1]);

  const braceSingle = tag.match(/className\s*=\s*\{\s*'([^']*)'\s*\}/i);
  if (braceSingle?.[1]) return normalizeClassTokens(braceSingle[1]);

  const template = tag.match(/className\s*=\s*\{\s*`([\s\S]*?)`\s*\}/i);
  if (template?.[1]) return normalizeClassTokens(template[1]);

  return "";
}

function mergeClassNames(...values: Array<string | undefined | null>): string {
  const tokens = values
    .filter(Boolean)
    .flatMap((value) => String(value).split(/\s+/))
    .map((t) => t.trim())
    .filter(Boolean);
  return Array.from(new Set(tokens)).join(" ");
}

function extractArrayLiteralFromIndex(source: string, fromIndex: number): string | null {
  const start = source.indexOf("[", fromIndex);
  if (start === -1) return null;

  let depth = 0;
  let inString: "'" | '"' | "`" | null = null;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      inString = ch;
      continue;
    }

    if (ch === "[") depth++;
    if (ch === "]") {
      depth--;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  return null;
}

let lucideIconNodeLiteralCache: Map<string, string> | null = null;

function loadLucideIconNodeLiterals(): Map<string, string> {
  if (lucideIconNodeLiteralCache) {
    return lucideIconNodeLiteralCache;
  }

  const iconByName = new Map<string, string>();
  try {
    const lucideCjsPath = join(
      process.cwd(),
      "node_modules/lucide-react/dist/cjs/lucide-react.js",
    );
    const source = readFileSync(lucideCjsPath, "utf-8");
    const iconByVariableName = new Map<string, string>();

    const createIconRe =
      /const\s+([A-Za-z_$][\w$]*)\s*=\s*createLucideIcon\(\s*"([^"]+)"\s*,\s*\[/g;
    let match: RegExpExecArray | null;
    while ((match = createIconRe.exec(source)) !== null) {
      const variableName = match[1];
      const displayName = match[2];
      const nodeLiteral = extractArrayLiteralFromIndex(
        source,
        match.index + match[0].length - 1,
      );
      if (!nodeLiteral) continue;

      iconByVariableName.set(variableName, nodeLiteral);
      iconByName.set(displayName, nodeLiteral);
      iconByName.set(variableName, nodeLiteral);
    }

    const exportAliasRe =
      /exports\.([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*;/g;
    while ((match = exportAliasRe.exec(source)) !== null) {
      const exportName = match[1];
      const variableName = match[2];
      const nodeLiteral = iconByVariableName.get(variableName);
      if (nodeLiteral) {
        iconByName.set(exportName, nodeLiteral);
      }
    }
  } catch (error) {
    console.warn("[publish] Failed to load Lucide icon definitions:", error);
  }

  lucideIconNodeLiteralCache = iconByName;
  return iconByName;
}

function extractPotentialJsxComponentNames(code: string): Set<string> {
  const names = new Set<string>();
  const plainTagRe = /<\s*([A-Z][A-Za-z0-9_]*)\b/g;
  const memberTagRe = /<\s*[A-Z][A-Za-z0-9_]*\.([A-Z][A-Za-z0-9_]*)\b/g;

  let match: RegExpExecArray | null;
  while ((match = plainTagRe.exec(code)) !== null) {
    names.add(match[1]);
  }
  while ((match = memberTagRe.exec(code)) !== null) {
    names.add(match[1]);
  }

  return names;
}

function buildLucideRuntimeAssignments(code: string): string {
  const iconNodeLiterals = loadLucideIconNodeLiterals();
  if (iconNodeLiterals.size === 0) return "";

  const candidateNames = extractPotentialJsxComponentNames(code);
  const iconNames = Array.from(candidateNames)
    .filter((name) => iconNodeLiterals.has(name))
    .sort((a, b) => a.localeCompare(b));

  return iconNames
    .map((name) => {
      const nodeLiteral = iconNodeLiterals.get(name);
      if (!nodeLiteral) return "";
      return `window[${JSON.stringify(name)}] = createLucideIconFromNode(${JSON.stringify(name)}, ${nodeLiteral});`;
    })
    .filter(Boolean)
    .join("\n        ");
}

function extractObjectLiteralFromIndex(source: string, fromIndex: number): string | null {
  const start = source.indexOf("{", fromIndex);
  if (start === -1) return null;

  let depth = 0;
  let inString: "'" | '"' | "`" | null = null;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      inString = ch;
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  return null;
}

function extractTailwindConfigObjectLiteral(configCode: string): string | null {
  const normalized = configCode
    .replace(/^import\s+type\s+.*$/gm, "")
    .replace(/^import\s+.*$/gm, "")
    .replace(/^type\s+.*$/gm, "")
    .trim();

  const moduleExportsMatch = normalized.match(/module\.exports\s*=/);
  if (moduleExportsMatch?.index !== undefined) {
    return extractObjectLiteralFromIndex(
      normalized,
      moduleExportsMatch.index + moduleExportsMatch[0].length,
    );
  }

  const exportDefaultObjectMatch = normalized.match(/export\s+default\s*{/);
  if (exportDefaultObjectMatch?.index !== undefined) {
    return extractObjectLiteralFromIndex(
      normalized,
      exportDefaultObjectMatch.index + "export default".length,
    );
  }

  const exportDefaultRefMatch = normalized.match(
    /export\s+default\s+([A-Za-z_$][\w$]*)\s*;?/,
  );
  if (exportDefaultRefMatch) {
    const varName = exportDefaultRefMatch[1];
    const varDeclRe = new RegExp(
      `(?:const|let|var)\\s+${varName}(?:\\s*:\\s*[\\s\\S]*?)?\\s*=`,
    );
    const varDeclMatch = normalized.match(varDeclRe);
    if (varDeclMatch?.index !== undefined) {
      return extractObjectLiteralFromIndex(
        normalized,
        varDeclMatch.index + varDeclMatch[0].length,
      );
    }
  }

  return null;
}

// ── HTML Builder ────────────────────────────────────────────────

function buildPageHtml(opts: {
  title: string;
  htmlClass?: string;
  globalsCss: string;
  tailwindConfigObjectLiteral?: string | null;
  navbarCode: string;
  footerCode: string;
  bodyClass?: string;
  renderNavbar: boolean;
  renderFooter: boolean;
  sectionCodes: { name: string; code: string }[];
  pageCode: string | null; // null for home (sections rendered directly), string for sub-pages
  sectionNames: string[];
  isDark: boolean;
}): string {
  const {
    title,
    htmlClass,
    globalsCss,
    tailwindConfigObjectLiteral,
    navbarCode,
    footerCode,
    bodyClass,
    renderNavbar,
    renderFooter,
    sectionCodes,
    pageCode,
    sectionNames,
    isDark,
  } = opts;

  // Combine all component code
  const allCode = [
    navbarCode,
    ...sectionCodes.map((c) => c.code),
    ...(pageCode ? [pageCode] : []),
    footerCode,
  ].join("\n\n");

  // Build the main content for the App component
  let mainContent: string;
  if (pageCode) {
    // Sub-page: the page function renders its own header + sections
    const fnMatch = pageCode.match(/function\s+(\w+)/);
    const pageFnName = fnMatch ? fnMatch[1] : "SubPage";
    mainContent = `<${pageFnName} />`;
  } else {
    // Home: render sections directly
    mainContent = sectionNames.map((n) => `          <${n} />`).join("\n");
  }

  const appCode = pageCode
    ? `
${allCode}

function App() {
  return (
    <React.Fragment>
${renderNavbar ? "      <Navbar />\n" : ""}      ${mainContent}
${renderFooter ? "      <Footer />\n" : ""}    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
`
    : `
${allCode}

function App() {
  return (
    <React.Fragment>
${renderNavbar ? "      <Navbar />\n" : ""}      <main>
${mainContent}
      </main>
${renderFooter ? "      <Footer />\n" : ""}    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
`;

  const lucideRuntimeAssignments = buildLucideRuntimeAssignments(appCode);

  // Base64-encode the code to avoid HTML escaping issues
  const codeBase64 = Buffer.from(appCode).toString("base64");
  const tailwindConfigBase64 = tailwindConfigObjectLiteral
    ? Buffer.from(tailwindConfigObjectLiteral).toString("base64")
    : null;
  const resolvedHtmlClass = (htmlClass || "").trim();
  const resolvedBodyClass = (bodyClass || "").trim();

  return `<!DOCTYPE html>
<html lang="en"${resolvedHtmlClass ? ` class="${escHtml(resolvedHtmlClass)}"` : ""}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escHtml(title)}</title>
  ${
    tailwindConfigBase64
      ? `<script>
    try {
      window.tailwind = window.tailwind || {};
      const __cfgRaw = atob("${tailwindConfigBase64}");
      window.tailwind.config = new Function("return (" + __cfgRaw + ")")();
    } catch (e) {
      console.warn("Failed to parse tailwind config for CDN runtime:", e);
    }
  </script>`
      : ""
  }
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    #root { opacity: 0; transition: opacity 0.3s ease; }
    #root.ready { opacity: 1; }
    #loading {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-family: system-ui, -apple-system, sans-serif;
      color: ${isDark ? "#d1d5db" : "#111827"};
      font-size: 18px;
    }
${cleanCss(globalsCss)}
  </style>
</head>
<body${resolvedBodyClass ? ` class="${escHtml(resolvedBodyClass)}"` : ""}>
  <div id="loading">Loading...</div>
  <div id="root"></div>

  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>

  <script>
    try {
        // Expose React hooks as globals
        const { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } = React;
        Object.assign(window, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext });
        window.Fragment = React.Fragment;

        const escapeHtml = (text) => String(text ?? "")
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const showRuntimeError = (error) => {
          const loading = document.getElementById('loading');
          if (loading) loading.style.display = 'none';
          const root = document.getElementById('root');
          const message = error && error.message ? error.message : String(error);
          const details = error && error.stack ? '\\n\\n' + error.stack : '';
          const html = '<div style="padding:20px;font-family:system-ui;">'
            + '<h1 style="margin:0 0 12px;">Runtime Error</h1>'
            + '<pre style="white-space:pre-wrap;line-height:1.4;">'
            + escapeHtml(message + details)
            + '</pre></div>';
          if (root) {
            root.classList.add('ready');
            root.innerHTML = html;
          } else {
            document.body.innerHTML = html;
          }
        };
        window.addEventListener('error', (event) => {
          if (event && event.error) showRuntimeError(event.error);
        });
        window.addEventListener('unhandledrejection', (event) => {
          showRuntimeError(event && event.reason ? event.reason : new Error('Unhandled promise rejection'));
        });

        // Next.js stubs
        window.__pocketNextLink = function Link({ href, children, className, style, onClick, target, rel, ...restProps }) {
          console.log('Link rendered with children:', children, 'href:', href);
          return React.createElement('a', {
            href: href || '#',
            className,
            style,
            onClick: (e) => {
              console.log('Link clicked:', href);
              if (onClick) onClick(e);
            },
            target,
            rel,
            ...restProps
          }, children);
        };
        window.__pocketNextImage = function Image({ src, alt, width, height, className, style, ...restProps }) {
          return React.createElement('img', {
            src,
            alt,
            width,
            height,
            className,
            style,
            loading: 'lazy',
            ...restProps
          });
        };
        window.Link = window.__pocketNextLink;
        window.Image = window.__pocketNextImage;

        // next/font/google runtime compatibility: generate equivalent className objects and load font CSS.
        const __pocketSerifFonts = new Set([
          'Playfair Display',
          'Merriweather',
          'Cormorant Garamond',
          'Libre Baskerville',
          'Crimson Text',
          'Lora',
          'DM Serif Display',
        ]);
        const __pocketGoogleFontLoaders = [
          'Inter',
          'Poppins',
          'Roboto',
          'Lato',
          'Montserrat',
          'Nunito',
          'Raleway',
          'Oswald',
          'Open_Sans',
          'Playfair_Display',
          'Merriweather',
          'Cormorant_Garamond',
          'DM_Sans',
          'Space_Grotesk',
          'Manrope',
          'Plus_Jakarta_Sans',
          'Work_Sans',
          'Libre_Baskerville',
          'PT_Sans',
          'Noto_Sans',
          'Source_Sans_3',
          'Bebas_Neue',
          'Crimson_Text',
          'Lora',
          'Outfit',
          'Urbanist',
          'Rubik',
          'Figtree',
        ];
        window.__pocketGoogleFontNames = new Set(__pocketGoogleFontLoaders);
        const __pocketLoadedGoogleFonts = new Set();
        window.__pocketCreateGoogleFontLoader = function __pocketCreateGoogleFontLoader(fontFunctionName) {
          const familyName = String(fontFunctionName || '').replace(/_/g, ' ').trim();
          const familyQuery = familyName.replace(/\s+/g, '+');
          const classToken =
            '__font_' + String(fontFunctionName || '')
              .toLowerCase()
              .replace(/[^a-z0-9_]+/g, '_');
          const fallbackFamily = __pocketSerifFonts.has(familyName) ? 'serif' : 'sans-serif';

          return function nextGoogleFontLoader(options = {}) {
            const weightValue = options && options.weight;
            const weightList = Array.isArray(weightValue)
              ? weightValue
              : weightValue
                ? [weightValue]
                : [];
            const safeWeights = weightList
              .map((w) => String(w).trim())
              .filter((w) => /^\d{3}$/.test(w));
            const weightQuery = safeWeights.length > 0 ? ':wght@' + safeWeights.join(';') : '';
            const cacheKey = familyQuery + weightQuery;

            if (!__pocketLoadedGoogleFonts.has(cacheKey)) {
              const linkEl = document.createElement('link');
              linkEl.rel = 'stylesheet';
              linkEl.href = 'https://fonts.googleapis.com/css2?family=' + familyQuery + weightQuery + '&display=swap';
              document.head.appendChild(linkEl);
              __pocketLoadedGoogleFonts.add(cacheKey);
            }

            const styleId = '__pocket_font_style_' + classToken;
            if (!document.getElementById(styleId)) {
              const styleEl = document.createElement('style');
              styleEl.id = styleId;
              styleEl.textContent = '.' + classToken + '{font-family:"' + familyName + '",' + fallbackFamily + ';}';
              document.head.appendChild(styleEl);
            }

            const variableCssName =
              options && typeof options.variable === 'string' ? options.variable.trim() : '';
            const variableToken = variableCssName
              ? classToken + '_var'
              : '';
            if (variableCssName && variableToken) {
              const variableStyleId = '__pocket_font_var_' + classToken;
              if (!document.getElementById(variableStyleId)) {
                const variableStyleEl = document.createElement('style');
                variableStyleEl.id = variableStyleId;
                variableStyleEl.textContent =
                  '.' + variableToken + '{' + variableCssName + ':"' + familyName + '",' + fallbackFamily + ';}';
                document.head.appendChild(variableStyleEl);
              }
            }

            return {
              className: classToken,
              variable: variableToken,
              style: { fontFamily: '"' + familyName + '",' + fallbackFamily },
            };
          };
        };
        __pocketGoogleFontLoaders.forEach((fontFn) => {
          window[fontFn] = window.__pocketCreateGoogleFontLoader(fontFn);
        });

        // Motion value utilities used by framer-motion hooks
        const createMotionValue = (initialValue = 0) => {
          let value = initialValue;
          const listeners = new Set();
          return {
            get: () => value,
            set: (next) => {
              value = next;
              listeners.forEach((listener) => {
                try {
                  listener(value);
                } catch {}
              });
            },
            on: (event, listener) => {
              if (event !== 'change' || typeof listener !== 'function') return () => {};
              listeners.add(listener);
              return () => listeners.delete(listener);
            },
            onChange: (listener) => {
              if (typeof listener !== 'function') return () => {};
              listeners.add(listener);
              return () => listeners.delete(listener);
            },
          };
        };

        const mapRangeValue = (value, inputRange, outputRange) => {
          if (
            !Array.isArray(inputRange) ||
            !Array.isArray(outputRange) ||
            inputRange.length < 2 ||
            outputRange.length < 2
          ) {
            return value;
          }
          const inMin = Number(inputRange[0]);
          const inMax = Number(inputRange[inputRange.length - 1]);
          const outMin = outputRange[0];
          const outMax = outputRange[outputRange.length - 1];

          if (!Number.isFinite(inMin) || !Number.isFinite(inMax) || inMin === inMax) {
            return outMin;
          }

          const t = Math.max(0, Math.min(1, (Number(value) - inMin) / (inMax - inMin)));
          if (typeof outMin === 'number' && typeof outMax === 'number') {
            return outMin + (outMax - outMin) * t;
          }
          return t < 0.5 ? outMin : outMax;
        };

        window.useMotionValue = function useMotionValue(initialValue = 0) {
          const ref = useRef(null);
          if (!ref.current) {
            ref.current = createMotionValue(initialValue);
          }
          return ref.current;
        };

        window.useScroll = function useScroll() {
          const scrollY = window.useMotionValue(0);
          const scrollYProgress = window.useMotionValue(0);

          useEffect(() => {
            const update = () => {
              const y = window.scrollY || 0;
              const maxScroll = Math.max(
                1,
                (document.documentElement?.scrollHeight || 1) - window.innerHeight,
              );
              scrollY.set(y);
              scrollYProgress.set(Math.max(0, Math.min(1, y / maxScroll)));
            };

            update();
            window.addEventListener('scroll', update, { passive: true });
            window.addEventListener('resize', update);
            return () => {
              window.removeEventListener('scroll', update);
              window.removeEventListener('resize', update);
            };
          }, [scrollY, scrollYProgress]);

          return { scrollY, scrollYProgress };
        };

        window.useTransform = function useTransform(sourceValue, inputRange, outputRange) {
          const source =
            sourceValue && typeof sourceValue.get === 'function'
              ? sourceValue
              : createMotionValue(sourceValue ?? 0);
          const derivedRef = useRef(null);
          if (!derivedRef.current) {
            derivedRef.current = createMotionValue(
              mapRangeValue(source.get(), inputRange, outputRange),
            );
          }

          useEffect(() => {
            const update = (v) => {
              derivedRef.current.set(mapRangeValue(v, inputRange, outputRange));
            };
            update(source.get());
            if (typeof source.on === 'function') {
              return source.on('change', update);
            }
            return undefined;
          }, [source, inputRange, outputRange]);

          return derivedRef.current;
        };

        window.useSpring = function useSpring(value) {
          if (value && typeof value.get === 'function') return value;
          return createMotionValue(value ?? 0);
        };

        window.useMotionValueEvent = function useMotionValueEvent(
          value,
          eventName,
          handler,
        ) {
          useEffect(() => {
            if (!value || typeof value.on !== 'function' || typeof handler !== 'function') {
              return undefined;
            }
            return value.on(eventName || 'change', handler);
          }, [value, eventName, handler]);
        };

        window.useAnimation = function useAnimation() {
          return {
            start: async () => {},
            stop: () => {},
            set: () => {},
          };
        };
        window.useAnimationControls = window.useAnimation;
        window.useReducedMotion = function useReducedMotion() {
          return false;
        };

        // useInView stub - simple implementation
        window.useInView = function useInView(options) {
          const ref = useRef(null);
          const [inView, setInView] = useState(false);

          useEffect(() => {
            const element = ref.current;
            if (!element) return;

            const observer = new IntersectionObserver(
              ([entry]) => setInView(entry.isIntersecting),
              options || { threshold: 0.1 }
            );

            observer.observe(element);
            return () => observer.disconnect();
          }, []);

          return { ref, inView };
        };

        // CountUp component stub - simple counting animation
        window.CountUp = function CountUp({ end, start = 0, duration = 2, decimals = 0, prefix = '', suffix = '', ...props }) {
          const [count, setCount] = useState(start);

          useEffect(() => {
            let startTime = null;
            const startValue = start;
            const endValue = end;
            const diff = endValue - startValue;

            const animate = (currentTime) => {
              if (!startTime) startTime = currentTime;
              const progress = Math.min((currentTime - startTime) / (duration * 1000), 1);
              const currentCount = startValue + (diff * progress);

              setCount(currentCount);

              if (progress < 1) {
                requestAnimationFrame(animate);
              } else {
                setCount(endValue);
              }
            };

            requestAnimationFrame(animate);
          }, [end, start, duration]);

          const formattedCount = typeof count === 'number' ? count.toFixed(decimals) : count;
          return React.createElement('span', props, prefix + formattedCount + suffix);
        };

        // Framer Motion stubs - simplified animation components
        const __pocketIsMotionValue = (value) =>
          value && typeof value.get === 'function' && typeof value.on === 'function';
        const __pocketResolveMotionValue = (value) =>
          __pocketIsMotionValue(value) ? value.get() : value;
        const __pocketUnit = (value, unit) =>
          typeof value === 'number' ? String(value) + unit : String(value);
        const __pocketResolveMotionStyle = (...styleSources) => {
          const resolved = {};
          const transformParts = [];

          const pushTransform = (part) => {
            if (part) transformParts.push(part);
          };

          for (const source of styleSources) {
            if (!source || typeof source !== 'object') continue;
            for (const [key, rawValue] of Object.entries(source)) {
              const value = __pocketResolveMotionValue(rawValue);
              if (value === undefined || value === null) continue;

              if (key === 'x') {
                pushTransform('translateX(' + __pocketUnit(value, 'px') + ')');
                continue;
              }
              if (key === 'y') {
                pushTransform('translateY(' + __pocketUnit(value, 'px') + ')');
                continue;
              }
              if (key === 'z') {
                pushTransform('translateZ(' + __pocketUnit(value, 'px') + ')');
                continue;
              }
              if (key === 'scale') {
                pushTransform('scale(' + String(value) + ')');
                continue;
              }
              if (key === 'scaleX') {
                pushTransform('scaleX(' + String(value) + ')');
                continue;
              }
              if (key === 'scaleY') {
                pushTransform('scaleY(' + String(value) + ')');
                continue;
              }
              if (key === 'rotate') {
                pushTransform('rotate(' + __pocketUnit(value, 'deg') + ')');
                continue;
              }
              if (
                key === 'transition' ||
                key === 'transitionEnd' ||
                key === 'whileInView' ||
                key === 'viewport' ||
                key === 'variants'
              ) {
                continue;
              }

              resolved[key] = value;
            }
          }

          if (transformParts.length > 0) {
            const existingTransform = resolved.transform;
            resolved.transform = existingTransform
              ? String(existingTransform) + ' ' + transformParts.join(' ')
              : transformParts.join(' ');
          }

          return resolved;
        };
        const __pocketCollectMotionValues = (...styleSources) => {
          const values = [];
          for (const source of styleSources) {
            if (!source || typeof source !== 'object') continue;
            for (const rawValue of Object.values(source)) {
              if (__pocketIsMotionValue(rawValue)) {
                values.push(rawValue);
              }
            }
          }
          return values;
        };

        window.motion = new Proxy({}, {
          get(target, prop) {
            // Return a component that accepts motion props but renders as regular HTML
            return function MotionComponent({ children, initial, animate, transition, whileHover, whileTap, variants, className, style, onClick, href, ...restProps }) {
              // Start with animate style by default (skip animation), or initial if no animate
              const [currentStyle, setCurrentStyle] = useState(animate || {});
              const [isHovered, setIsHovered] = useState(false);
              const [, setMotionTick] = useState(0);

              useEffect(() => {
                // Only animate if both initial and animate are provided
                if (initial && animate) {
                  // Start with initial
                  setCurrentStyle(initial);
                  // Then animate to target
                  const timer = setTimeout(() => {
                    setCurrentStyle(animate);
                  }, 50);
                  return () => clearTimeout(timer);
                }
              }, []);

              useEffect(() => {
                const motionValues = __pocketCollectMotionValues(
                  style,
                  currentStyle,
                  isHovered ? whileHover : null,
                );
                if (motionValues.length === 0) return undefined;

                const unsubscribers = motionValues.map((value) =>
                  value.on('change', () => setMotionTick((tick) => tick + 1)),
                );
                return () => {
                  unsubscribers.forEach((unsubscribe) => {
                    if (typeof unsubscribe === 'function') unsubscribe();
                  });
                };
              }, [style, currentStyle, whileHover, isHovered]);

              const mergedStyle = __pocketResolveMotionStyle(
                style,
                currentStyle,
                isHovered && whileHover ? whileHover : null,
              );
              mergedStyle.transition = transition?.duration
                ? 'all ' + String(transition.duration) + 's ease'
                : 'all 0.3s ease';

              const elementProps = {
                ...restProps,
                className,
                style: mergedStyle,
                onClick: onClick ? (e) => {
                  console.log('Motion element clicked:', prop, 'onClick exists:', !!onClick);
                  onClick(e);
                } : undefined,
                href,
                onMouseEnter: whileHover ? () => setIsHovered(true) : undefined,
                onMouseLeave: whileHover ? () => setIsHovered(false) : undefined,
              };

              // Log rendering for debugging
              if (prop === 'button' || prop === 'a') {
                console.log(\`motion.\${prop} rendered with children:\`, children, 'onClick:', !!onClick);
              }

              return React.createElement(prop, elementProps, children);
            };
          }
        });

        window.AnimatePresence = function AnimatePresence({ children }) {
          return React.createElement(React.Fragment, null, children);
        };

        // Lucide icon stubs - create SVG icon components
        const createIcon = (pathData, displayName) => {
          const Icon = (props) => React.createElement('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: props.size || props.width || 24,
            height: props.size || props.height || 24,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: props.color || 'currentColor',
            strokeWidth: props.strokeWidth || 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            className: props.className,
            style: props.style
          }, React.createElement('path', { d: pathData }));
          Icon.displayName = displayName;
          return Icon;
        };

        const createLucideIconFromNode = (displayName, iconNode) => {
          const Icon = (props = {}) =>
            React.createElement(
              'svg',
              {
                xmlns: 'http://www.w3.org/2000/svg',
                width: props.size || props.width || 24,
                height: props.size || props.height || 24,
                viewBox: '0 0 24 24',
                fill: 'none',
                stroke: props.color || 'currentColor',
                strokeWidth: props.strokeWidth || 2,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                className: props.className,
                style: props.style,
              },
              ...iconNode.map((node, idx) => {
                const [tag, attrs] = node;
                const key = attrs && attrs.key ? attrs.key : (displayName + '_' + idx);
                return React.createElement(tag, { ...attrs, key });
              }),
            );
          Icon.displayName = displayName;
          return Icon;
        };

        // Generic fallback icon for any missing icons
        const createFallbackIcon = (name) => {
          return createIcon('M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z', name);
        };

        // Common lucide icons
        window.Menu = createIcon('M3 12h18M3 6h18M3 18h18', 'Menu');
        window.X = createIcon('M18 6L6 18M6 6l12 12', 'X');
        window.Twitter = createIcon('M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z', 'Twitter');
        window.Facebook = createIcon('M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z', 'Facebook');
        window.Instagram = createIcon('M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zm1.5-4.87h.01', 'Instagram');
        window.Github = createIcon('M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22', 'Github');
        window.Linkedin = createIcon('M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z', 'Linkedin');
        window.Mail = createIcon('M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6', 'Mail');
        window.Phone = createIcon('M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z', 'Phone');
        window.MapPin = createIcon('M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 13a3 3 0 100-6 3 3 0 000 6z', 'MapPin');
        window.ArrowRight = createIcon('M5 12h14M12 5l7 7-7 7', 'ArrowRight');
        window.ArrowLeft = createIcon('M19 12H5M12 19l-7-7 7-7', 'ArrowLeft');
        window.ChevronRight = createIcon('M9 18l6-6-6-6', 'ChevronRight');
        window.ChevronLeft = createIcon('M15 18l-6-6 6-6', 'ChevronLeft');
        window.ChevronDown = createIcon('M6 9l6 6 6-6', 'ChevronDown');
        window.ChevronUp = createIcon('M18 15l-6-6-6 6', 'ChevronUp');
        window.Check = createIcon('M20 6L9 17l-5-5', 'Check');
        window.Utensils = createIcon('M3 2v7c0 2.2 1.8 4 4 4h1v9h2v-9h1c2.2 0 4-1.8 4-4V2h-2v7c0 1.1-.9 2-2 2h-1V2H8v9H7c-1.1 0-2-.9-2-2V2H3zM19 2v20h2V2h-2z', 'Utensils');
        window.UtensilsCrossed = createIcon('M16 2l6 6M10 14L4 8m0 0l4-4m-4 4l-2 2m10 4l8 8m0 0l2-2m-2 2l-4 4M9 3l12 12', 'UtensilsCrossed');
        window.ChefHat = createIcon('M6 18h12M8 18v-3h8v3M7 15a4 4 0 01-1-7.87A5 5 0 0116.9 6 4 4 0 0117 15H7z', 'ChefHat');
        window.Star = createIcon('M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', 'Star');
        window.Heart = createIcon('M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z', 'Heart');
        window.ShoppingCart = createIcon('M9 2L7.17 6M20.59 13.41l-1.3 5.2a2 2 0 01-1.94 1.5H6.65a2 2 0 01-1.94-1.5L2.41 8.41A1 1 0 013.36 7h17.28a1 1 0 01.95 1.41z M9 11v6M15 11v6', 'ShoppingCart');
        window.Search = createIcon('M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35', 'Search');
        window.User = createIcon('M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z', 'User');
        window.Users = createIcon('M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M13 7a4 4 0 11-8 0 4 4 0 018 0z', 'Users');
        window.Calendar = createIcon('M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18', 'Calendar');
        window.Clock = createIcon('M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2', 'Clock');
        window.Download = createIcon('M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3', 'Download');
        window.Upload = createIcon('M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12', 'Upload');
        window.ExternalLink = createIcon('M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3', 'ExternalLink');
        window.Home = createIcon('M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'Home');
        window.Settings = createIcon('M12 15a3 3 0 100-6 3 3 0 000 6z', 'Settings');
        window.LogOut = createIcon('M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9', 'LogOut');
        window.LogIn = createIcon('M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M21 12H7', 'LogIn');
        window.Zap = createIcon('M13 2L3 14h8l-1 8 10-12h-8l1-8z', 'Zap');
        window.Shield = createIcon('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'Shield');
        window.Lock = createIcon('M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4', 'Lock');
        window.Unlock = createIcon('M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 019.9-1', 'Unlock');
        window.Eye = createIcon('M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 100-6 3 3 0 000 6z', 'Eye');
        window.EyeOff = createIcon('M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22', 'EyeOff');
        window.Bell = createIcon('M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0', 'Bell');
        window.BellOff = createIcon('M13.73 21a2 2 0 01-3.46 0M18.63 13A17.89 17.89 0 0118 8M6.26 6.26A5.86 5.86 0 006 8c0 7-3 9-3 9h14M18 8a6 6 0 00-9.33-5M1 1l22 22', 'BellOff');
        window.AlertCircle = createIcon('M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8v4M12 16h.01', 'AlertCircle');
        window.AlertTriangle = createIcon('M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01', 'AlertTriangle');
        window.Info = createIcon('M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 16v-4M12 8h.01', 'Info');
        window.CheckCircle = createIcon('M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3', 'CheckCircle');
        window.XCircle = createIcon('M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM15 9l-6 6M9 9l6 6', 'XCircle');
        window.Plus = createIcon('M12 5v14M5 12h14', 'Plus');
        window.Minus = createIcon('M5 12h14', 'Minus');
        window.Edit = createIcon('M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', 'Edit');
        window.Trash = createIcon('M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2', 'Trash');
        window.Trash2 = createIcon('M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6', 'Trash2');
        window.Copy = createIcon('M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1', 'Copy');
        window.File = createIcon('M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9zM13 2v7h7', 'File');
        window.FileText = createIcon('M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8', 'FileText');
        window.Folder = createIcon('M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z', 'Folder');
        window.Image = createIcon('M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 15l-5-5L5 21', 'Image');
        window.Play = createIcon('M5 3l14 9-14 9V3z', 'Play');
        window.Pause = createIcon('M6 4h4v16H6zM14 4h4v16h-4z', 'Pause');
        window.Volume2 = createIcon('M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07', 'Volume2');
        window.VolumeX = createIcon('M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6', 'VolumeX');
        window.Mic = createIcon('M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8', 'Mic');
        window.Camera = createIcon('M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z', 'Camera');
        window.Video = createIcon('M23 7l-7 5 7 5V7zM16 5H3a2 2 0 00-2 2v10a2 2 0 002 2h13a2 2 0 002-2V7a2 2 0 00-2-2z', 'Video');
        window.Music = createIcon('M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z', 'Music');
        window.Bookmark = createIcon('M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z', 'Bookmark');
        window.Tag = createIcon('M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01', 'Tag');
        window.Package = createIcon('M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12', 'Package');
        window.Gift = createIcon('M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z', 'Gift');
        window.Award = createIcon('M12 15a7 7 0 100-14 7 7 0 000 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12', 'Award');
        window.TrendingUp = createIcon('M23 6l-9.5 9.5-5-5L1 18M23 6h-7M23 6v7', 'TrendingUp');
        window.TrendingDown = createIcon('M23 18l-9.5-9.5-5 5L1 6M23 18h-7M23 18v-7', 'TrendingDown');
        window.BarChart = createIcon('M12 20V10M18 20V4M6 20v-4', 'BarChart');
        window.PieChart = createIcon('M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z', 'PieChart');
        window.Activity = createIcon('M22 12h-4l-3 9L9 3l-3 9H2', 'Activity');
        window.Cpu = createIcon('M4 4h16v16H4zM9 9h6v6H9zM9 2v2M15 2v2M9 20v2M15 20v2M20 9h2M20 15h2M2 9h2M2 15h2', 'Cpu');
        window.Database = createIcon('M12 8c-4.97 0-9-1.343-9-3s4.03-3 9-3 9 1.343 9 3-4.03 3-9 3zM21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5', 'Database');
        window.Server = createIcon('M20 2H4c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM20 14H4c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2zM6 7h.01M6 19h.01', 'Server');
        window.Wifi = createIcon('M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01', 'Wifi');
        window.WifiOff = createIcon('M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.58 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01', 'WifiOff');
        window.Bluetooth = createIcon('M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11', 'Bluetooth');
        window.Cast = createIcon('M2 16.1A5 5 0 015.9 20M2 12.05A9 9 0 019.95 20M2 8V6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2h-6M2 20h.01', 'Cast');
        window.Airplay = createIcon('M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-1M12 15l5 6H7l5-6z', 'Airplay');
        window.Monitor = createIcon('M20 3H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V5a2 2 0 00-2-2zM8 21h8M12 17v4', 'Monitor');
        window.Smartphone = createIcon('M17 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2zM12 18h.01', 'Smartphone');
        window.Tablet = createIcon('M18 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zM12 18h.01', 'Tablet');
        window.Laptop = createIcon('M20 16V7a2 2 0 00-2-2H6a2 2 0 00-2 2v9M2 17h20v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2z', 'Laptop');
        window.Globe = createIcon('M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z', 'Globe');
        window.Compass = createIcon('M12 2a10 10 0 100 20 10 10 0 000-20zM16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z', 'Compass');
        window.Navigation = createIcon('M3 11l19-9-9 19-2-8-8-2z', 'Navigation');
        window.Anchor = createIcon('M12 2v20M5 12H2a10 10 0 0020 0h-3', 'Anchor');
        window.Feather = createIcon('M20.24 12.24a6 6 0 00-8.49-8.49L5 10.5V19h8.5zM16 8L2 22M17.5 15H9', 'feather');
        window.Send = createIcon('M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z', 'Send');
        window.MessageCircle = createIcon('M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z', 'MessageCircle');
        window.MessageSquare = createIcon('M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z', 'MessageSquare');
        window.Layers = createIcon('M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', 'Layers');
        window.Layout = createIcon('M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM3 9h18M9 21V9', 'Layout');
        window.Grid = createIcon('M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z', 'Grid');
        window.Square = createIcon('M3 3h18v18H3z', 'Square');
        window.Circle = createIcon('M12 2a10 10 0 100 20 10 10 0 000-20z', 'Circle');
        window.Triangle = createIcon('M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', 'Triangle');
        window.Hexagon = createIcon('M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z', 'Hexagon');
        window.Octagon = createIcon('M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2z', 'Octagon');
        window.Link = createIcon('M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71', 'Link');
        window.Link2 = createIcon('M15 7h3a5 5 0 015 5 5 5 0 01-5 5h-3m-6 0H6a5 5 0 01-5-5 5 5 0 015-5h3M8 12h8', 'Link2');
        window.Paperclip = createIcon('M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48', 'Paperclip');
        window.Code = createIcon('M16 18l6-6-6-6M8 6l-6 6 6 6', 'Code');
        window.Terminal = createIcon('M4 17l6-6-6-6M12 19h8', 'Terminal');
        window.Command = createIcon('M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3H6a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3V6a3 3 0 00-3-3 3 3 0 00-3 3 3 3 0 003 3h12a3 3 0 003-3 3 3 0 00-3-3z', 'Command');
        window.Hash = createIcon('M4 9h16M4 15h16M10 3L8 21M16 3l-2 18', 'Hash');
        window.AtSign = createIcon('M12 16a4 4 0 100-8 4 4 0 000 8zM16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94', 'AtSign');
        window.DollarSign = createIcon('M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6', 'DollarSign');
        window.Percent = createIcon('M19 5L5 19M6.5 6.5a2 2 0 100-4 2 2 0 000 4zM17.5 17.5a2 2 0 100-4 2 2 0 000 4z', 'Percent');
        window.Maximize = createIcon('M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3', 'Maximize');
        window.Minimize = createIcon('M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3', 'Minimize');
        window.Maximize2 = createIcon('M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7', 'Maximize2');
        window.Minimize2 = createIcon('M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7', 'Minimize2');
        window.Move = createIcon('M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20', 'Move');
        window.MoreHorizontal = createIcon('M12 13a1 1 0 100-2 1 1 0 000 2zM19 13a1 1 0 100-2 1 1 0 000 2zM5 13a1 1 0 100-2 1 1 0 000 2z', 'MoreHorizontal');
        window.MoreVertical = createIcon('M12 12a1 1 0 100-2 1 1 0 000 2zM12 5a1 1 0 100-2 1 1 0 000 2zM12 19a1 1 0 100-2 1 1 0 000 2z', 'MoreVertical');
        window.RefreshCw = createIcon('M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15', 'RefreshCw');
        window.RotateCw = createIcon('M23 4v6h-6M20.49 15a9 9 0 11-2.12-9.36L23 10', 'RotateCw');
        window.Loader = createIcon('M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83', 'Loader');
        window.Filter = createIcon('M22 3H2l8 9.46V19l4 2v-8.54L22 3z', 'Filter');
        window.Sliders = createIcon('M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6', 'Sliders');
        window.ToggleLeft = createIcon('M16 4H8a8 8 0 000 16h8a8 8 0 000-16zM8 15a3 3 0 110-6 3 3 0 010 6z', 'ToggleLeft');
        window.ToggleRight = createIcon('M16 4H8a8 8 0 000 16h8a8 8 0 000-16zM16 15a3 3 0 110-6 3 3 0 010 6z', 'ToggleRight');

        // Exact lucide node definitions for all icons used by this page build.
        // This keeps published icon shapes aligned with preview without manual per-icon patches.
${lucideRuntimeAssignments
  ? `        ${lucideRuntimeAssignments}`
  : "        // No lucide icon usage detected in JSX for this page."
}

        // Create ALL common Lucide icons programmatically to prevent any "not defined" errors
        const commonIconNames = [
          'Accessibility', 'Activity', 'Airplay', 'AlertCircle', 'AlertOctagon', 'AlertTriangle',
          'AlignCenter', 'AlignJustify', 'AlignLeft', 'AlignRight', 'Anchor', 'Aperture',
          'Archive', 'ArrowDown', 'ArrowDownCircle', 'ArrowDownLeft', 'ArrowDownRight',
          'ArrowLeft', 'ArrowLeftCircle', 'ArrowRight', 'ArrowRightCircle', 'ArrowUp',
          'ArrowUpCircle', 'ArrowUpLeft', 'ArrowUpRight', 'AtSign', 'Award', 'BarChart',
          'Crown', 'Gem', 'Diamond', 'Sparkles', 'Sparkle', 'Medal', 'Trophy', 'Target',
          'Flame', 'Rocket', 'Plane', 'Ship', 'Train', 'Car', 'Bike',
          'BarChart2', 'Battery', 'BatteryCharging', 'Bell', 'BellOff', 'Bluetooth', 'Bold',
          'Book', 'BookOpen', 'Bookmark', 'Box', 'Briefcase', 'Calendar', 'Camera', 'CameraOff',
          'Cast', 'Check', 'CheckCircle', 'CheckSquare', 'ChevronDown', 'ChevronLeft',
          'ChevronRight', 'ChevronUp', 'ChevronsDown', 'ChevronsLeft', 'ChevronsRight',
          'ChevronsUp', 'Chrome', 'Circle', 'Clipboard', 'Clock', 'Cloud', 'CloudDrizzle',
          'CloudLightning', 'CloudOff', 'CloudRain', 'CloudSnow', 'Code', 'Codepen', 'Codesandbox',
          'Coffee', 'Columns', 'Command', 'Compass', 'Copy', 'CornerDownLeft', 'CornerDownRight',
          'CornerLeftDown', 'CornerLeftUp', 'CornerRightDown', 'CornerRightUp', 'CornerUpLeft',
          'CornerUpRight', 'Cpu', 'CreditCard', 'Crop', 'Crosshair', 'Database', 'Delete',
          'Disc', 'DollarSign', 'Download', 'DownloadCloud', 'Droplet', 'Edit', 'Edit2',
          'Edit3', 'ExternalLink', 'Eye', 'EyeOff', 'Facebook', 'FastForward', 'Feather',
          'Figma', 'File', 'FileMinus', 'FilePlus', 'FileText', 'Film', 'Filter', 'Flag',
          'Folder', 'FolderMinus', 'FolderPlus', 'Framer', 'Frown', 'Gift', 'GitBranch',
          'GitCommit', 'GitMerge', 'GitPullRequest', 'GitHub', 'Gitlab', 'Globe', 'Grid',
          'HardDrive', 'Hash', 'Headphones', 'Heart', 'HelpCircle', 'Hexagon', 'Home', 'Image',
          'Inbox', 'Info', 'Instagram', 'Italic', 'Key', 'Layers', 'Layout', 'Leaf', 'LifeBuoy',
          'Link', 'Link2', 'Linkedin', 'List', 'Loader', 'Lock', 'LogIn', 'LogOut', 'Mail',
          'Map', 'MapPin', 'Maximize', 'Maximize2', 'Meh', 'Menu', 'MessageCircle',
          'MessageSquare', 'Mic', 'MicOff', 'Minimize', 'Minimize2', 'Minus', 'MinusCircle',
          'MinusSquare', 'Monitor', 'Moon', 'MoreHorizontal', 'MoreVertical', 'MousePointer',
          'Move', 'Music', 'Navigation', 'Navigation2', 'Octagon', 'Package', 'Paperclip',
          'Pause', 'PauseCircle', 'PenTool', 'Percent', 'Phone', 'PhoneCall', 'PhoneForwarded',
          'PhoneIncoming', 'PhoneMissed', 'PhoneOff', 'PhoneOutgoing', 'PieChart', 'Play',
          'PlayCircle', 'Plus', 'PlusCircle', 'PlusSquare', 'Pocket', 'Power', 'Printer',
          'Radio', 'RefreshCcw', 'RefreshCw', 'Repeat', 'Rewind', 'RotateCcw', 'RotateCw',
          'Rss', 'Save', 'Scissors', 'Search', 'Send', 'Server', 'Settings', 'Share', 'Share2',
          'Shield', 'ShieldOff', 'ShoppingBag', 'ShoppingCart', 'Shuffle', 'Sidebar', 'SkipBack',
          'SkipForward', 'Slack', 'Slash', 'Sliders', 'Smartphone', 'Smile', 'Speaker', 'Square',
          'Star', 'StopCircle', 'Sun', 'Sunrise', 'Sunset', 'Tablet', 'Tag', 'Target', 'Terminal',
          'Thermometer', 'ThumbsDown', 'ThumbsUp', 'ToggleLeft', 'ToggleRight', 'Tool', 'Trash',
          'Trash2', 'Trello', 'TrendingDown', 'TrendingUp', 'Triangle', 'Truck', 'Tv', 'Twitch',
          'Twitter', 'Type', 'Umbrella', 'Underline', 'Unlock', 'Upload', 'UploadCloud', 'User',
          'UserCheck', 'UserMinus', 'UserPlus', 'UserX', 'Users', 'Video', 'VideoOff', 'Voicemail',
          'Volume', 'Volume1', 'Volume2', 'VolumeX', 'Watch', 'Wifi', 'WifiOff', 'Wind', 'X',
          'XCircle', 'XOctagon', 'XSquare', 'Youtube', 'Zap', 'ZapOff', 'ZoomIn', 'ZoomOut'
        ];

        // Create all icons upfront
        commonIconNames.forEach(iconName => {
          if (!window[iconName]) {
            window[iconName] = createFallbackIcon(iconName);
          }
        });

        // Preserve both Next.js component behavior and lucide icon behavior for names that collide.
        const lucideLinkIcon = window.Link;
        const lucideImageIcon = window.Image;
        window.Link = function HybridLink(props = {}) {
          const hasNavigationProps =
            Object.prototype.hasOwnProperty.call(props, 'href') ||
            Object.prototype.hasOwnProperty.call(props, 'target') ||
            Object.prototype.hasOwnProperty.call(props, 'rel') ||
            Object.prototype.hasOwnProperty.call(props, 'onClick') ||
            props.children !== undefined;
          if (hasNavigationProps) {
            return window.__pocketNextLink(props);
          }
          if (typeof lucideLinkIcon === 'function') {
            return lucideLinkIcon(props);
          }
          return null;
        };
        window.Image = function HybridImage(props = {}) {
          const hasImageProps =
            Object.prototype.hasOwnProperty.call(props, 'src') ||
            Object.prototype.hasOwnProperty.call(props, 'alt') ||
            Object.prototype.hasOwnProperty.call(props, 'width') ||
            Object.prototype.hasOwnProperty.call(props, 'height');
          if (hasImageProps) {
            return window.__pocketNextImage(props);
          }
          if (typeof lucideImageIcon === 'function') {
            return lucideImageIcon(props);
          }
          return null;
        };

        console.log('Icon stubs and useInView loaded - Total icons available:', commonIconNames.length + Object.keys(window).filter(k => typeof window[k] === 'function' && /^[A-Z]/.test(k) && !commonIconNames.includes(k)).length);

        // Transform JSX and execute
        const code = atob("${codeBase64}");
        console.log('=== ORIGINAL CODE (first 500 chars) ===');
        console.log(code.substring(0, 500));

        const sanitizedCode = code
          .replace(/^\\s*import\\s+[\\s\\S]*?\\s+from\\s+['"][^'"]+['"]\\s*;?\\s*$/gm, '')
          .replace(/^\\s*import\\s+['"][^'"]+['"]\\s*;?\\s*$/gm, '')
          .replace(/^\\s*export\\s+\\{[\\s\\S]*?\\}\\s*;?\\s*$/gm, '')
          .replace(/^\\s*export\\s+\\*\\s+from\\s+['"][^'"]+['"]\\s*;?\\s*$/gm, '')
          .replace(/^\\s*export\\s+\\*\\s+as\\s+\\w+\\s+from\\s+['"][^'"]+['"]\\s*;?\\s*$/gm, '')
          .replace(/^\\s*export\\s+default\\s+/gm, '')
          .replace(/^\\s*export\\s+/gm, '');

        const transformed = Babel.transform(sanitizedCode, {
          presets: [
            'react',
            ['typescript', { isTSX: true, allExtensions: true }],
          ],
          filename: 'app.tsx'
        });

        console.log('=== COMPILED CODE (first 500 chars) ===');
        console.log(transformed.code.substring(0, 500));

        // Hide loading indicator
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';

        const compiledCode = transformed.code
          .replace(/^\\s*["']use strict["'];?\\s*/, '')
          .replace(/^\\s*export\\s+\\{[\\s\\S]*?\\}\\s*;?\\s*$/gm, '')
          .replace(/^\\s*export\\s+default\\s+/gm, '')
          .replace(/^\\s*export\\s+/gm, '');

        const __pocketBoundWindowFnCache = new Map();
        const __pocketWindowMethodsNeedingBind = new Set([
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'requestAnimationFrame',
          'cancelAnimationFrame',
          'requestIdleCallback',
          'cancelIdleCallback',
          'addEventListener',
          'removeEventListener',
          'dispatchEvent',
          'matchMedia',
          'getComputedStyle',
          'fetch',
          'atob',
          'btoa',
          'open',
          'postMessage',
          'scroll',
          'scrollBy',
          'scrollTo',
          'focus',
          'blur',
          'print',
          'alert',
          'confirm',
          'prompt',
        ]);
        const __pocketGetBoundWindowFn = (target, key, value) => {
          if (typeof value !== 'function') return value;
          const keyStr = String(key);
          if (!__pocketWindowMethodsNeedingBind.has(keyStr)) return value;
          let bound = __pocketBoundWindowFnCache.get(keyStr);
          if (!bound) {
            bound = value.bind(target);
            __pocketBoundWindowFnCache.set(keyStr, bound);
          }
          return bound;
        };

        const pocketGlobals = new Proxy(window, {
          has(target, key) {
            if (typeof key !== 'string') return key in target;
            if (key in target) return true;
            return /^[A-Z]/.test(key);
          },
          get(target, key) {
            if (typeof key !== 'string') return target[key];
            if (key in target) {
              return __pocketGetBoundWindowFn(target, key, target[key]);
            }
            if (/^[A-Z]/.test(key)) {
              if (
                key.includes('_') ||
                (window.__pocketGoogleFontNames && window.__pocketGoogleFontNames.has(key))
              ) {
                const fontLoader = window.__pocketCreateGoogleFontLoader(key);
                target[key] = fontLoader;
                return fontLoader;
              }
              const fallback = createFallbackIcon(key);
              target[key] = fallback;
              return fallback;
            }
            return undefined;
          },
          set(target, key, value) {
            target[key] = value;
            return true;
          },
        });

        // Execute the compiled code with better error handling and auto-recovery
        const maxRetries = 10;
        let retryCount = 0;
        let lastError = null;

        const createFallbackUtility = (name) => {
          if (/^use[A-Z]/.test(name)) {
            return function fallbackHook() {
              return {};
            };
          }
          return function fallbackUtility() {
            return null;
          };
        };

        const executeWithRetry = () => {
          try {
            const executionWrapper = new Function(
              "__POCKET_GLOBALS__",
              "with (__POCKET_GLOBALS__) {\\n" + compiledCode + "\\n}",
            );
            executionWrapper(pocketGlobals);
            console.log('✓ Code executed successfully' + (retryCount > 0 ? \` (after \${retryCount} icon fixes)\` : ''));
            return true;
          } catch (execError) {
            // Check if it's a missing icon/component error
            const match = execError && execError.message && execError.message.match(/(\\w+) is not defined/);
            if (match && /^[A-Z]/.test(match[1]) && retryCount < maxRetries) {
              const missingName = match[1];
              console.warn(\`⚠ Missing: \${missingName}, creating fallback (attempt \${retryCount + 1}/\${maxRetries})...\`);

              if (
                missingName.includes('_') ||
                (window.__pocketGoogleFontNames && window.__pocketGoogleFontNames.has(missingName))
              ) {
                window[missingName] = window.__pocketCreateGoogleFontLoader(missingName);
              } else {
                // Create the missing icon/component
                window[missingName] = createFallbackIcon(missingName);
              }

              // Retry execution
              retryCount++;
              return executeWithRetry();
            } else if (match && retryCount < maxRetries) {
              const missingName = match[1];
              console.warn(\`⚠ Missing: \${missingName}, creating utility fallback (attempt \${retryCount + 1}/\${maxRetries})...\`);
              window[missingName] = createFallbackUtility(missingName);
              retryCount++;
              return executeWithRetry();
            } else {
              console.error('✗ Error executing compiled code:', execError);
              lastError = execError;
              return false;
            }
          }
        };

        const refreshTailwindRuntime = () => {
          try {
            if (window.tailwind && typeof window.tailwind.refresh === 'function') {
              window.tailwind.refresh();
            }
          } catch (tailwindError) {
            console.warn('Tailwind runtime refresh failed:', tailwindError);
          }
        };

        const success = executeWithRetry();
        if (!success && lastError) {
          throw lastError;
        }

        refreshTailwindRuntime();
        setTimeout(refreshTailwindRuntime, 60);
        setTimeout(refreshTailwindRuntime, 250);

        // Fade in after render
        setTimeout(() => {
          const root = document.getElementById('root');
          if (root) {
            root.classList.add('ready');
            console.log('App rendered successfully');
          }
        }, 100);
    } catch (error) {
      console.error('Error initializing app:', error);
      const loading = document.getElementById('loading');
      if (loading) loading.style.display = 'none';
      document.body.innerHTML = '<div style="padding: 20px; font-family: system-ui;"><h1>Error Loading App</h1><pre>' + error.message + '</pre><p>Check the browser console for more details.</p></div>';
    }
  </script>
</body>
</html>`;
}

// ── Cloudflare deploy via wrangler CLI ──────────────────────────

function deployCfPages(
  projectName: string,
  htmlFiles: Map<string, string>,
): { url: string; deploymentId: string } {
  // Write HTML files to a temp directory
  const tempDir = join(tmpdir(), `cf-deploy-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  try {
    for (const [filePath, content] of htmlFiles) {
      const fullPath = join(tempDir, filePath);
      const dir = fullPath.substring(0, fullPath.lastIndexOf("\\") > -1 ? fullPath.lastIndexOf("\\") : fullPath.lastIndexOf("/"));
      mkdirSync(dir, { recursive: true });
      writeFileSync(fullPath, content, "utf-8");
    }

    console.log(`[cf] Deploying ${htmlFiles.size} files via wrangler to ${projectName}`);

    const deployArgs = [
      "pages",
      "deploy",
      tempDir,
      `--project-name=${projectName}`,
      "--branch=main",
      "--commit-dirty=true",
    ];

    let output = "";
    try {
      output = runWrangler(deployArgs, 120_000);
    } catch (e: unknown) {
      const err = e as { stderr?: string; message?: string };
      const rawError = `${err?.stderr || ""}\n${err?.message || ""}`;
      const projectNotFound =
        rawError.includes("Project not found") || rawError.includes("8000007");

      if (!projectNotFound) {
        throw e;
      }

      console.log(
        `[cf] Project ${projectName} not found. Creating it and retrying deploy...`,
      );
      try {
        runWrangler(
          [
            "pages",
            "project",
            "create",
            projectName,
            "--production-branch=main",
          ],
          30_000,
        );
      } catch (createErr: unknown) {
        const cErr = createErr as { stderr?: string; message?: string };
        const createRaw = `${cErr?.stderr || ""}\n${cErr?.message || ""}`;
        // Safe to ignore if create raced and project now exists.
        if (!createRaw.includes("already exists")) {
          throw new Error(
            `Cloudflare Pages project create failed for "${projectName}": ${createRaw || "Unknown error"}`,
          );
        }
      }

      output = runWrangler(deployArgs, 120_000);
    }

    console.log(`[cf] Wrangler output:\n${output}`);

    // Use the clean production URL (since we deploy to --branch=main)
    const url = `https://${projectName}.pages.dev`;

    return { url, deploymentId: projectName };
  } finally {
    // Clean up temp dir
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

// ── POST ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
      throw new Error("CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID not configured");
    }

    const { files, projectId, title } = (await request.json()) as {
      files: ProjectFile[];
      dependencies?: Record<string, string>;
      projectId: string;
      title?: string;
    };

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "No projectId provided" }, { status: 400 });
    }

    const projectName = `pocketdev-${projectId}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .slice(0, 52);
    const siteName = title || "My Website";

    // ── Extract key files ──────────────────────────────────────

    const normalizedFiles = withNormalizedPaths(files);
    const globalsCss =
      findFileByCandidates(normalizedFiles, ["app/globals.css"])?.content || "";
    const tailwindConfigFile = findFileByCandidates(normalizedFiles, [
      "tailwind.config.ts",
      "tailwind.config.js",
      "tailwind.config.mjs",
      "tailwind.config.cjs",
      "app/tailwind.config.ts",
      "app/tailwind.config.js",
      "app/tailwind.config.mjs",
      "app/tailwind.config.cjs",
    ]);
    const tailwindConfigObjectLiteral = tailwindConfigFile
      ? extractTailwindConfigObjectLiteral(tailwindConfigFile.content)
      : null;
    const homePageFile =
      findFileByCandidates(normalizedFiles, [
        "app/page.tsx",
        "app/page.jsx",
        "app/page.ts",
        "app/page.js",
      ]) || findFirstFileByRegex(normalizedFiles, /^app\/page\.(tsx|jsx|ts|js)$/);
    const layoutFile = findFileByCandidates(normalizedFiles, [
      "app/layout.tsx",
      "app/layout.jsx",
      "app/layout.ts",
      "app/layout.js",
    ]);

    const navbarResolution =
      (homePageFile
        ? resolveComponentFromImports(
            normalizedFiles,
            homePageFile,
            ["Navbar"],
            /\b(navbar|header|topbar|navigation|menu)\b/i,
          )
        : undefined) ||
      (layoutFile
        ? resolveComponentFromImports(
            normalizedFiles,
            layoutFile,
            ["Navbar"],
            /\b(navbar|header|topbar|navigation|menu)\b/i,
          )
        : undefined);

    const footerResolution =
      (homePageFile
        ? resolveComponentFromImports(
            normalizedFiles,
            homePageFile,
            ["Footer"],
            /\bfooter\b/i,
          )
        : undefined) ||
      (layoutFile
        ? resolveComponentFromImports(
            normalizedFiles,
            layoutFile,
            ["Footer"],
            /\bfooter\b/i,
          )
        : undefined);

    const fallbackNavbarFile = findFileByCandidates(normalizedFiles, [
      "components/Navbar.tsx",
      "components/Navbar.jsx",
      "components/Navbar.ts",
      "components/Navbar.js",
      "components/navbar.tsx",
      "components/navbar.jsx",
      "components/navbar.ts",
      "components/navbar.js",
      "app/components/Navbar.tsx",
      "app/components/Navbar.jsx",
      "app/components/Navbar.ts",
      "app/components/Navbar.js",
    ]);
    const fallbackFooterFile = findFileByCandidates(normalizedFiles, [
      "components/Footer.tsx",
      "components/Footer.jsx",
      "components/Footer.ts",
      "components/Footer.js",
      "components/footer.tsx",
      "components/footer.jsx",
      "components/footer.ts",
      "components/footer.js",
      "app/components/Footer.tsx",
      "app/components/Footer.jsx",
      "app/components/Footer.ts",
      "app/components/Footer.js",
    ]);

    const resolvedNavbar = navbarResolution
      ? navbarResolution
      : fallbackNavbarFile
        ? { file: fallbackNavbarFile, localName: "Navbar" }
        : undefined;
    const resolvedFooter = footerResolution
      ? footerResolution
      : fallbackFooterFile
        ? { file: fallbackFooterFile, localName: "Footer" }
        : undefined;

    if (!homePageFile) {
      throw new Error("Missing essential files: homepage");
    }

    const navbarCode = resolvedNavbar
      ? buildAliasedComponentCode(resolvedNavbar.file, "Navbar")
      : "function Navbar() { return null; }";
    const footerCode = resolvedFooter
      ? buildAliasedComponentCode(resolvedFooter.file, "Footer")
      : "function Footer() { return null; }";

    // Detect theme (dark/light) from globals or navbar
    const isDark =
      resolvedNavbar?.file.content.includes("bg-gray-950") ||
      resolvedNavbar?.file.content.includes("bg-gray-900") ||
      false;

    const layoutHtmlClass = layoutFile
      ? extractClassNameFromTag(layoutFile.content, "html")
      : "";
    const layoutBodyClass = layoutFile
      ? extractClassNameFromTag(layoutFile.content, "body")
      : "";
    const mergedHtmlClass = mergeClassNames(layoutHtmlClass, isDark ? "dark" : "");
    const mergedBodyClass = mergeClassNames(layoutBodyClass, isDark ? "dark" : "");

    // ── Build home page ────────────────────────────────────────

    const homeEntryFiles = [
      homePageFile,
      ...(resolvedNavbar ? [resolvedNavbar.file] : []),
      ...(resolvedFooter ? [resolvedFooter.file] : []),
    ];
    const homeDependencyFiles = collectTransitiveLocalFiles(
      normalizedFiles,
      homeEntryFiles,
    );
    const homeSectionCodes = homeDependencyFiles.map((file) => ({
      name: file.normalizedPath,
      code: cleanComponent(file.content),
    }));

    const homeHtml = buildPageHtml({
      title: siteName,
      htmlClass: mergedHtmlClass,
      globalsCss,
      tailwindConfigObjectLiteral,
      navbarCode,
      footerCode,
      bodyClass: mergedBodyClass,
      renderNavbar:
        !!resolvedNavbar &&
        !componentTagUsed(homePageFile.content, "Navbar"),
      renderFooter:
        !!resolvedFooter &&
        !componentTagUsed(homePageFile.content, "Footer"),
      sectionCodes: homeSectionCodes,
      pageCode: cleanComponent(homePageFile.content),
      sectionNames: homeSectionCodes.map((c) => c.name),
      isDark,
    });

    const deployFiles = new Map<string, string>();
    deployFiles.set("index.html", homeHtml);

    // ── Build sub-page HTMLs ───────────────────────────────────

    const subPages = normalizedFiles.filter(
      (f) =>
        f.normalizedPath.match(/^app\/.+\/page\.(tsx|jsx|ts|js)$/) &&
        f.normalizedPath !== homePageFile.normalizedPath,
    );

    for (const sp of subPages) {
      const pathMatch = sp.normalizedPath.match(/^app\/(.+)\/page\.(tsx|jsx|ts|js)$/);
      if (!pathMatch) continue;
      const pagePath = pathMatch[1]; // e.g. "about", "menu"

      const pageEntryFiles = [
        sp,
        ...(resolvedNavbar ? [resolvedNavbar.file] : []),
        ...(resolvedFooter ? [resolvedFooter.file] : []),
      ];
      const pageDependencyFiles = collectTransitiveLocalFiles(
        normalizedFiles,
        pageEntryFiles,
      );
      const pageSectionCodes = pageDependencyFiles.map((file) => ({
        name: file.normalizedPath,
        code: cleanComponent(file.content),
      }));

      const pageCode = cleanComponent(sp.content);

      const pageHtml = buildPageHtml({
        title: `${siteName} - ${pagePath.charAt(0).toUpperCase() + pagePath.slice(1)}`,
        htmlClass: mergedHtmlClass,
        globalsCss,
        tailwindConfigObjectLiteral,
        navbarCode,
        footerCode,
        bodyClass: mergedBodyClass,
        renderNavbar:
          !!resolvedNavbar && !componentTagUsed(sp.content, "Navbar"),
        renderFooter:
          !!resolvedFooter && !componentTagUsed(sp.content, "Footer"),
        sectionCodes: pageSectionCodes,
        pageCode,
        sectionNames: pageSectionCodes.map((c) => c.name),
        isDark,
      });

      deployFiles.set(`${pagePath}/index.html`, pageHtml);
    }

    // ── Deploy to Cloudflare Pages ─────────────────────────────

    console.log(`☁️ Deploying ${deployFiles.size} pages to Cloudflare: ${projectName}`);
    const { url, deploymentId } = deployCfPages(projectName, deployFiles);
    console.log(`✅ Deployed: ${url}`);

    return NextResponse.json({
      success: true,
      url,
      deploymentId,
      projectName,
      isUpdate: false,
    });
  } catch (error) {
    console.error("Publish error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish" },
      { status: 500 },
    );
  }
}

// ── DELETE ──────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const projectName = body.projectName || body.deploymentId;

    if (!projectName) {
      return NextResponse.json(
        { error: "No projectName or deploymentId provided" },
        { status: 400 },
      );
    }

    // Delete via wrangler
    try {
      runWrangler(["pages", "project", "delete", projectName, "--yes"], 30_000);
    } catch (e) {
      // Ignore if project doesn't exist
      console.warn("[cf] Delete warning:", e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unpublish error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to unpublish" },
      { status: 500 },
    );
  }
}
