/**
 * Dependency Tree
 * Builds a file dependency graph from static import statements.
 * Assumes no barrel exports or dynamic imports — enforced via AI system prompt.
 */

export interface GeneratedFile {
  path: string;
  content: string;
}

// file → files it directly imports
export type DependencyTree = Record<string, string[]>;
// file → files that import it
export type ReverseDependencyTree = Record<string, string[]>;

export interface ProjectDependencyTree {
  forward: DependencyTree;
  reverse: ReverseDependencyTree;
}

export function buildDependencyTree(files: GeneratedFile[]): ProjectDependencyTree {
  const filePaths = new Set(files.map((f) => f.path));
  const forward: DependencyTree = {};

  for (const file of files) {
    forward[file.path] = extractImports(file.content, file.path, filePaths);
  }

  return { forward, reverse: buildReverseTree(forward) };
}

// Match: import X from './X', import { X } from './X', import './X', import * as X from './X'
const IMPORT_RE = /import\s+(?:[^'"]*?\s+from\s+)?['"](\.[^'"]+)['"]/g;

function extractImports(
  content: string,
  fromFile: string,
  filePaths: Set<string>,
): string[] {
  const deps: string[] = [];
  const re = new RegExp(IMPORT_RE.source, "g");
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    const resolved = resolveImportPath(fromFile, match[1], filePaths);
    if (resolved && !deps.includes(resolved)) {
      deps.push(resolved);
    }
  }

  return deps;
}

function resolveImportPath(
  fromFile: string,
  importPath: string,
  filePaths: Set<string>,
): string | null {
  const fromDir = fromFile.split("/").slice(0, -1).join("/");
  let raw = fromDir ? `${fromDir}/${importPath}` : importPath;

  // Normalize . and ..
  const parts = raw.split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== ".") out.push(p);
  }
  raw = out.join("/");

  const exts = [".tsx", ".ts", ".jsx", ".js"];
  for (const ext of exts) {
    if (filePaths.has(raw + ext)) return raw + ext;
  }
  for (const ext of exts) {
    const idx = `${raw}/index${ext}`;
    if (filePaths.has(idx)) return idx;
  }

  return null;
}

function buildReverseTree(forward: DependencyTree): ReverseDependencyTree {
  const reverse: ReverseDependencyTree = {};
  for (const [file, deps] of Object.entries(forward)) {
    for (const dep of deps) {
      if (!reverse[dep]) reverse[dep] = [];
      if (!reverse[dep].includes(file)) reverse[dep].push(file);
    }
  }
  return reverse;
}

/**
 * Returns the full set of files affected by changes to targetFiles:
 * - targetFiles themselves
 * - all files that transitively import them (upward)
 * - their direct dependencies (downward 1 level)
 */
export function getAffectedFiles(
  targetFiles: string[],
  tree: ProjectDependencyTree,
): string[] {
  const affected = new Set<string>(targetFiles);
  const queue = [...targetFiles];

  while (queue.length > 0) {
    const file = queue.shift()!;
    for (const importer of tree.reverse[file] ?? []) {
      if (!affected.has(importer)) {
        affected.add(importer);
        queue.push(importer);
      }
    }
  }

  for (const target of targetFiles) {
    for (const dep of tree.forward[target] ?? []) {
      affected.add(dep);
    }
  }

  return [...affected];
}

/**
 * Guess which files a user's edit request most likely targets,
 * based on filename mentions in the request text.
 */
export function inferTargetFiles(
  userRequest: string,
  files: GeneratedFile[],
): string[] {
  const lower = userRequest.toLowerCase();
  const candidates: string[] = [];

  for (const file of files) {
    const name = (file.path.split("/").pop() ?? "")
      .replace(/\.[^.]+$/, "")
      .toLowerCase();
    if (name.length > 2 && lower.includes(name)) {
      candidates.push(file.path);
    }
  }

  if (candidates.length === 0) {
    return files
      .filter(
        (f) =>
          /app\/page\.tsx?$/.test(f.path) || /app\/layout\.tsx?$/.test(f.path),
      )
      .map((f) => f.path)
      .slice(0, 2);
  }

  return candidates;
}

/** Serialise tree to a compact JSON string for storage (e.g., project config). */
export function serializeDependencyTree(tree: ProjectDependencyTree): string {
  return JSON.stringify(tree);
}

export function deserializeDependencyTree(raw: string): ProjectDependencyTree {
  return JSON.parse(raw) as ProjectDependencyTree;
}
