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

  const issueList = lintIssues
    .slice(0, 40)
    .map(
      (i) =>
        `- ${i.path}:${i.line}:${i.column} [${i.rule ?? "parse"}] ${i.message}`,
    )
    .join("\n");

  const filePayload = files.map((f) => ({ path: f.path, content: f.content }));

  return `You produced a project that failed lint/parse checks.

Original request:
${originalPrompt}

Fix these exact issues:
${issueList}

Current project files (JSON):
${JSON.stringify(filePayload)}

Current dependencies:
${JSON.stringify(dependencies)}

Requirements:
- Fix only what is needed to resolve the reported errors.
- Keep app behavior/design unchanged unless required by the fix.
- Return COMPLETE valid JSON in the required shape with full files + dependencies.
- Do not include markdown or explanations.
${
  hasNavigationUxIssue
    ? `- Navigation quality constraints:
  - Header/navbar must stay visible and pinned at top on mobile (sticky/fixed + top-0 + high z-index).
  - Mobile menu must open/close cleanly, anchored from the top layer.
  - Mobile menu panel must be above page content (not behind hero/cards), using fixed/absolute overlay positioning with strong z-index.
  - Mobile menu panel must use readable contrast and non-transparent background.
  - Mobile menu panel must span full mobile viewport height (h-screen/min-h-screen/100dvh or inset-y-0).
  - Do not create separate scrollbar UI on nav/header/menu wrappers.
  - Prevent horizontal overflow on small screens.`
    : ""
}`;
}
