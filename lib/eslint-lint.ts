import { ESLint } from "eslint";

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
