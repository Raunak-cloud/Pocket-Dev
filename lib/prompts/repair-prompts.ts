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
    /^ux\/(?:mobile-navbar|navigation-required|navbar-stacking|navbar-nested-scroll|mobile-menu-overlay|mobile-menu-visibility|mobile-menu-height|responsive-breakpoints|mobile-overflow-guard)$/.test(
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
  - Header/navbar must stay visible and pinned at top on mobile (sticky/fixed + top-0 + high z-index).
  - Mobile menu must open/close cleanly, anchored from the top layer.
  - Mobile menu panel must be above page content (not behind hero/cards), using fixed/absolute overlay positioning with strong z-index.
  - Mobile menu panel must use readable contrast and non-transparent background.
  - Mobile menu panel must span full mobile viewport height (h-screen/min-h-screen/100dvh or inset-y-0).
  - When mobile menu is open, underlying hero/content must not visually interfere with menu labels (use opaque menu surface plus a dedicated full-screen overlay).
  - Provide a clear close button and lock background page scroll while the mobile menu is open.
  - Define explicit navbar color/surface states for default, scrolled, menu-open, and non-home routes. Do not keep one text color for all states.
  - On non-home routes, navbar must use a solid readable surface with high-contrast brand/link colors; avoid transparent navbar with white text over light backgrounds.
  - After clicking a mobile nav link, close the menu and restore body scroll; ensure brand/nav text remains readable on destination route.
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
