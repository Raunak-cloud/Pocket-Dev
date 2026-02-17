import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

interface ProjectFile {
  path: string;
  content: string;
}

type ProjectFileWithNormalizedPath = ProjectFile & { normalizedPath: string };

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
  const re = /import\s+(\w+)\s+from\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pageCode)) !== null) {
    map.set(m[1], m[2]);
  }
  return map;
}

function findComponentFile(
  files: ProjectFileWithNormalizedPath[],
  pageFile: ProjectFileWithNormalizedPath,
  componentName: string,
): ProjectFileWithNormalizedPath | undefined {
  const importMap = getImportMap(pageFile.content);
  const importPath = importMap.get(componentName);
  const exts = ["tsx", "jsx", "ts", "js"];

  if (importPath?.startsWith(".")) {
    const resolved = resolveRelativeImport(pageFile.normalizedPath, importPath);
    const candidates = [
      ...exts.map((ext) => `${resolved}.${ext}`),
      ...exts.map((ext) => `${resolved}/index.${ext}`),
    ];
    const byImport = findFileByCandidates(files, candidates);
    if (byImport) return byImport;
  }

  return findFileByCandidates(files, [
    ...exts.map((ext) => `app/components/${componentName}.${ext}`),
    ...exts.map((ext) => `app/components/${componentName.toLowerCase()}.${ext}`),
  ]);
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Strip imports, exports, "use client", and basic TypeScript syntax from a component file */
function cleanComponent(code: string): string {
  const cleaned = code
    // Remove "use client" directive
    .replace(/^["']use client["'];?\s*\n?/m, "")
    // Remove all import statements
    .replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, "")
    .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, "")
    // Remove export keywords
    .replace(/export\s+default\s+function\s+/g, "function ")
    .replace(/export\s+function\s+/g, "function ")
    .replace(/export\s+const\s+/g, "const ")
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

/** Extract component names from a page file's imports */
function extractComponentNames(pageCode: string): string[] {
  const names: string[] = [];
  const re = /import\s+(\w+)\s+from\s+["'](?:\.\.?\/)*components\/(\w+)["']/g;
  let m;
  while ((m = re.exec(pageCode)) !== null) {
    names.push(m[1]);
  }
  return names;
}

/** Strip @tailwind directives (CDN handles them) but keep custom CSS */
function cleanCss(css: string): string {
  return css.replace(/@tailwind\s+\w+;?\s*/g, "").trim();
}

// ── HTML Builder ────────────────────────────────────────────────

function buildPageHtml(opts: {
  title: string;
  globalsCss: string;
  navbarCode: string;
  footerCode: string;
  sectionCodes: { name: string; code: string }[];
  pageCode: string | null; // null for home (sections rendered directly), string for sub-pages
  sectionNames: string[];
  isDark: boolean;
}): string {
  const { title, globalsCss, navbarCode, footerCode, sectionCodes, pageCode, sectionNames, isDark } = opts;

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

  const appCode = `
${allCode}

function App() {
  return (
    <React.Fragment>
      <TestButton />
      <Navbar />
      <main>
${mainContent}
      </main>
      <Footer />
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
`;

  // Base64-encode the code to avoid HTML escaping issues
  const codeBase64 = Buffer.from(appCode).toString("base64");

  const bodyClass = isDark ? "bg-gray-950 text-white" : "bg-white text-gray-900";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escHtml(title)}</title>
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
      color: ${isDark ? "#fff" : "#000"};
      font-size: 18px;
    }
${cleanCss(globalsCss)}
  </style>
</head>
<body class="${bodyClass}">
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

        // Next.js stubs
        window.Link = function Link({ href, children, className, style, onClick, target, rel, ...restProps }) {
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
        window.Image = function Image({ src, alt, width, height, className, style, ...restProps }) {
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
        window.motion = new Proxy({}, {
          get(target, prop) {
            // Return a component that accepts motion props but renders as regular HTML
            return function MotionComponent({ children, initial, animate, transition, whileHover, whileTap, variants, className, style, onClick, href, ...restProps }) {
              // Start with animate style by default (skip animation), or initial if no animate
              const [currentStyle, setCurrentStyle] = useState(animate || {});
              const [isHovered, setIsHovered] = useState(false);

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

              const mergedStyle = {
                ...style,
                ...currentStyle,
                ...(isHovered && whileHover ? whileHover : {}),
                transition: transition?.duration ? \`all \${transition.duration}s ease\` : 'all 0.3s ease'
              };

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
          'Inbox', 'Info', 'Instagram', 'Italic', 'Key', 'Layers', 'Layout', 'LifeBuoy',
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

        console.log('Icon stubs and useInView loaded - Total icons available:', commonIconNames.length + Object.keys(window).filter(k => typeof window[k] === 'function' && /^[A-Z]/.test(k) && !commonIconNames.includes(k)).length);

        // Add a test component to verify React rendering works
        window.TestButton = function TestButton() {
          const [count, setCount] = useState(0);
          return React.createElement('div', {
            style: {
              position: 'fixed',
              top: '10px',
              right: '10px',
              zIndex: 9999,
              background: 'red',
              color: 'white',
              padding: '10px',
              cursor: 'pointer',
              border: '2px solid white'
            },
            onClick: () => {
              setCount(count + 1);
              alert('Test button clicked! Count: ' + (count + 1));
            }
          }, 'TEST BUTTON (clicks: ' + count + ')');
        };

        // Transform JSX and execute
        const code = atob("${codeBase64}");
        console.log('=== ORIGINAL CODE (first 500 chars) ===');
        console.log(code.substring(0, 500));

        const transformed = Babel.transform(code, {
          presets: ['react'],
          filename: 'app.jsx'
        });

        console.log('=== COMPILED CODE (first 500 chars) ===');
        console.log(transformed.code.substring(0, 500));

        // Hide loading indicator
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';

        // Execute the compiled code with better error handling and auto-recovery
        const maxRetries = 10;
        let retryCount = 0;
        let lastError = null;

        const executeWithRetry = () => {
          try {
            const executionWrapper = new Function(transformed.code);
            executionWrapper();
            console.log('✓ Code executed successfully' + (retryCount > 0 ? \` (after \${retryCount} icon fixes)\` : ''));
            return true;
          } catch (execError) {
            // Check if it's a missing icon/component error
            const match = execError.message && execError.message.match(/(\w+) is not defined/);
            if (match && /^[A-Z]/.test(match[1]) && retryCount < maxRetries) {
              const missingName = match[1];
              console.warn(\`⚠ Missing: \${missingName}, creating fallback (attempt \${retryCount + 1}/\${maxRetries})...\`);

              // Create the missing icon/component
              window[missingName] = createFallbackIcon(missingName);

              // Retry execution
              retryCount++;
              return executeWithRetry();
            } else {
              console.error('✗ Error executing compiled code:', execError);
              lastError = execError;
              return false;
            }
          }
        };

        const success = executeWithRetry();
        if (!success && lastError) {
          throw lastError;
        }

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

    // Create project if it doesn't exist
    try {
      execSync(
        `npx wrangler pages project create "${projectName}" --production-branch=main`,
        {
          encoding: "utf-8",
          timeout: 30_000,
          env: {
            ...process.env,
            CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
            CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
          },
        },
      );
      console.log(`[cf] Project created: ${projectName}`);
    } catch (e: unknown) {
      const err = e as { stderr?: string };
      // Ignore if already exists
      if (!err?.stderr?.includes("already exists")) {
        console.warn(`[cf] Project create warning:`, err?.stderr || e);
      }
    }

    // Run wrangler pages deploy
    const output = execSync(
      `npx wrangler pages deploy "${tempDir}" --project-name="${projectName}" --branch=main --commit-dirty=true`,
      {
        encoding: "utf-8",
        timeout: 120_000,
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
          CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
        },
      },
    );

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
    const homePageFile =
      findFileByCandidates(normalizedFiles, [
        "app/page.tsx",
        "app/page.jsx",
        "app/page.ts",
        "app/page.js",
      ]) || findFirstFileByRegex(normalizedFiles, /^app\/page\.(tsx|jsx|ts|js)$/);
    const navbarFile = homePageFile
      ? findComponentFile(normalizedFiles, homePageFile, "Navbar")
      : undefined;
    const footerFile = homePageFile
      ? findComponentFile(normalizedFiles, homePageFile, "Footer")
      : undefined;

    if (!homePageFile) {
      throw new Error("Missing essential files: homepage");
    }

    const navbarCode = navbarFile
      ? cleanComponent(navbarFile.content)
      : "function Navbar() { return null; }";
    const footerCode = footerFile
      ? cleanComponent(footerFile.content)
      : "function Footer() { return null; }";

    // Detect theme (dark/light) from globals or navbar
    const isDark =
      navbarFile?.content.includes("bg-gray-950") ||
      navbarFile?.content.includes("bg-gray-900") ||
      false;

    // ── Build home page ────────────────────────────────────────

    const homeComponentNames = extractComponentNames(homePageFile.content);
    const homeSectionCodes = homeComponentNames
      .filter((n) => n !== "Navbar" && n !== "Footer")
      .map((name) => {
        const file = findComponentFile(normalizedFiles, homePageFile, name);
        return file ? { name, code: cleanComponent(file.content) } : null;
      })
      .filter(Boolean) as { name: string; code: string }[];

    const homeHtml = buildPageHtml({
      title: siteName,
      globalsCss,
      navbarCode,
      footerCode,
      sectionCodes: homeSectionCodes,
      pageCode: null,
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

      const pageComponentNames = extractComponentNames(sp.content);
      const pageSectionCodes = pageComponentNames
        .filter((n) => n !== "Navbar" && n !== "Footer")
        .map((name) => {
          const file = findComponentFile(normalizedFiles, sp, name);
          return file ? { name, code: cleanComponent(file.content) } : null;
        })
        .filter(Boolean) as { name: string; code: string }[];

      const pageCode = cleanComponent(sp.content);

      const pageHtml = buildPageHtml({
        title: `${siteName} - ${pagePath.charAt(0).toUpperCase() + pagePath.slice(1)}`,
        globalsCss,
        navbarCode,
        footerCode,
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
      execSync(
        `npx wrangler pages project delete "${projectName}" --yes`,
        {
          encoding: "utf-8",
          timeout: 30_000,
          env: {
            ...process.env,
            CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
            CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
          },
        },
      );
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
