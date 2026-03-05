/**
 * Repair prompt builders for JSON, project shape, and lint feedback repair loops.
 */

import type { LintIssue } from "./types";

export function buildJsonRepairPrompt(rawText: string): string {
  return `You are a JSON repair utility.

TASK:
- Convert the following malformed output into STRICT valid JSON.
- Preserve intended data and structure as much as possible.
- Output JSON only. No markdown. No commentary.
- Required top-level shape:
{
  "files": [{ "path": "string", "content": "string" }],
  "dependencies": { "pkg": "version" },
  "_checks": { "key": true }
}

MALFORMED INPUT:
${rawText}`;
}

export function buildShapeRepairPrompt(args: {
  originalPrompt: string;
  parseError: string;
  parsedResponse: unknown;
}): string {
  const { originalPrompt, parseError, parsedResponse } = args;

  return `You returned JSON that does not match the required project shape.

Original request:
${originalPrompt}

Validation error:
${parseError}

Current response JSON:
${JSON.stringify(parsedResponse)}

Fix requirements:
- Return strict JSON only (no markdown).
- Shape must be:
{
  "files": [{ "path": "app/page.tsx", "content": "..." }],
  "dependencies": { "pkg": "version" },
  "_checks": { "key": true },
  "_design": { "visual_direction": "...", "typography_plan": "..." }
}
- files must be non-empty and use safe relative paths (no absolute paths, no .. segments).
- Include app/layout.tsx, app/page.tsx, and app/globals.css.
- Do not include lockfiles.
- Ensure all file contents are valid code/text strings.`;
}

export function buildLintRepairPrompt(args: {
  originalPrompt: string;
  files: { path: string; content: string }[];
  dependencies: Record<string, string>;
  lintIssues: LintIssue[];
}): string {
  const { originalPrompt, files, dependencies, lintIssues } = args;

  const hasNavigationUxIssue = lintIssues.some((issue) =>
    /^ux\/(?:mobile-navbar|navigation-required|navbar-stacking|navbar-nested-scroll|mobile-menu-overlay|mobile-menu-visibility|mobile-menu-height|mobile-menu-partial|mobile-menu-no-close|navbar-hero-overlap|navbar-invisible-text|badge-above-navbar|dashboard-blank-mobile|responsive-breakpoints|mobile-overflow-guard)$/.test(
      issue.rule ?? "",
    ),
  );
  const hasImageBudgetIssue = lintIssues.some(
    (issue) => issue.rule === "image/max-count",
  );

  const issueList = lintIssues
    .slice(0, 40)
    .map(
      (i) =>
        `- ${i.path}:${i.line}:${i.column} [${i.rule ?? "parse"}] ${i.message}`,
    )
    .join("\n");

  // Only send files that have lint issues — reduces input tokens and prevents
  // Gemini from rewriting unrelated files.
  const affectedPaths = new Set(lintIssues.map((i) => i.path));

  // Cross-file nav fixes: navbar-hero-overlap fix requires layout/page; invisible-text fix may need layout too
  const hasHeroOverlapIssue = lintIssues.some(
    (i) => i.rule === "ux/navbar-hero-overlap",
  );
  if (hasHeroOverlapIssue) {
    affectedPaths.add("app/layout.tsx");
    affectedPaths.add("app/page.tsx");
  }

  const affectedFiles = files
    .filter((f) => affectedPaths.has(f.path))
    .map((f) => ({ path: f.path, content: f.content }));

  return `You produced a project that failed lint/parse checks.

Original request:
${originalPrompt}

Fix these exact issues:
${issueList}

Affected project files (JSON):
${JSON.stringify(affectedFiles)}

Current dependencies:
${JSON.stringify(dependencies)}

Requirements:
- Fix only what is needed to resolve the reported errors.
- Keep app behavior/design unchanged unless required by the fix.
- Return ONLY the files you modified (not the entire project).
- JSON shape: { "files": [{ "path": "...", "content": "..." }], "dependencies": { ... } }
- Do NOT include unchanged files — the system will merge your changes automatically.
- dependencies should include the FULL dependency map (not a diff).
- Do not include markdown or explanations.
${
  hasNavigationUxIssue
    ? `- Navigation quality constraints:
  - Header/navbar must stay visible and pinned at top on mobile using "fixed top-0 left-0 right-0 w-full z-50" with a consistent height (h-16 or h-20).
  - HERO OVERLAP FIX: If the navbar is fixed, the first content element after the navbar (main, section, or layout wrapper) MUST have pt-16 or pt-20 matching the navbar height. If the issue is in app/layout.tsx or app/page.tsx, include that file in your response and add the padding there.
  - Mobile menu must open/close cleanly, anchored from the top layer.
  - FULL SCREEN OVERLAY: Mobile menu panel must use "fixed inset-0 z-[200]" (covers all 4 edges — top, right, bottom, left). Do NOT use only top-0 without bottom-0. The outer wrapper must be "fixed inset-0 z-[200] bg-[solidColor] flex flex-col". Inner panel must be h-full so no page content shows through at the bottom.
  - Mobile menu panel must use a FULLY OPAQUE background (bg-white, bg-gray-900, etc.) — no bg-opacity-*, no bg-white/80.
  - CLOSE BUTTON: The menu overlay MUST contain an explicit X/Close button in the top-right of the menu header row. Use a Lucide X icon in a button that calls setIsMenuOpen(false). Minimum 44×44px tap target.
  - Mobile menu header row: flex justify-between items-center, h-16, border-b. Brand/logo on left, X button on right. Nav links start below this row.
  - Ensure brand/logo text in mobile header does not wrap/collide with icons or first nav item; truncate long brand text.
  - Lock background page scroll while the mobile menu is open (document.body.style.overflow = 'hidden'), restore on close.
  - INVISIBLE TEXT FIX: If the navbar has a solid white/light background, the default (unscrolled) text color MUST be dark (text-gray-900 or text-black). Never use text-white as the default state on a light-background navbar — it makes brand name and links invisible at page load.
  - Trust badge / social proof elements must use z-index lower than the navbar (z-10 or below). Never z-50 or higher for badges/ribbons/award strips.
  - Define explicit navbar color/surface states for default, scrolled, menu-open, and non-home routes. Do not keep one text color for all states.
  - On non-home routes, navbar must use a solid readable surface with high-contrast brand/link colors; avoid transparent navbar with white text over light backgrounds.
  - After clicking a mobile nav link, close the menu and restore body scroll; ensure brand/nav text remains readable on destination route.
  - Keep inactive mobile nav links readable (avoid very low-contrast gray text on white surfaces).
  - DASHBOARD BLANK MOBILE FIX: If the content wrapper div (flex-1 overflow-y-auto) has a "hidden" class alongside it, remove "hidden" from the content wrapper — only the sidebar <aside> should be hidden on mobile. The correct shell is: outer div "flex h-screen overflow-hidden" → aside "hidden md:flex w-64" (sidebar) + div "flex flex-col flex-1 min-w-0 overflow-hidden" (content, always visible) → header "md:hidden h-16" (mobile top bar) + main "flex-1 overflow-y-auto" (scrollable content).
  - Do not create separate scrollbar UI on nav/header/menu wrappers.
  - Prevent horizontal overflow on small screens.`
    : ""
}
${
  hasImageBudgetIssue
    ? `- Image budget constraints:
  - Keep the entire app at or below 10 unique image sources/placeholders.
  - Preserve visual quality by prioritizing hero and top-value sections.
  - Replace lower-priority image-heavy sections/cards with iconography, gradients, or typography-driven UI.
  - Reuse existing image sources where appropriate instead of adding new ones.
  - Do not add new product cards/sections that require additional unique images once the budget is reached.`
    : ""
}`;
}

export function buildSchemaBootstrapRepairPrompt(args: {
  schemaSql: string;
  sqlError: string;
}): string {
  const { schemaSql, sqlError } = args;

  return `The following PostgreSQL schema failed to apply to a Supabase project.

POSTGRES ERROR:
${sqlError}

CURRENT SCHEMA SQL:
${schemaSql}

Fix requirements:
- Fix ONLY the SQL error described above.
- Preserve ALL tables, columns, indexes, RLS policies, and triggers — do not remove anything unless it directly causes the error.
- Output must be valid PostgreSQL that can run on Supabase (PostgreSQL 15+).
- Do not add markdown, explanations, or comments outside the SQL.
- Return strict JSON only with this shape: { "schema": "CREATE TABLE ..." }
- The "schema" value must contain the entire corrected schema SQL as a single string.`;
}
