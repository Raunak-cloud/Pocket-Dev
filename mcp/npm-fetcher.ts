/**
 * NPM Registry Fetcher with Local Cache
 * Fetches real package data from npm and parses READMEs for component info.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(__dirname, ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "npm-cache.json");
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// TYPES
// ============================================================================

export interface NpmPackageInfo {
  name: string;
  version: string;
  description: string;
  homepage?: string;
  repository?: string;
  readme?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  fetchedAt: number;
}

export interface DiscoveredComponent {
  name: string;
  description: string;
  importPath: string;
  library: string;
  package: string;
  version: string;
  installation: string;
  source: "npm-live";
}

interface CacheData {
  packages: Record<string, NpmPackageInfo>;
  discoveredComponents: Record<string, DiscoveredComponent[]>;
}

// ============================================================================
// CACHE
// ============================================================================

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function readCache(): CacheData {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      return data;
    }
  } catch {
    // Cache corrupted, start fresh
  }
  return { packages: {}, discoveredComponents: {} };
}

function writeCache(data: CacheData): void {
  ensureCacheDir();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

function isCacheValid(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < CACHE_TTL;
}

// ============================================================================
// NPM REGISTRY FETCHER
// ============================================================================

export async function fetchNpmPackage(
  packageName: string
): Promise<NpmPackageInfo | null> {
  const cache = readCache();

  // Check cache first
  if (cache.packages[packageName] && isCacheValid(cache.packages[packageName].fetchedAt)) {
    return cache.packages[packageName];
  }

  try {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`npm registry returned ${response.status} for ${packageName}`);
      return null;
    }

    const data = await response.json();
    const latestVersion = data["dist-tags"]?.latest || "unknown";
    const versionData = data.versions?.[latestVersion] || {};

    const info: NpmPackageInfo = {
      name: data.name,
      version: latestVersion,
      description: data.description || "",
      homepage: data.homepage,
      repository:
        typeof data.repository === "string"
          ? data.repository
          : data.repository?.url,
      readme: data.readme?.substring(0, 15000) || "", // Cap README size
      keywords: data.keywords || [],
      dependencies: versionData.dependencies,
      peerDependencies: versionData.peerDependencies,
      fetchedAt: Date.now(),
    };

    // Save to cache
    cache.packages[packageName] = info;
    writeCache(cache);

    return info;
  } catch (error) {
    console.error(`Failed to fetch ${packageName} from npm:`, error);
    return null;
  }
}

// ============================================================================
// NPM SEARCH
// ============================================================================

export async function searchNpm(
  query: string,
  size: number = 10
): Promise<Array<{ name: string; description: string; version: string }>> {
  try {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${size}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.objects || []).map((obj: any) => ({
      name: obj.package.name,
      description: obj.package.description || "",
      version: obj.package.version || "",
    }));
  } catch (error) {
    console.error(`npm search failed for "${query}":`, error);
    return [];
  }
}

// ============================================================================
// COMPONENT DISCOVERY FROM README
// ============================================================================

// Known component patterns for popular libraries
const LIBRARY_COMPONENT_PATTERNS: Record<
  string,
  {
    packages: string[];
    extractComponents: (readme: string, pkgName: string) => DiscoveredComponent[];
  }
> = {
  shadcn: {
    packages: ["@radix-ui/react-*"],
    extractComponents: (readme, pkgName) => {
      return extractShadcnComponents(readme, pkgName);
    },
  },
  radix: {
    packages: ["@radix-ui/react-*"],
    extractComponents: (readme, pkgName) => {
      return extractRadixComponents(readme, pkgName);
    },
  },
  aceternity: {
    packages: ["aceternity"],
    extractComponents: (readme, pkgName) => {
      return extractGenericComponents(readme, pkgName);
    },
  },
  generic: {
    packages: [],
    extractComponents: (readme, pkgName) => {
      return extractGenericComponents(readme, pkgName);
    },
  },
};

function extractShadcnComponents(
  readme: string,
  pkgName: string
): DiscoveredComponent[] {
  const components: DiscoveredComponent[] = [];

  // Shadcn components typically listed as: ## Component Name or `npx shadcn-ui add <name>`
  const shadcnPattern = /npx\s+shadcn[-@]?(?:ui)?(?:@latest)?\s+add\s+(\w[\w-]*)/gi;
  let match;
  while ((match = shadcnPattern.exec(readme)) !== null) {
    const name = match[1];
    const displayName = name
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");
    components.push({
      name: displayName,
      description: `Shadcn UI ${displayName} component`,
      importPath: `@/components/ui/${name}`,
      library: "Shadcn UI",
      package: pkgName,
      version: "latest",
      installation: `npx shadcn-ui@latest add ${name}`,
      source: "npm-live",
    });
  }

  return components;
}

function extractRadixComponents(
  readme: string,
  pkgName: string
): DiscoveredComponent[] {
  const components: DiscoveredComponent[] = [];

  // Extract component name from package name: @radix-ui/react-dialog -> Dialog
  const radixMatch = pkgName.match(/@radix-ui\/react-(.+)/);
  if (radixMatch) {
    const name = radixMatch[1]
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");

    // Extract props/API from README
    const propsSection = extractSection(readme, "API Reference", "Props");
    const usageSection = extractSection(readme, "Usage", "Example", "Quick Start");

    components.push({
      name,
      description: extractFirstSentence(readme) || `Radix UI ${name} primitive`,
      importPath: `import * as ${name} from '${pkgName}'`,
      library: "Radix UI",
      package: pkgName,
      version: "latest",
      installation: `npm install ${pkgName}`,
      source: "npm-live",
    });
  }

  return components;
}

function extractGenericComponents(
  readme: string,
  pkgName: string
): DiscoveredComponent[] {
  const components: DiscoveredComponent[] = [];

  // Look for exported component patterns in README code blocks
  const codeBlockRegex = /```(?:jsx?|tsx?|react)?\n([\s\S]*?)```/g;
  const exportRegex = /export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)/g;
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;

  const foundNames = new Set<string>();

  let blockMatch;
  while ((blockMatch = codeBlockRegex.exec(readme)) !== null) {
    const code = blockMatch[1];

    // Find exports
    let expMatch;
    while ((expMatch = exportRegex.exec(code)) !== null) {
      const name = expMatch[1];
      if (name && name[0] === name[0].toUpperCase() && !foundNames.has(name)) {
        foundNames.add(name);
      }
    }

    // Find named imports from the package itself
    let impMatch;
    while ((impMatch = importRegex.exec(code)) !== null) {
      const imports = impMatch[1];
      const from = impMatch[2];
      if (from === pkgName || from.startsWith(pkgName)) {
        imports.split(",").forEach((imp) => {
          const name = imp.trim().split(" as ")[0].trim();
          if (name && name[0] === name[0].toUpperCase() && !foundNames.has(name)) {
            foundNames.add(name);
          }
        });
      }
    }
  }

  // Also check for ## headings that look like component names
  const headingRegex = /^#{2,3}\s+<?(\w+)>?\s*$/gm;
  let headingMatch;
  while ((headingMatch = headingRegex.exec(readme)) !== null) {
    const name = headingMatch[1];
    if (name[0] === name[0].toUpperCase() && name.length > 2 && !foundNames.has(name)) {
      foundNames.add(name);
    }
  }

  for (const name of foundNames) {
    components.push({
      name,
      description: `${name} component from ${pkgName}`,
      importPath: `import { ${name} } from '${pkgName}'`,
      library: pkgName,
      package: pkgName,
      version: "latest",
      installation: `npm install ${pkgName}`,
      source: "npm-live",
    });
  }

  return components;
}

// ============================================================================
// README PARSING HELPERS
// ============================================================================

function extractSection(readme: string, ...headingNames: string[]): string {
  for (const heading of headingNames) {
    const regex = new RegExp(
      `#+\\s*${heading}[\\s\\S]*?(?=\\n#+\\s|$)`,
      "i"
    );
    const match = readme.match(regex);
    if (match) return match[0].substring(0, 3000);
  }
  return "";
}

function extractFirstSentence(readme: string): string {
  // Skip badges and headings, find first real text
  const lines = readme.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("[") &&
      !trimmed.startsWith("!") &&
      !trimmed.startsWith("<") &&
      !trimmed.startsWith("|") &&
      trimmed.length > 20
    ) {
      const sentence = trimmed.split(/[.!]/)[0];
      return sentence.length > 10 ? sentence + "." : trimmed;
    }
  }
  return "";
}

// ============================================================================
// HIGH-LEVEL DISCOVER API
// ============================================================================

export async function discoverComponents(
  packageName: string
): Promise<DiscoveredComponent[]> {
  const cache = readCache();

  // Check cache
  if (
    cache.discoveredComponents[packageName] &&
    cache.packages[packageName] &&
    isCacheValid(cache.packages[packageName].fetchedAt)
  ) {
    return cache.discoveredComponents[packageName];
  }

  // Fetch package info
  const pkg = await fetchNpmPackage(packageName);
  if (!pkg || !pkg.readme) {
    return [];
  }

  // Determine which extractor to use
  let components: DiscoveredComponent[];
  if (packageName.startsWith("@radix-ui/react-")) {
    components = extractRadixComponents(pkg.readme, packageName);
  } else if (packageName.includes("shadcn")) {
    components = extractShadcnComponents(pkg.readme, packageName);
  } else {
    components = extractGenericComponents(pkg.readme, packageName);
  }

  // Update version from real data
  components = components.map((c) => ({
    ...c,
    version: pkg.version,
  }));

  // Cache results
  cache.discoveredComponents[packageName] = components;
  writeCache(cache);

  return components;
}

// ============================================================================
// VERSION REFRESH
// ============================================================================

export async function fetchLatestVersion(
  packageName: string
): Promise<string | null> {
  const pkg = await fetchNpmPackage(packageName);
  return pkg?.version || null;
}

export async function fetchLatestVersions(
  packageNames: string[]
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  // Fetch in parallel with concurrency limit of 5
  const chunks: string[][] = [];
  for (let i = 0; i < packageNames.length; i += 5) {
    chunks.push(packageNames.slice(i, i + 5));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (name) => {
      const version = await fetchLatestVersion(name);
      if (version) {
        results[name] = version;
      }
    });
    await Promise.all(promises);
  }

  return results;
}

// ============================================================================
// CLEAR CACHE
// ============================================================================

export function clearCache(): void {
  if (fs.existsSync(CACHE_FILE)) {
    fs.unlinkSync(CACHE_FILE);
  }
}

export function getCacheStats(): {
  packageCount: number;
  componentCount: number;
  cacheSize: string;
  oldestEntry: string;
} {
  const cache = readCache();
  const packages = Object.keys(cache.packages);
  const componentCount = Object.values(cache.discoveredComponents).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  let oldestTime = Date.now();
  for (const pkg of Object.values(cache.packages)) {
    if (pkg.fetchedAt < oldestTime) oldestTime = pkg.fetchedAt;
  }

  let cacheSize = "0 KB";
  if (fs.existsSync(CACHE_FILE)) {
    const stats = fs.statSync(CACHE_FILE);
    cacheSize = `${(stats.size / 1024).toFixed(1)} KB`;
  }

  return {
    packageCount: packages.length,
    componentCount,
    cacheSize,
    oldestEntry: packages.length > 0 ? new Date(oldestTime).toISOString() : "N/A",
  };
}
