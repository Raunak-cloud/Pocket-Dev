import { ESLint } from "eslint";
import type { CustomSection, ConfigSection } from "./templates/types";

/**
 * Rules kept in sync with mcp/eslint-server.ts.
 * Errors block generation; warnings pass through.
 */
const LINT_RULES = {
  "no-unused-vars": "error",
  "no-undef": "error",
  "no-console": "warn",
  "no-empty": "error",
  "eqeqeq": "error",
  "no-var": "error",
  "prefer-const": "error",
  "semi": ["error", "always"],
} as const;

/**
 * Relaxed rules for AI-generated custom section JSX.
 * no-undef is off because we can't resolve imports without a TS parser.
 * no-unused-vars is off because React imports look "unused" to plain ESLint.
 */
const CUSTOM_SECTION_RULES = {
  "no-empty": "error",
  "no-var": "error",
  "prefer-const": "error",
  "eqeqeq": "error",
  "no-console": "warn",
} as const;

export interface LintMessage {
  line: number;
  column: number;
  severity: "error" | "warning";
  rule: string | null;
  message: string;
}

export interface LintResult {
  errorCount: number;
  warningCount: number;
  messages: LintMessage[];
  passed: boolean;
}

export async function lintCode(
  code: string,
  filename = "website.js"
): Promise<LintResult> {
  const eslint = new ESLint({
    overrideConfigFile: null,
    // @ts-expect-error — ESLint's RulesConfig index signature is overly narrow
    baseConfig: [{ rules: LINT_RULES }],
  });

  const results = await eslint.lintText(code, { filePath: filename });
  const file = results[0];

  const messages: LintMessage[] = file.messages.map((m) => ({
    line: m.line,
    column: m.column,
    severity: m.severity === 2 ? "error" : "warning",
    rule: m.ruleId,
    message: m.message,
  }));

  return {
    errorCount: file.errorCount,
    warningCount: file.warningCount,
    messages,
    passed: file.errorCount === 0,
  };
}

// ── Custom section validation ────────────────────────────────────

/**
 * Lint a custom section's code with JSX-aware, relaxed rules.
 * Returns a LintResult — errors mean the code is broken.
 */
async function lintCustomCode(code: string, componentName: string): Promise<LintResult> {
  try {
    const eslint = new ESLint({
      overrideConfigFile: null,
      baseConfig: [{
        languageOptions: {
          ecmaVersion: 2022,
          sourceType: "module",
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        rules: CUSTOM_SECTION_RULES as any,
      }],
    });

    const results = await eslint.lintText(code, {
      filePath: `${componentName}.jsx`,
    });
    const file = results[0];

    const messages: LintMessage[] = file.messages.map((m) => ({
      line: m.line,
      column: m.column,
      severity: m.severity === 2 ? "error" : "warning",
      rule: m.ruleId,
      message: m.message,
    }));

    return {
      errorCount: file.errorCount,
      warningCount: file.warningCount,
      messages,
      passed: file.errorCount === 0,
    };
  } catch {
    // ESLint crashed — treat as parse failure
    return {
      errorCount: 1,
      warningCount: 0,
      messages: [{ line: 1, column: 1, severity: "error", rule: null, message: "Failed to parse component code" }],
      passed: false,
    };
  }
}

/**
 * Structural checks that ESLint can't catch:
 * - Must have a default export
 * - Must not be empty
 */
function structuralCheck(code: string, componentName: string): LintMessage[] {
  const errors: LintMessage[] = [];

  if (!code.trim()) {
    errors.push({ line: 1, column: 1, severity: "error", rule: "custom/non-empty", message: "Custom section code is empty" });
  }

  if (!/export\s+default\b/.test(code)) {
    errors.push({ line: 1, column: 1, severity: "error", rule: "custom/default-export", message: `${componentName}: missing default export` });
  }

  return errors;
}

/**
 * Validate all custom sections in a section list.
 * Returns only the sections that pass — bad ones are filtered out with a console warning.
 */
export async function validateCustomSections(sections: ConfigSection[]): Promise<ConfigSection[]> {
  const result: ConfigSection[] = [];

  for (const section of sections) {
    if (section.type !== "custom") {
      result.push(section);
      continue;
    }

    const custom = section as CustomSection;
    const name = custom.componentName;

    // Structural checks first (fast, no ESLint)
    const structErrors = structuralCheck(custom.code, name);
    if (structErrors.some((e) => e.severity === "error")) {
      console.warn(`⚠️ Custom section "${name}" failed structural check — dropping:`);
      structErrors.forEach((e) => console.warn(`   ${e.message}`));
      continue;
    }

    // ESLint parse + rules check
    const lint = await lintCustomCode(custom.code, name);
    if (!lint.passed) {
      console.warn(`⚠️ Custom section "${name}" has lint errors — dropping:`);
      lint.messages
        .filter((m) => m.severity === "error")
        .forEach((m) => console.warn(`   L${m.line}:${m.column} ${m.message} (${m.rule})`));
      continue;
    }

    if (lint.warningCount > 0) {
      console.log(`ℹ️ Custom section "${name}" has ${lint.warningCount} warning(s) — keeping`);
    }

    result.push(section);
  }

  return result;
}
