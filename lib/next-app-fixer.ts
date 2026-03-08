/**
 * next-app-fixer
 *
 * Static analysis and deterministic repair utilities for generated Next.js App Router code.
 * Detects common build errors, runtime crashes, and UX issues without running the code.
 *
 * Designed to be framework-agnostic and eventually publishable as a standalone npm package.
 * Zero dependencies beyond `typescript` (used only for AST-accurate syntax checks).
 */

import * as ts from "typescript";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface LintIssue {
  path: string;
  line: number;
  column: number;
  rule: string | null;
  message: string;
}

type LocalImportCandidate = {
  sourcePathNoExt: string;
  hasNamed: boolean;
  hasDefault: boolean;
  score: number;
};

// ─── Internal Utilities ──────────────────────────────────────────────────────

export function hasUseClientDirective(content: string): boolean {
  const withoutBom = content.replace(/^\uFEFF/, "");
  const useClientRe =
    /^\s*(?:(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)\s*)*["']use client["']\s*;/;
  return useClientRe.test(withoutBom);
}

export function lineColumnAt(
  content: string,
  index: number,
): { line: number; column: number } {
  const before = content.slice(0, Math.max(0, index));
  const lines = before.split("\n");
  return {
    line: lines.length,
    column: (lines[lines.length - 1]?.length ?? 0) + 1,
  };
}

function normalizeCodeFilePath(pathValue: string): string {
  return pathValue.replace(/\\/g, "/");
}

function stripCodeExtension(pathValue: string): string {
  return pathValue.replace(/\.(tsx|ts|jsx|js)$/i, "");
}

function toKebabCaseIdentifier(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function buildRelativeImportPath(
  fromFilePath: string,
  toFilePathNoExt: string,
): string {
  const fromParts = normalizeCodeFilePath(fromFilePath).split("/");
  fromParts.pop();
  const toParts = normalizeCodeFilePath(toFilePathNoExt).split("/");

  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common += 1;
  }

  const upSegments = fromParts.length - common;
  const downSegments = toParts.slice(common).join("/");
  const upPrefix = upSegments > 0 ? "../".repeat(upSegments) : "./";
  const combined = `${upPrefix}${downSegments}`.replace(/\/+/g, "/");
  return combined.startsWith(".") ? combined : `./${combined}`;
}

function parseUndefinedReferenceIdentifier(message: string): string | null {
  const singleQuoteMatch = message.match(
    /^'([A-Za-z_$][A-Za-z0-9_$]*)'\s+is used but never imported or declared/i,
  );
  if (singleQuoteMatch) return singleQuoteMatch[1];

  const doubleQuoteMatch = message.match(
    /^"([A-Za-z_$][A-Za-z0-9_$]*)"\s+is used but never imported or declared/i,
  );
  if (doubleQuoteMatch) return doubleQuoteMatch[1];

  return null;
}

function isRouteEntryOrSpecialFile(pathValue: string): boolean {
  return /(?:^|\/)(?:page|layout|route|loading|error|global-error|not-found|template|default)\.(tsx|ts|jsx|js)$/i.test(
    normalizeCodeFilePath(pathValue),
  );
}

function fileImportsIdentifier(content: string, identifier: string): boolean {
  const sf = ts.createSourceFile(
    "file.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
    const clause = stmt.importClause;

    if (clause.name?.text === identifier) return true;

    const namedBindings = clause.namedBindings;
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const element of namedBindings.elements) {
        if (element.name.text === identifier) return true;
      }
    }
    if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      if (namedBindings.name.text === identifier) return true;
    }
  }

  return false;
}

function insertImportStatement(content: string, statement: string): string {
  const sf = ts.createSourceFile(
    "file.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  let lastImportEnd = -1;
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt)) {
      lastImportEnd = stmt.end;
    }
  }

  if (lastImportEnd >= 0) {
    const before = content.slice(0, lastImportEnd);
    const after = content.slice(lastImportEnd);
    const prefix = before.endsWith("\n") ? before : `${before}\n`;
    const suffix =
      after.startsWith("\n") || after.length === 0 ? after : `\n${after}`;
    return `${prefix}${statement}${suffix}`;
  }

  const directiveMatch = content.match(
    /^\s*(?:(?:"use (?:client|server)"|'use (?:client|server)')\s*;\s*\n)+/,
  );
  if (directiveMatch) {
    const idx = directiveMatch[0].length;
    return `${content.slice(0, idx)}${statement}\n${content.slice(idx)}`;
  }

  return `${statement}\n${content}`;
}

function resolveLocalImportCandidate(
  identifier: string,
  sourceFilePath: string,
  files: GeneratedFile[],
): { importPath: string; importKind: "named" | "default" } | null {
  const normalizedSourceFile = normalizeCodeFilePath(sourceFilePath);
  const sourceNoExt = stripCodeExtension(normalizedSourceFile);
  const idLower = identifier.toLowerCase();
  const idKebab = toKebabCaseIdentifier(identifier);
  const idSnake = identifier
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();

  const candidates: LocalImportCandidate[] = [];

  for (const file of files) {
    const normalizedPath = normalizeCodeFilePath(file.path);
    if (!/\.(tsx|ts|jsx|js)$/i.test(normalizedPath)) continue;
    if (isRouteEntryOrSpecialFile(normalizedPath)) continue;

    const candidateNoExt = stripCodeExtension(normalizedPath);
    if (candidateNoExt === sourceNoExt) continue;

    const parts = candidateNoExt.split("/");
    const base = parts[parts.length - 1] || "";
    const parentBase = parts.length > 1 ? parts[parts.length - 2] : "";
    const baseLower = base.toLowerCase();
    const parentLower = parentBase.toLowerCase();

    let score = 0;
    if (baseLower === idLower) score += 8;
    if (baseLower === idKebab) score += 7;
    if (baseLower === idSnake) score += 6;
    if (baseLower === "index" && parentLower === idLower) score += 7;
    if (baseLower === "index" && parentLower === idKebab) score += 6;
    if (/(?:^|\/)(?:app\/)?components\//i.test(candidateNoExt)) score += 3;
    if (/(?:^|\/)lib\//i.test(candidateNoExt)) score += 1;
    if (score <= 0) continue;

    const hasNamed =
      new RegExp(
        `\\bexport\\s+(?:const|function|class|type|interface|enum)\\s+${identifier}\\b`,
      ).test(file.content) ||
      new RegExp(`\\bexport\\s*\\{[^}]*\\b${identifier}\\b[^}]*\\}`).test(
        file.content,
      );
    const hasDefault = /\bexport\s+default\b/.test(file.content);

    if (!hasNamed && !hasDefault) continue;
    if (hasNamed) score += 2;
    if (hasDefault) score += 1;

    candidates.push({ sourcePathNoExt: candidateNoExt, hasNamed, hasDefault, score });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.sourcePathNoExt.localeCompare(b.sourcePathNoExt);
  });

  if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
    return null;
  }

  const best = candidates[0];
  const importPath = buildRelativeImportPath(
    normalizedSourceFile,
    best.sourcePathNoExt,
  );
  const importKind = best.hasNamed ? "named" : "default";
  return { importPath, importKind };
}

function extractModuleSpecifiers(content: string): string[] {
  const specifiers = new Set<string>();
  const fromRe = /\bfrom\s+["']([^"']+)["']/g;
  const importRe = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
  const requireRe = /\brequire\(\s*["']([^"']+)["']\s*\)/g;

  for (const match of content.matchAll(fromRe)) specifiers.add(String(match[1] || "").trim());
  for (const match of content.matchAll(importRe)) specifiers.add(String(match[1] || "").trim());
  for (const match of content.matchAll(requireRe)) specifiers.add(String(match[1] || "").trim());
  return Array.from(specifiers).filter(Boolean);
}

function getPackageNameFromSpecifier(specifier: string): string {
  if (!specifier) return "";
  if (specifier.startsWith("@")) {
    const [scope, pkg] = specifier.split("/");
    return scope && pkg ? `${scope}/${pkg}` : specifier;
  }
  if (specifier.startsWith("next/")) return "next";
  if (specifier.startsWith("react-dom/")) return "react-dom";
  return specifier.split("/")[0] || specifier;
}

function projectFileExistsForAlias(
  specifier: string,
  filePaths: Set<string>,
): boolean {
  const bare = specifier.slice(2);
  const extensions = [".tsx", ".ts", ".jsx", ".js"];
  if (filePaths.has(bare)) return true;
  for (const ext of extensions) {
    if (filePaths.has(`${bare}${ext}`)) return true;
  }
  for (const ext of extensions) {
    if (filePaths.has(`${bare}/index${ext}`)) return true;
  }
  return false;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const KNOWN_NEXT_IMPORT_FIXUPS: Record<string, string> = {
  link: "next/link",
  image: "next/image",
  navigation: "next/navigation",
  headers: "next/headers",
  server: "next/server",
  "font/google": "next/font/google",
};

// Packages that are client-only: importing them in a Server Component crashes the build.
export const CLIENT_ONLY_IMPORT_RE =
  /from\s+['"](?:framer-motion|motion\/react|motion\/dist\/[^'"]+|react-hot-toast|react-toastify|react-tooltip|styled-jsx|lottie-react|react-spring|@react-spring\/(?:web|native|three|p5)[^'"]*|swiper(?:\/[^'"]*)?|react-slick|@egjs\/react-flicking|react-beautiful-dnd|react-dnd(?:\/[^'"]*)?|@dnd-kit\/[^'"]+|reactflow|react-flow-renderer|react-confetti|canvas-confetti|tsparticles|@tsparticles\/[^'"]+|react-particles|react-type-animation|typewriter-effect|react-countup|react-intersection-observer|react-use-measure|@use-gesture\/react)['"]/;

// React hooks that are definitively client-only.
export const REACT_CLIENT_HOOKS_RE =
  /\b(useState|useEffect|useRef|useCallback|useMemo|useReducer|useLayoutEffect|useImperativeHandle)\s*\(/;

// Markers that mean the file MUST stay a Server Component.
export const SERVER_COMPONENT_MARKERS_RE =
  /\bexport\s+(?:const\s+metadata\b|async\s+function\s+generateMetadata\b|function\s+generateMetadata\b)|from\s+['"](?:next\/headers|next\/server|server-only)['"]/;

// ─── Collectors ──────────────────────────────────────────────────────────────

/** TypeScript/JSX parse errors — hard build failures. */
export function collectSyntaxIssues(files: GeneratedFile[]): LintIssue[] {
  const sourceFiles = files.filter((f) =>
    /\.(tsx|ts|jsx|js)$/.test(f.path.toLowerCase()),
  );
  const syntaxIssues: LintIssue[] = [];

  for (const file of sourceFiles) {
    const lower = file.path.toLowerCase();
    const scriptKind = lower.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : lower.endsWith(".ts")
        ? ts.ScriptKind.TS
        : lower.endsWith(".jsx")
          ? ts.ScriptKind.JSX
          : ts.ScriptKind.JS;

    const sf = ts.createSourceFile(
      file.path,
      file.content,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    const parseDiagnostics =
      (sf as unknown as { parseDiagnostics?: ts.Diagnostic[] })
        .parseDiagnostics || [];
    if (parseDiagnostics.length === 0) continue;

    const first = parseDiagnostics[0];
    const message = ts.flattenDiagnosticMessageText(first.messageText, "\n");
    const pos = first.start ?? 0;
    const lineCol = sf.getLineAndCharacterOfPosition(pos);
    syntaxIssues.push({
      path: file.path,
      line: lineCol.line + 1,
      column: lineCol.character + 1,
      rule: "typescript/parse",
      message,
    });
  }

  return syntaxIssues;
}

/** JSX event handlers (onClick, onChange, etc.) in Server Components — missing "use client". */
export function collectServerClientBoundaryIssues(
  files: GeneratedFile[],
): LintIssue[] {
  const appSourceFiles = files.filter((f) => {
    const normalizedPath = f.path.replace(/\\/g, "/");
    return (
      normalizedPath.startsWith("app/") &&
      (normalizedPath.endsWith(".tsx") || normalizedPath.endsWith(".jsx"))
    );
  });

  const issues: LintIssue[] = [];
  const eventHandlerRe = /\bon[A-Z][A-Za-z0-9_]*\s*=\s*\{/g;

  for (const file of appSourceFiles) {
    if (hasUseClientDirective(file.content)) continue;
    eventHandlerRe.lastIndex = 0;
    const match = eventHandlerRe.exec(file.content);
    if (!match) continue;

    const before = file.content.slice(0, match.index);
    const lines = before.split("\n");
    const handlerName = match[0].split("=")[0]?.trim() || "event handler";

    issues.push({
      path: file.path,
      line: lines.length,
      column: (lines[lines.length - 1]?.length ?? 0) + 1,
      rule: "next/rsc-event-handler-in-server-component",
      message: `Server Component includes JSX ${handlerName}. Add "use client" at the top of this file or move interactive JSX into a dedicated Client Component.`,
    });
  }

  return issues;
}

/** React hooks and client-only packages used without "use client". */
export function collectMissingUseClientIssues(files: GeneratedFile[]): LintIssue[] {
  const issues: LintIssue[] = [];

  for (const file of files) {
    const normalizedPath = file.path.replace(/\\/g, "/");
    if (!/\.(tsx|ts|jsx|js)$/.test(normalizedPath)) continue;
    if (hasUseClientDirective(file.content)) continue;
    if (SERVER_COMPONENT_MARKERS_RE.test(file.content)) continue;

    const hookMatch = REACT_CLIENT_HOOKS_RE.exec(file.content);
    if (hookMatch) {
      const pos = lineColumnAt(file.content, hookMatch.index);
      issues.push({
        path: file.path,
        line: pos.line,
        column: pos.column,
        rule: "react/hook-in-server-component",
        message: `React hook "${hookMatch[1]}()" called in a Server Component (no "use client" directive). Add "use client" at the top of this file.`,
      });
      continue;
    }

    const pkgMatch = CLIENT_ONLY_IMPORT_RE.exec(file.content);
    if (pkgMatch) {
      const pkgName =
        pkgMatch[0].match(/['"]([^'"]+)['"]/)?.[1] ?? "client-only package";
      const pos = lineColumnAt(file.content, pkgMatch.index);
      issues.push({
        path: file.path,
        line: pos.line,
        column: pos.column,
        rule: "react/client-only-package-in-server-component",
        message: `Package "${pkgName}" is client-only but this file has no "use client" directive. Add "use client" at the top.`,
      });
    }
  }

  return issues;
}

/** Missing module imports and unresolved @/ alias paths. */
export function collectModuleResolutionIssues(
  files: GeneratedFile[],
  dependencies: Record<string, string>,
): LintIssue[] {
  const issues: LintIssue[] = [];
  const allowedCorePackages = new Set([
    "next", "react", "react-dom", "typescript", "tailwindcss", "postcss", "autoprefixer",
  ]);

  const allFilePaths = new Set(files.map((f) => f.path.replace(/\\/g, "/")));
  const sourceFiles = files.filter((f) =>
    /\.(tsx|ts|jsx|js)$/.test(f.path.toLowerCase()),
  );

  for (const file of sourceFiles) {
    const specifiers = extractModuleSpecifiers(file.content);
    for (const specifier of specifiers) {
      if (!specifier || specifier.startsWith("node:")) continue;

      if (specifier.startsWith("@/")) {
        if (!projectFileExistsForAlias(specifier, allFilePaths)) {
          const idx = file.content.indexOf(`"${specifier}"`);
          const altIdx = file.content.indexOf(`'${specifier}'`);
          const matchIdx = idx >= 0 ? idx : altIdx >= 0 ? altIdx : 0;
          const pos = lineColumnAt(file.content, matchIdx);
          issues.push({
            path: file.path,
            line: pos.line,
            column: pos.column,
            rule: "module/missing-local-file",
            message: `Module "${specifier}" is imported but the file does not exist in the project. Either create the missing file or remove this import.`,
          });
        }
        continue;
      }

      if (specifier.startsWith(".") || specifier.startsWith("/")) continue;

      const nextFixup = KNOWN_NEXT_IMPORT_FIXUPS[specifier];
      if (nextFixup) {
        const idx = file.content.indexOf(`"${specifier}"`);
        const pos = lineColumnAt(file.content, idx >= 0 ? idx : 0);
        issues.push({
          path: file.path,
          line: pos.line,
          column: pos.column,
          rule: "next/invalid-module-specifier",
          message: `Invalid module "${specifier}". Use "${nextFixup}" instead.`,
        });
        continue;
      }

      const pkg = getPackageNameFromSpecifier(specifier);
      if (!pkg) continue;
      if (dependencies[pkg] || allowedCorePackages.has(pkg)) continue;

      const idx = file.content.indexOf(`"${specifier}"`);
      const pos = lineColumnAt(file.content, idx >= 0 ? idx : 0);
      issues.push({
        path: file.path,
        line: pos.line,
        column: pos.column,
        rule: "module/unresolved-dependency",
        message: `Module "${specifier}" is imported but missing from dependencies. Either add "${pkg}" to dependencies or replace the import with a supported module.`,
      });
    }
  }

  return issues;
}

/** Identifiers used as function calls or JSX components that were never imported or declared. */
export function collectUndefinedReferenceIssues(files: GeneratedFile[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const TEMPLATE_FILES = new Set([
    "lib/supabase/server.ts",
    "lib/supabase/client.ts",
    "lib/supabase/middleware.ts",
    "app/auth/callback/route.ts",
    "app/loading.tsx",
    "app/global-error.tsx",
  ]);
  const CONFIG_FILE_RE =
    /(?:^|\/)(?:tailwind|next|postcss|vite|webpack|eslint|prettier)\.config\.\w+$/;

  const sourceFiles = files.filter((f) => {
    const normalized = f.path.replace(/\\/g, "/");
    return (
      /\.(tsx|ts|jsx|js)$/.test(normalized.toLowerCase()) &&
      !TEMPLATE_FILES.has(normalized) &&
      !CONFIG_FILE_RE.test(normalized)
    );
  });

  const GLOBALS = new Set([
    "undefined", "null", "NaN", "Infinity", "globalThis", "eval",
    "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURI", "decodeURI",
    "encodeURIComponent", "decodeURIComponent", "escape", "unescape",
    "Object", "Function", "Boolean", "Symbol", "Number", "BigInt", "Math",
    "Date", "String", "RegExp", "Array", "Int8Array", "Uint8Array",
    "Uint8ClampedArray", "Int16Array", "Uint16Array", "Int32Array",
    "Uint32Array", "Float32Array", "Float64Array", "BigInt64Array",
    "BigUint64Array", "Map", "Set", "WeakMap", "WeakSet", "ArrayBuffer",
    "SharedArrayBuffer", "DataView", "Atomics", "JSON", "Promise",
    "Proxy", "Reflect", "Error", "EvalError", "RangeError", "ReferenceError",
    "SyntaxError", "TypeError", "URIError", "AggregateError",
    "window", "document", "navigator", "location", "history", "screen",
    "localStorage", "sessionStorage", "console", "alert", "confirm", "prompt",
    "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "Worker",
    "URL", "URLSearchParams", "Headers", "Request", "Response", "FormData",
    "Blob", "File", "FileReader", "AbortController", "AbortSignal",
    "setTimeout", "clearTimeout", "setInterval", "clearInterval",
    "requestAnimationFrame", "cancelAnimationFrame", "queueMicrotask",
    "structuredClone", "atob", "btoa", "crypto", "performance",
    "MutationObserver", "IntersectionObserver", "ResizeObserver",
    "matchMedia", "getComputedStyle", "scrollTo", "requestIdleCallback",
    "CustomEvent", "Event", "EventTarget", "HTMLElement", "Element", "Node",
    "process", "Buffer", "global", "__dirname", "__filename", "module",
    "require", "exports",
    "Record", "Partial", "Required", "Readonly", "Pick", "Omit", "Exclude",
    "Extract", "NonNullable", "ReturnType", "Parameters", "InstanceType",
    "React",
    "url", "calc", "clamp",
    "translate", "translateX", "translateY", "translateZ", "translate3d",
    "rotate", "rotateX", "rotateY", "rotateZ", "rotate3d",
    "scale", "scaleX", "scaleY", "scaleZ", "scale3d",
    "skew", "skewX", "skewY",
    "matrix", "matrix3d", "perspective",
    "rgb", "rgba", "hsl", "hsla",
    "cubic", "steps",
  ]);

  for (const file of sourceFiles) {
    const content = file.content;

    const imported = new Set<string>();
    const importRe = /import\s+(?:type\s+)?(?:(\w+)(?:\s*,\s*)?)?(?:\{([^}]*)\})?\s*from\s*["'][^"']+["']/g;
    let importMatch;
    while ((importMatch = importRe.exec(content)) !== null) {
      if (importMatch[1]) imported.add(importMatch[1].trim());
      if (importMatch[2]) {
        importMatch[2].split(",").forEach((s) => {
          const name = s.trim().split(/\s+as\s+/).pop()?.trim();
          if (name) imported.add(name);
        });
      }
    }
    const starImportRe = /import\s+\*\s+as\s+(\w+)\s+from/g;
    let starMatch;
    while ((starMatch = starImportRe.exec(content)) !== null) imported.add(starMatch[1]);

    const declared = new Set<string>();
    const declRe = /(?:const|let|var|function|class|enum)\s+(\w+)/g;
    let declMatch;
    while ((declMatch = declRe.exec(content)) !== null) declared.add(declMatch[1]);

    const arrowRe = /(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=])\s*=>/g;
    let arrowMatch;
    while ((arrowMatch = arrowRe.exec(content)) !== null) declared.add(arrowMatch[1]);

    const destructObjRe = /(?:const|let|var)\s+\{([^}]+)\}\s*=/g;
    let dMatch;
    while ((dMatch = destructObjRe.exec(content)) !== null) {
      dMatch[1].split(",").forEach((s) => {
        const name = s.trim().split(/\s*:\s*/).pop()?.split(/\s*=\s*/)[0]?.trim();
        if (name && /^\w+$/.test(name)) declared.add(name);
      });
    }

    const destructArrRe = /(?:const|let|var)\s+\[([^\]]+)\]\s*=/g;
    let daMatch;
    while ((daMatch = destructArrRe.exec(content)) !== null) {
      daMatch[1].split(",").forEach((s) => {
        const name = s.trim().split(/\s*=\s*/)[0]?.trim();
        if (name && /^\w+$/.test(name)) declared.add(name);
      });
    }

    const fnParamRe = /function\s*\w*\s*\(([^)]*)\)/g;
    let fpMatch;
    while ((fpMatch = fnParamRe.exec(content)) !== null) {
      fpMatch[1].split(",").forEach((s) => {
        const name = s.trim().split(/\s*[=:]/)[0]?.replace(/\.\.\./, "").trim();
        if (name && /^\w+$/.test(name)) declared.add(name);
      });
    }

    const arrowParamRe = /\(([^)]*)\)\s*=>/g;
    let apMatch;
    while ((apMatch = arrowParamRe.exec(content)) !== null) {
      apMatch[1].split(",").forEach((s) => {
        const name = s.trim().split(/\s*[=:]/)[0]?.replace(/\.\.\./, "").trim();
        if (name && /^\w+$/.test(name)) declared.add(name);
      });
    }

    const singleArrowRe = /\b(\w+)\s*=>/g;
    let saMatch;
    while ((saMatch = singleArrowRe.exec(content)) !== null) {
      const name = saMatch[1];
      if (name && name !== "async") declared.add(name);
    }

    const destructParamRe = /\(\s*\{([^}]*)\}\s*(?::[^)]*?)?\)\s*(?:=>|\{)/g;
    let dpMatch;
    while ((dpMatch = destructParamRe.exec(content)) !== null) {
      dpMatch[1].split(",").forEach((s) => {
        const name = s.trim().split(/\s*[=:]/)[0]?.trim();
        if (name && /^\w+$/.test(name)) declared.add(name);
      });
    }

    const objMethodRe = /[,{]\s*(\w+)\s*\([^)]*\)\s*\{/g;
    let omMatch;
    while ((omMatch = objMethodRe.exec(content)) !== null) declared.add(omMatch[1]);

    const forOfInRe = /for\s*\(\s*(?:const|let|var)\s+(\w+)\s+(?:of|in)\b/g;
    let foiMatch;
    while ((foiMatch = forOfInRe.exec(content)) !== null) declared.add(foiMatch[1]);

    const catchRe = /catch\s*\(\s*(\w+)\s*\)/g;
    let cMatch;
    while ((cMatch = catchRe.exec(content)) !== null) declared.add(cMatch[1]);

    const typeRe = /(?:type|interface)\s+(\w+)/g;
    let tMatch;
    while ((tMatch = typeRe.exec(content)) !== null) declared.add(tMatch[1]);

    const strippedContent = content
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''");

    const callRe = /\b([A-Za-z_$]\w*)\s*\(/g;
    const used = new Map<string, number>();
    let callMatch;
    while ((callMatch = callRe.exec(strippedContent)) !== null) {
      const name = callMatch[1];
      const charBefore = callMatch.index > 0 ? strippedContent[callMatch.index - 1] : "";
      if (charBefore === ".") continue;
      if (callMatch.index > 1 && strippedContent[callMatch.index - 2] === "?" && charBefore === ".") continue;
      if (!used.has(name)) used.set(name, callMatch.index);
    }

    const jsxRe = /<([A-Z]\w*)/g;
    let jsxMatch;
    while ((jsxMatch = jsxRe.exec(strippedContent)) !== null) {
      const name = jsxMatch[1];
      if (!used.has(name)) used.set(name, jsxMatch.index);
    }

    const jsKeywords = new Set([
      "if", "else", "for", "while", "do", "switch", "case", "break",
      "continue", "return", "throw", "try", "catch", "finally", "new",
      "delete", "typeof", "void", "instanceof", "in", "of", "yield",
      "await", "async", "super", "this", "class", "extends", "import",
      "export", "default", "from", "as", "with", "debugger",
    ]);

    for (const [name, idx] of used) {
      if (jsKeywords.has(name)) continue;
      if (GLOBALS.has(name)) continue;
      if (imported.has(name)) continue;
      if (declared.has(name)) continue;

      const pos = lineColumnAt(content, idx);
      issues.push({
        path: file.path,
        line: pos.line,
        column: pos.column,
        rule: "undefined-reference",
        message: `'${name}' is used but never imported or declared. Add the missing import.`,
      });
    }
  }

  return issues;
}

/**
 * Detects React context providers that are defined in the project but not
 * wrapped around children in app/layout.tsx. Causes "useX must be used within
 * a XProvider" runtime errors.
 */
export function collectMissingProviderIssues(files: GeneratedFile[]): LintIssue[] {
  const issues: LintIssue[] = [];

  const layoutFile = files.find(
    (f) => f.path.replace(/\\/g, "/") === "app/layout.tsx",
  );
  if (!layoutFile) return issues;

  for (const file of files) {
    const normalizedPath = file.path.replace(/\\/g, "/");
    if (normalizedPath === "app/layout.tsx") continue;
    if (!/\.(tsx|ts|jsx|js)$/.test(normalizedPath)) continue;

    const content = file.content;
    if (!/\bcreateContext\b/.test(content)) continue;

    const namedProviderRe =
      /\bexport\s+(?:function|const|class)\s+(\w+Provider)\b/g;
    const defaultProviderRe =
      /\bexport\s+default\s+function\s+(\w+Provider)\b/g;

    const providerNames = new Set<string>();
    for (const m of content.matchAll(namedProviderRe)) providerNames.add(m[1]);
    for (const m of content.matchAll(defaultProviderRe)) providerNames.add(m[1]);

    for (const name of providerNames) {
      if (["AuthProvider", "SupabaseProvider"].includes(name)) continue;

      const usedInLayout = new RegExp(`<${name}[\\s>/]`).test(layoutFile.content);
      if (!usedInLayout) {
        issues.push({
          path: "app/layout.tsx",
          line: 1,
          column: 1,
          rule: "react/missing-context-provider",
          message: `Context provider "${name}" (from "${normalizedPath}") is never rendered in app/layout.tsx. Wrap {children} with <${name}> so all pages have access to this context.`,
        });
      }
    }
  }

  return issues;
}

/**
 * Comprehensive Next.js App Router validation:
 * - next/navigation hooks in server components
 * - server-only modules in client components
 * - metadata exports in client components
 * - async client component default exports
 * - private env vars in client components
 * - useSearchParams without Suspense
 * - missing default exports in convention files
 * - Pages Router patterns in App Router
 * - missing "use client" for hooks/client packages
 */
export function collectNextJsValidationIssues(
  files: GeneratedFile[],
  dependencies: Record<string, string>,
): LintIssue[] {
  const appAndComponentSourceFiles = files.filter((f) => {
    const normalizedPath = f.path.replace(/\\/g, "/");
    return (
      (normalizedPath.startsWith("app/") ||
        normalizedPath.startsWith("components/") ||
        normalizedPath.startsWith("app/components/")) &&
      (normalizedPath.endsWith(".tsx") || normalizedPath.endsWith(".jsx"))
    );
  });

  const issues: LintIssue[] = [
    ...collectServerClientBoundaryIssues(files),
    ...collectModuleResolutionIssues(files, dependencies),
    ...collectUndefinedReferenceIssues(files),
    ...collectMissingUseClientIssues(files),
  ];

  const nextClientHooks = [
    "useRouter", "useSearchParams", "usePathname", "useParams",
    "useSelectedLayoutSegment", "useSelectedLayoutSegments",
  ];
  const hookCallRe = new RegExp(`\\b(${nextClientHooks.join("|")})\\s*\\(`);
  const navigationImportRe = /from\s+["']next\/navigation["']/;

  for (const file of appAndComponentSourceFiles) {
    const content = file.content;
    const isClient = hasUseClientDirective(content);

    // next/navigation client hooks in server components
    if (!isClient && navigationImportRe.test(content) && hookCallRe.test(content)) {
      const match = content.match(hookCallRe);
      const idx = match?.index ?? 0;
      const pos = lineColumnAt(content, idx);
      issues.push({
        path: file.path,
        line: pos.line,
        column: pos.column,
        rule: "next/rsc-client-hook-in-server-component",
        message: 'Detected next/navigation client hook usage in a Server Component. Add "use client" or move this logic into a Client Component.',
      });
    }

    // Server-only modules imported in client components
    if (isClient) {
      const serverImportRe = /from\s+["'](?:next\/headers|next\/server|server-only)["']/;
      const serverImportMatch = content.match(serverImportRe);
      if (serverImportMatch) {
        const idx = serverImportMatch.index ?? 0;
        const pos = lineColumnAt(content, idx);
        issues.push({
          path: file.path,
          line: pos.line,
          column: pos.column,
          rule: "next/client-imports-server-only-module",
          message: "Client Component imports a server-only module (next/headers, next/server, or server-only). Move that code to server files.",
        });
      }
    }

    // metadata/generateMetadata in "use client" files
    if (isClient) {
      const metadataRe =
        /\bexport\s+(?:const\s+metadata|async\s+function\s+generateMetadata|function\s+generateMetadata)\b/;
      const metadataMatch = content.match(metadataRe);
      if (metadataMatch) {
        const idx = metadataMatch.index ?? 0;
        const pos = lineColumnAt(content, idx);
        issues.push({
          path: file.path,
          line: pos.line,
          column: pos.column,
          rule: "next/client-metadata-export",
          message: "Client Component cannot export metadata/generateMetadata. Keep metadata exports in Server Components.",
        });
      }
    }

    // async default export in client components
    if (isClient) {
      const asyncClientDefaultRe = /\bexport\s+default\s+async\s+function\b/;
      const asyncMatch = content.match(asyncClientDefaultRe);
      if (asyncMatch) {
        const idx = asyncMatch.index ?? 0;
        const pos = lineColumnAt(content, idx);
        issues.push({
          path: file.path,
          line: pos.line,
          column: pos.column,
          rule: "next/async-client-component",
          message: "Client Component default export is async. Move async work to server/actions or use effects/hooks on client.",
        });
      }
    }

    // process.env private vars in client components
    if (isClient) {
      const privateEnvRe = /\bprocess\.env\.(?!NEXT_PUBLIC_)([A-Z][A-Z0-9_]+)\b/g;
      let envMatch: RegExpExecArray | null;
      while ((envMatch = privateEnvRe.exec(content)) !== null) {
        const varName = envMatch[1];
        if (varName === "NODE_ENV") continue;
        const pos = lineColumnAt(content, envMatch.index);
        issues.push({
          path: file.path,
          line: pos.line,
          column: pos.column,
          rule: "next/private-env-in-client-component",
          message: `process.env.${varName} is server-only and will be undefined in the browser. Use process.env.NEXT_PUBLIC_${varName} and add NEXT_PUBLIC_${varName} to your .env file.`,
        });
        break;
      }
    }

    // useSearchParams without Suspense (Next.js 14+)
    if (isClient && /\buseSearchParams\s*\(/.test(content) && !/\bSuspense\b/.test(content)) {
      const m = content.match(/\buseSearchParams\s*\(/);
      if (m) {
        const pos = lineColumnAt(content, m.index ?? 0);
        issues.push({
          path: file.path,
          line: pos.line,
          column: pos.column,
          rule: "next/use-search-params-no-suspense",
          message: "useSearchParams() must be wrapped in a <Suspense fallback={...}> boundary. Extract the useSearchParams logic into a child component and wrap it in Suspense in the parent.",
        });
      }
    }
  }

  // Missing export default in Next.js convention files
  const NEXT_CONVENTION_FILE_RE =
    /^app\/(?:.+\/)?(?:page|layout|error|not-found|loading|template)\.(tsx|jsx)$/;
  for (const file of appAndComponentSourceFiles) {
    const normalizedPath = file.path.replace(/\\/g, "/");
    if (!NEXT_CONVENTION_FILE_RE.test(normalizedPath)) continue;
    if (!/\bexport\s+default\b/.test(file.content)) {
      issues.push({
        path: file.path,
        line: 1,
        column: 1,
        rule: "next/missing-default-export",
        message: `"${file.path}" is a Next.js convention file but has no default export. Add "export default function ..." — Next.js requires a default export for every page, layout, error, not-found, and loading file.`,
      });
    }
  }

  // Pages Router patterns in App Router (silently do nothing)
  const PAGES_ROUTER_EXPORT_RE =
    /\bexport\s+(?:async\s+)?function\s+(getStaticProps|getServerSideProps|getInitialProps|getStaticPaths)\b/;
  for (const file of appAndComponentSourceFiles) {
    const normalizedPath = file.path.replace(/\\/g, "/");
    if (!normalizedPath.startsWith("app/")) continue;
    const m = PAGES_ROUTER_EXPORT_RE.exec(file.content);
    if (m) {
      const pos = lineColumnAt(file.content, m.index);
      issues.push({
        path: file.path,
        line: pos.line,
        column: pos.column,
        rule: "next/pages-router-api-in-app-router",
        message: `"${m[1]}" is a Pages Router API and does nothing in the App Router. Remove it and use async Server Components or Route Handlers for data fetching instead.`,
      });
    }
  }

  return issues;
}

/** UX and responsive layout issues: missing nav, mobile menu problems, z-index conflicts, etc. */
export function collectResponsiveAndNavIssues(files: GeneratedFile[]): LintIssue[] {
  const sourceFiles = files.filter((f) =>
    /\.(tsx|ts|jsx|js)$/.test(f.path.toLowerCase()),
  );
  const issues: LintIssue[] = [];

  const navFiles = sourceFiles.filter((f) => /<nav[\s>]/i.test(f.content));
  if (navFiles.length === 0) {
    issues.push({
      path: "app/page.tsx", line: 1, column: 1,
      rule: "ux/navigation-required",
      message: "Missing navigation section. Add a responsive navbar with desktop links and mobile menu toggle.",
    });
  } else {
    const hasResponsiveVisibility = navFiles.some((f) =>
      /\b(?:sm|md|lg|xl|2xl):(?:hidden|block|flex|grid)\b/.test(f.content),
    );
    const hasMenuToggleLogic = navFiles.some((f) =>
      /\b(?:aria-expanded|isMenuOpen|menuOpen|setIsMenuOpen|setMenuOpen|toggleMenu)\b/.test(f.content),
    );
    const hasMenuButton = navFiles.some((f) =>
      /<button[\s\S]*?(?:menu|nav|open|close|aria-label)/i.test(f.content),
    );

    if (!hasResponsiveVisibility || !hasMenuToggleLogic || !hasMenuButton) {
      issues.push({
        path: navFiles[0].path, line: 1, column: 1,
        rule: "ux/mobile-navbar",
        message: "Navbar is not fully mobile-ready. Add hamburger button, menu open/close state, responsive visibility classes, and accessibility attributes.",
      });
    }

    const hasPinnedHeader = navFiles.some(
      (f) =>
        /\b(?:sticky|fixed)\b[\s\S]{0,120}\btop-0\b/i.test(f.content) ||
        /\btop-0\b[\s\S]{0,120}\b(?:sticky|fixed)\b/i.test(f.content),
    );
    const hasNavLayering = navFiles.some(
      (f) =>
        /\bz-(?:[4-9]\d|[1-9]\d{2,})\b/.test(f.content) ||
        /\bz-\[\d+\]/.test(f.content) ||
        /zIndex\s*:\s*(?:[4-9]\d|[1-9]\d{2,})/.test(f.content),
    );
    if (!hasPinnedHeader || !hasNavLayering) {
      issues.push({
        path: navFiles[0].path, line: 1, column: 1,
        rule: "ux/navbar-stacking",
        message: "Navbar/header must stay pinned at the top and above content. Use sticky/fixed + top-0 and a high z-index to avoid hidden/overlapped nav on mobile.",
      });
    }

    const hasNestedMenuScrolling = navFiles.some(
      (f) =>
        /className\s*=\s*["'\x60][^"'\x60]*(?:mobile-menu|menu|drawer)[^"'\x60]*(?:overflow-y-(?:auto|scroll)|overflow-(?:auto|scroll))[^"'\x60]*["'\x60]/i.test(f.content) ||
        /className\s*=\s*["'\x60][^"'\x60]*(?:overflow-y-(?:auto|scroll)|overflow-(?:auto|scroll))[^"'\x60]*(?:mobile-menu|menu|drawer)[^"'\x60]*["'\x60]/i.test(f.content),
    );
    const hasScrollableNavContainer = navFiles.some(
      (f) =>
        /<(?:nav|header)[^>]*className\s*=\s*["'\x60][^"'\x60]*(?:overflow-y-(?:auto|scroll)|overflow-(?:auto|scroll))[^"'\x60]*["'\x60]/i.test(f.content) ||
        /<(?:nav|header)[^>]*style=\{\{[^}]*overflowY\s*:\s*["'](?:auto|scroll)["']/i.test(f.content),
    );
    if (hasNestedMenuScrolling || hasScrollableNavContainer) {
      issues.push({
        path: navFiles[0].path, line: 1, column: 1,
        rule: "ux/navbar-nested-scroll",
        message: "Avoid independent scrollbar containers in navbar/mobile menu wrappers. Keep nav top-anchored and avoid overflow-y-auto/scroll on header/nav/menu containers.",
      });
    }

    const hasMenuOverlayPattern = navFiles.some((f) => {
      const hasToggle =
        /\b(?:aria-expanded|isMenuOpen|menuOpen|mobileMenuOpen|openMenu|toggleMenu)\b/.test(f.content);
      if (!hasToggle) return false;
      const hasRawOverlayClasses =
        /(?:fixed|absolute)[\s\S]{0,180}(?:top-0|inset-0|inset-x-0)/i.test(f.content) &&
        /(?:z-(?:[5-9]\d|[1-9]\d{2,})|z-\[\d+\]|zIndex\s*:\s*(?:[5-9]\d|[1-9]\d{2,}))/i.test(f.content);
      const usesOverlayComponent =
        /<(?:Sheet|SheetContent|Drawer|DrawerContent|Dialog|DialogContent|Modal|Portal)\b/.test(f.content) ||
        /@radix-ui\/react-(?:dialog|popover|portal)/.test(f.content) ||
        /\bcreatePortal\s*\(/.test(f.content);
      return hasRawOverlayClasses || usesOverlayComponent;
    });
    if (hasMenuToggleLogic && !hasMenuOverlayPattern) {
      issues.push({
        path: navFiles[0].path, line: 1, column: 1,
        rule: "ux/mobile-menu-overlay",
        message: "Mobile menu overlay is missing robust layering. Use fixed inset-0 z-[200] with a fully opaque background so no page content is visible behind or below the menu.",
      });
    }

    const hasFullScreenOverlay = navFiles.some(
      (f) =>
        /\binset-0\b/.test(f.content) ||
        (/\btop-0\b/.test(f.content) && /\bbottom-0\b/.test(f.content) && /\bfixed\b/.test(f.content)) ||
        /<(?:Sheet|SheetContent|Drawer|DrawerContent)\b/.test(f.content),
    );
    if (hasMenuToggleLogic && !hasFullScreenOverlay) {
      issues.push({
        path: navFiles[0].path, line: 1, column: 1,
        rule: "ux/mobile-menu-partial",
        message: "Mobile menu does not cover the full screen. Use 'fixed inset-0' so the overlay covers top, right, bottom, and left of the viewport completely.",
      });
    }

    const hasCloseButtonInOverlay = navFiles.some((f) => {
      const hasExplicitCloseCall =
        /setIsMenuOpen\s*\(\s*false\s*\)|setMenuOpen\s*\(\s*false\s*\)|setIsOpen\s*\(\s*false\s*\)|closeMenu\s*\(\s*\)|handleClose\s*\(\s*\)/.test(f.content);
      const hasXIcon =
        /<X[\s/>]|<XIcon[\s/>]|"M6 18[Ll]18 6|"M6 18[Ll]12 12[Ll]18 6|aria-label\s*=\s*["'](?:close|close menu|dismiss)["']|M18 6L6 18M6 6l12 12/i.test(f.content);
      const usesSheetOrDrawer = /<(?:Sheet|SheetContent|Drawer|DrawerContent)\b/.test(f.content);
      return (hasExplicitCloseCall && hasXIcon) || usesSheetOrDrawer;
    });
    if (hasMenuToggleLogic && !hasCloseButtonInOverlay) {
      issues.push({
        path: navFiles[0].path, line: 1, column: 1,
        rule: "ux/mobile-menu-no-close",
        message: "Mobile menu is missing a visible close (X) button inside the overlay panel. Add a button with an X/Close icon in the top-right of the menu header that calls setIsMenuOpen(false).",
      });
    }

    const hasMenuReadableBackground = navFiles.some((f) => {
      const hasExplicitReadableBg =
        /(?:mobile-menu|menu|drawer|nav-panel|menu-panel)[\s\S]{0,120}(?:bg-[\w\[\]\/-]+|backdrop-blur|style=\{\{[^}]*background)/i.test(f.content) ||
        /(?:fixed|absolute)[\s\S]{0,120}(?:bg-[\w\[\]\/-]+|backdrop-blur)/i.test(f.content);
      const usesOverlayComponent =
        /<(?:SheetContent|DrawerContent|DialogContent|Modal)\b/.test(f.content) ||
        /@radix-ui\/react-(?:dialog|popover|portal)/.test(f.content);
      return hasExplicitReadableBg || usesOverlayComponent;
    });
    if (hasMenuToggleLogic && !hasMenuReadableBackground) {
      issues.push({
        path: navFiles[0].path, line: 1, column: 1,
        rule: "ux/mobile-menu-visibility",
        message: "Mobile menu needs clear visibility. Add a solid/semi-opaque background and readable contrast so links are visible when menu opens.",
      });
    }

    const hasFullHeightMenuPanel = navFiles.some(
      (f) =>
        /\b(?:mobile-menu|menu|drawer|nav-panel|menu-panel)\b[\s\S]{0,160}\b(?:h-screen|min-h-screen|h-dvh|min-h-dvh|h-\[100dvh\]|min-h-\[100dvh\]|inset-y-0|top-0\s+bottom-0)\b/i.test(f.content) ||
        /(?:fixed|absolute)[\s\S]{0,180}\b(?:h-screen|min-h-screen|h-dvh|min-h-dvh|h-\[100dvh\]|min-h-\[100dvh\]|inset-y-0|top-0\s+bottom-0)\b/i.test(f.content) ||
        /<SheetContent[^>]*\bside=["'](?:left|right)["']/i.test(f.content),
    );
    if (hasMenuToggleLogic && !hasFullHeightMenuPanel) {
      issues.push({
        path: navFiles[0].path, line: 1, column: 1,
        rule: "ux/mobile-menu-height",
        message: "Mobile menu should occupy full phone height. Use h-screen/min-h-screen/100dvh or inset-y-0 so users do not need awkward inner scrolling.",
      });
    }

    const hasFixedNav = navFiles.some(
      (f) =>
        /\bfixed\b[\s\S]{0,80}\btop-0\b/i.test(f.content) ||
        /\btop-0\b[\s\S]{0,80}\bfixed\b/i.test(f.content),
    );
    if (hasFixedNav) {
      const mainHasPaddingTop = sourceFiles.some((f) =>
        /<main[^>]*className\s*=\s*["'\x60][^"'\x60]*\bpt-\d/.test(f.content),
      );
      const layoutHasPaddingTop = sourceFiles.some((f) =>
        /className\s*=\s*["'\x60][^"'\x60]*\bpt-(?:1[2-9]|[2-9]\d|\[\d)/.test(f.content),
      );
      if (!mainHasPaddingTop && !layoutHasPaddingTop) {
        issues.push({
          path: navFiles[0].path, line: 1, column: 1,
          rule: "ux/navbar-hero-overlap",
          message: "Fixed navbar detected but no top-padding found on <main> or layout wrapper. Add pt-16 (or matching navbar height) to <main> so hero content is not hidden underneath the navbar.",
        });
      }

      // Detect oversized first-fold spacing (blank band under fixed navbar).
      const homePageFile = sourceFiles.find((f) =>
        /^app\/page\.(?:tsx|jsx|ts|js)$/i.test(f.path.replace(/\\/g, "/")),
      );
      if (homePageFile && (mainHasPaddingTop || layoutHasPaddingTop)) {
        const topChunk = homePageFile.content.split("\n").slice(0, 260).join("\n");
        const hasOversizedHeroTopSpacing =
          /<section[\s\S]{0,260}className\s*=\s*["'\x60][^"'\x60]*(?:\bmt-(?:1[0-9]|[2-9]\d)\b|\bpt-(?:1[2-9]|[2-9]\d)\b|\bpy-(?:2[0-9]|[3-9]\d)\b)[^"'\x60]*["'\x60]/i.test(
            topChunk,
          ) ||
          /<(?:main|section)[\s\S]{0,320}className\s*=\s*["'\x60][^"'\x60]*\bhero\b[^"'\x60]*(?:\bmt-(?:1[0-9]|[2-9]\d)\b|\bpt-(?:1[2-9]|[2-9]\d)\b|\bpy-(?:2[0-9]|[3-9]\d)\b)[^"'\x60]*["'\x60]/i.test(
            topChunk,
          );

        if (hasOversizedHeroTopSpacing) {
          issues.push({
            path: homePageFile.path,
            line: 1,
            column: 1,
            rule: "ux/navbar-hero-gap",
            message:
              "Fixed navbar offset is present, but the hero/first section has oversized top spacing (mt/pt/py) causing a large blank gap below the navbar. Reduce first-section top spacing and remove hero margin-top.",
          });
        }
      }
    }
  }

  // Navbar invisible text: solid light bg + conditional white text
  const navFilesAll = sourceFiles.filter((f) => /<nav[\s>]/i.test(f.content));
  navFilesAll.forEach((f) => {
    const hasSolidLightBg =
      /(?:bg-white|bg-gray-\d{2,3}|bg-slate-\d{2,3}|bg-neutral-\d{2,3}|bg-zinc-\d{2,3}|background:\s*["']?#(?:f|e)[0-9a-f]{5})/i.test(f.content);
    const hasConditionalWhiteText =
      /scrolled\s*\?\s*["']?[^"']*text-(?:gray-[89]00|black|slate-[89]00)[^"']*["']?\s*:\s*["']?[^"']*text-white/.test(f.content) ||
      /text-white[^"']*["']?\s*:\s*["']?[^"']*text-(?:gray-[89]00|black|slate-[89]00)/.test(f.content);
    if (hasSolidLightBg && hasConditionalWhiteText) {
      issues.push({
        path: f.path, line: 1, column: 1,
        rule: "ux/navbar-invisible-text",
        message: "Navbar has a solid light/white background but uses text-white as the default (unscrolled) state — links are invisible at page load. Use text-gray-900 or text-black for white/light nav backgrounds.",
      });
    }
  });

  // Trust badge above navbar
  sourceFiles.forEach((f) => {
    const hasBadgeKeyword =
      /(?:voted|award|#1|best.*agency|top.*agency|as seen|featured in|trusted by|badge|ribbon|banner)/i.test(f.content);
    if (!hasBadgeKeyword) return;
    const hasHighZOnBadge =
      /(?:voted|award|#1|badge|ribbon|banner)[\s\S]{0,300}z-(?:5\d|[6-9]\d|[1-9]\d{2,})/i.test(f.content) ||
      /z-(?:5\d|[6-9]\d|[1-9]\d{2,})[\s\S]{0,300}(?:voted|award|#1|badge|ribbon|banner)/i.test(f.content);
    if (hasHighZOnBadge) {
      issues.push({
        path: f.path, line: 1, column: 1,
        rule: "ux/badge-above-navbar",
        message: "A trust badge or social proof element has a z-index >= 50, rendering above the navbar. Set its z-index to z-10 or lower.",
      });
    }
  });

  // Dashboard blank-body-on-mobile
  sourceFiles.forEach((f) => {
    const hasSidebarPattern =
      /aside[^>]*className\s*=\s*["'\x60][^"'\x60]*hidden[^"'\x60]*md:(?:flex|block)[^"'\x60]*["'\x60]/i.test(f.content);
    if (!hasSidebarPattern) return;
    const contentWrapperHidden =
      /div[^>]*className\s*=\s*["'\x60][^"'\x60]*(?:flex-1|overflow-y-auto)[^"'\x60]*hidden[^"'\x60]*["'\x60]/i.test(f.content) ||
      /div[^>]*className\s*=\s*["'\x60][^"'\x60]*hidden[^"'\x60]*(?:flex-1|overflow-y-auto)[^"'\x60]*["'\x60]/i.test(f.content);
    if (contentWrapperHidden) {
      issues.push({
        path: f.path, line: 1, column: 1,
        rule: "ux/dashboard-blank-mobile",
        message: "Dashboard content wrapper has 'hidden' class alongside 'flex-1'/'overflow-y-auto', making content invisible on mobile. Only the sidebar <aside> should be 'hidden md:flex'.",
      });
    }
  });

  const hasResponsiveClasses = sourceFiles.some((f) =>
    /\b(?:sm|md|lg|xl|2xl):/.test(f.content),
  );
  if (!hasResponsiveClasses) {
    issues.push({
      path: "app/page.tsx", line: 1, column: 1,
      rule: "ux/responsive-breakpoints",
      message: "No responsive breakpoint classes detected. Add mobile-first responsive classes for key sections.",
    });
  }

  const globals = files.find((f) => f.path === "app/globals.css");
  if (globals && !/overflow-x\s*:\s*hidden/i.test(globals.content)) {
    issues.push({
      path: "app/globals.css", line: 1, column: 1,
      rule: "ux/mobile-overflow-guard",
      message: "Add mobile overflow guard (html, body { max-width: 100%; overflow-x: hidden; }) to prevent horizontal scrolling.",
    });
  }

  // Color contrast: detect dark-on-dark and light-on-light combinations
  // Pattern: element has a dark bg class AND a dark text class in close proximity (same className string)
  const darkBgRe = /bg-(?:black|gray-[89]00|slate-[89]00|zinc-[89]00|neutral-[89]00|stone-[89]00|dark|night|[a-z]+-9\d{2})\b/;
  const darkTextRe = /text-(?:black|gray-[789]00|slate-[789]00|zinc-[789]00|neutral-[789]00|stone-[789]00)\b/;
  const lightBgRe = /bg-(?:white|gray-[0-2]?[0-9]0|slate-[0-2]?[0-9]0|zinc-[0-2]?[0-9]0|neutral-[0-2]?[0-9]0|stone-[0-2]?[0-9]0)\b/;
  const lightTextRe = /text-(?:white|gray-[0-1]00|slate-[0-1]00|zinc-[0-1]00|neutral-[0-1]00)\b/;

  sourceFiles.forEach((f) => {
    // Extract all className strings (quoted or template-literal segments)
    const classStrings = [...f.content.matchAll(/className\s*=\s*["'`]([^"'`]+)["'`]/g)].map(m => m[1]);
    classStrings.forEach((cls) => {
      if (darkBgRe.test(cls) && darkTextRe.test(cls)) {
        issues.push({
          path: f.path, line: 1, column: 1,
          rule: "ux/dark-on-dark-contrast",
          message: `Color contrast issue in ${f.path}: dark text color used on a dark background in the same className. Dark backgrounds (bg-gray-900, bg-black, bg-slate-900, etc.) MUST use light text (text-white, text-gray-100, text-gray-200). Fix all dark-on-dark combinations across every section and card.`,
        });
        return; // one issue per file is enough
      }
      if (lightBgRe.test(cls) && lightTextRe.test(cls)) {
        issues.push({
          path: f.path, line: 1, column: 1,
          rule: "ux/light-on-light-contrast",
          message: `Color contrast issue in ${f.path}: light/white text used on a light/white background in the same className. Light backgrounds (bg-white, bg-gray-50, bg-gray-100, etc.) MUST use dark text (text-gray-900, text-gray-800, text-black). Fix all light-on-light combinations across every section and card.`,
        });
        return;
      }
    });
  });

  return issues;
}

// ─── Deterministic Fixers ─────────────────────────────────────────────────────

/** Normalises known shortened Next.js import specifiers to their full form. */
export function applyKnownImportSpecifierFixups(
  files: GeneratedFile[],
): GeneratedFile[] {
  return files.map((file) => {
    if (!/\.(tsx|ts|jsx|js)$/.test(file.path.toLowerCase())) return file;

    let nextContent = file.content;
    for (const [wrongSpecifier, correctSpecifier] of Object.entries(KNOWN_NEXT_IMPORT_FIXUPS)) {
      const fromRe = new RegExp(`\\bfrom\\s+["']${wrongSpecifier.replace("/", "\\/")}["']`, "g");
      const importRe = new RegExp(`\\bimport\\(\\s*["']${wrongSpecifier.replace("/", "\\/")}["']\\s*\\)`, "g");
      const requireRe = new RegExp(`\\brequire\\(\\s*["']${wrongSpecifier.replace("/", "\\/")}["']\\s*\\)`, "g");
      nextContent = nextContent
        .replace(fromRe, `from "${correctSpecifier}"`)
        .replace(importRe, `import("${correctSpecifier}")`)
        .replace(requireRe, `require("${correctSpecifier}")`);
    }

    if (nextContent === file.content) return file;
    return { ...file, content: nextContent };
  });
}

/** Resolves undefined-reference issues by finding and inserting the missing import. */
export function applyDeterministicUndefinedReferenceImportFixes(
  files: GeneratedFile[],
  issues: LintIssue[],
): GeneratedFile[] {
  const unresolved = issues.filter((issue) => issue.rule === "undefined-reference");
  if (unresolved.length === 0) return files;

  const nextFiles = [...files];
  const indexByPath = new Map<string, number>();
  for (let i = 0; i < nextFiles.length; i++) {
    indexByPath.set(normalizeCodeFilePath(nextFiles[i].path), i);
  }

  const targets = new Map<string, Set<string>>();
  for (const issue of unresolved) {
    const identifier = parseUndefinedReferenceIdentifier(issue.message);
    if (!identifier) continue;
    const normalizedIssuePath = normalizeCodeFilePath(issue.path);
    if (!indexByPath.has(normalizedIssuePath)) continue;
    if (!targets.has(normalizedIssuePath)) targets.set(normalizedIssuePath, new Set());
    targets.get(normalizedIssuePath)!.add(identifier);
  }

  for (const [targetPath, identifiers] of targets) {
    const index = indexByPath.get(targetPath);
    if (index === undefined) continue;

    const targetFile = nextFiles[index];
    if (!/\.(tsx|ts|jsx|js)$/i.test(targetFile.path)) continue;

    let updatedContent = targetFile.content;
    for (const identifier of identifiers) {
      if (fileImportsIdentifier(updatedContent, identifier)) continue;
      const candidate = resolveLocalImportCandidate(identifier, targetFile.path, nextFiles);
      if (!candidate) continue;

      const importStatement =
        candidate.importKind === "named"
          ? `import { ${identifier} } from "${candidate.importPath}";`
          : `import ${identifier} from "${candidate.importPath}";`;
      updatedContent = insertImportStatement(updatedContent, importStatement);
    }

    if (updatedContent !== targetFile.content) {
      nextFiles[index] = { ...targetFile, content: updatedContent };
    }
  }

  return nextFiles;
}

/**
 * Patches app/layout.tsx to import and wrap missing context providers.
 * No AI call required — the fix is fully mechanical.
 */
export function applyDeterministicProviderFixes(
  files: GeneratedFile[],
  issues: LintIssue[],
): GeneratedFile[] {
  const providerIssues = issues.filter(
    (i) => i.rule === "react/missing-context-provider",
  );
  if (providerIssues.length === 0) return files;

  const missing: Array<{ name: string; sourcePath: string; isDefault: boolean }> = [];
  for (const issue of providerIssues) {
    const m = issue.message.match(/provider "(\w+Provider)" \(from "([^"]+)"\)/);
    if (!m) continue;
    const [, name, sourcePath] = m;
    const providerFile = files.find((f) => f.path.replace(/\\/g, "/") === sourcePath);
    const isDefault = providerFile
      ? new RegExp(`\\bexport\\s+default\\s+function\\s+${name}\\b`).test(providerFile.content)
      : false;
    missing.push({ name, sourcePath, isDefault });
  }
  if (missing.length === 0) return files;

  return files.map((file) => {
    if (file.path.replace(/\\/g, "/") !== "app/layout.tsx") return file;

    let content = file.content;

    for (const { name, sourcePath, isDefault } of missing) {
      const importPath = "@/" + sourcePath.replace(/\.(tsx|ts|jsx|js)$/, "");
      if (content.includes(`"${importPath}"`) || content.includes(`'${importPath}'`)) continue;

      const importStatement = isDefault
        ? `import ${name} from "${importPath}";`
        : `import { ${name} } from "${importPath}";`;

      const lastImportRe = /^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm;
      const allImports = [...content.matchAll(lastImportRe)];
      if (allImports.length > 0) {
        const last = allImports[allImports.length - 1];
        const insertAt = last.index! + last[0].length;
        content = content.slice(0, insertAt) + "\n" + importStatement + content.slice(insertAt);
      } else {
        content = importStatement + "\n" + content;
      }
    }

    let childrenExpr = "{children}";
    for (const { name } of [...missing].reverse()) {
      if (new RegExp(`<${name}[\\s>/]`).test(content)) continue;
      childrenExpr = `<${name}>${childrenExpr}</${name}>`;
    }

    if (childrenExpr !== "{children}") {
      content = content.replace(/\{children\}/g, childrenExpr);
    }

    return { ...file, content };
  });
}

/**
 * Prepends "use client"; to files that use React hooks or client-only packages
 * but are missing the directive. Safe to apply automatically — never modifies
 * files with server-component markers (metadata, server-only imports).
 */
export function applyDeterministicUseClientFixes(
  files: GeneratedFile[],
  issues: LintIssue[],
): GeneratedFile[] {
  const rulesToFix = new Set([
    "react/hook-in-server-component",
    "react/client-only-package-in-server-component",
  ]);
  const filesToFix = new Set(
    issues
      .filter((i) => rulesToFix.has(i.rule ?? ""))
      .map((i) => i.path.replace(/\\/g, "/")),
  );
  if (filesToFix.size === 0) return files;

  return files.map((file) => {
    const normalizedPath = file.path.replace(/\\/g, "/");
    if (!filesToFix.has(normalizedPath)) return file;
    if (hasUseClientDirective(file.content)) return file;
    if (SERVER_COMPONENT_MARKERS_RE.test(file.content)) return file;
    console.log(`[UseClientFix] Adding "use client" to ${file.path}`);
    return { ...file, content: `"use client";\n\n${file.content}` };
  });
}

/**
 * Tightens oversized first-fold hero spacing when a fixed navbar offset already exists.
 * This prevents large blank gaps between navbar and hero headline.
 */
export function applyDeterministicNavbarHeroGapFixes(
  files: GeneratedFile[],
  issues: LintIssue[],
): GeneratedFile[] {
  const hasHeroGapIssue = issues.some((i) => i.rule === "ux/navbar-hero-gap");
  if (!hasHeroGapIssue) return files;

  const targetPaths = new Set(
    issues
      .filter((i) => i.rule === "ux/navbar-hero-gap")
      .map((i) => i.path.replace(/\\/g, "/")),
  );

  const tightenClassList = (classList: string): string => {
    let next = classList;

    // Remove large hero top margins and collapse to zero.
    next = next.replace(/\b(?:md:)?mt-(?:1[0-9]|[2-9]\d)\b/g, "mt-0");

    // Clamp top padding for first fold.
    next = next.replace(/\bpt-(?:1[2-9]|[2-9]\d)\b/g, "pt-6");
    next = next.replace(/\bmd:pt-(?:1[2-9]|[2-9]\d)\b/g, "md:pt-8");

    // Clamp oversized symmetric vertical padding.
    next = next.replace(/\bpy-(?:2[0-9]|[3-9]\d)\b/g, "py-12");
    next = next.replace(/\bmd:py-(?:2[0-9]|[3-9]\d)\b/g, "md:py-16");

    return next.replace(/\s+/g, " ").trim();
  };

  return files.map((file) => {
    const normalizedPath = file.path.replace(/\\/g, "/");
    if (!targetPaths.has(normalizedPath)) return file;
    if (!/\.(tsx|jsx|ts|js)$/i.test(file.path)) return file;

    const sectionClassRegex =
      /<section([^>]*?)className\s*=\s*(["'\x60])([^"'\x60]*)(\2)([^>]*)>/i;
    const match = sectionClassRegex.exec(file.content);
    if (!match) return file;

    const originalClasses = match[3];
    const updatedClasses = tightenClassList(originalClasses);
    if (updatedClasses === originalClasses) return file;

    const updatedTag = `<section${match[1]}className=${match[2]}${updatedClasses}${match[4]}${match[5]}>`;
    const updatedContent =
      file.content.slice(0, match.index) +
      updatedTag +
      file.content.slice(match.index + match[0].length);

    console.log(`[HeroGapFix] Tightened first-fold spacing in ${file.path}`);
    return { ...file, content: updatedContent };
  });
}
