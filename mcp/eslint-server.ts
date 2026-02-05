import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ESLint } from "eslint";

// ---------------------------------------------------------------------------
// ESLint rules exposed by this server
// ---------------------------------------------------------------------------
const LINT_RULES: Record<string, string> = {
  "no-unused-vars": "error",
  "no-undef": "error",
  "no-console": "warn",
  "no-empty": "error",
  "eqeqeq": "error",
  "no-var": "error",
  "prefer-const": "error",
  "semi": ["error", "always"] as unknown as string,
};

// ---------------------------------------------------------------------------
// Input schema for the lint_code tool
// ---------------------------------------------------------------------------
const LintCodeInput = z.object({
  code: z.string().describe("The source code to lint"),
  filename: z
    .string()
    .optional()
    .default("input.js")
    .describe("Virtual filename (controls parser — use .ts/.tsx for TypeScript)"),
});

// ---------------------------------------------------------------------------
// Helper — run ESLint on a string and return structured results
// ---------------------------------------------------------------------------
async function runLint(code: string, filename: string) {
  const eslint = new ESLint({
    overrideConfigFile: null, // skip project config files
    baseConfig: [
      {
        // @ts-expect-error — ESLint's RulesConfig index signature is overly narrow
        rules: LINT_RULES,
      },
    ],
  });

  const results = await eslint.lintText(code, { filePath: filename });
  const file = results[0];

  return {
    filename,
    errorCount: file.errorCount,
    warningCount: file.warningCount,
    messages: file.messages.map((m) => ({
      line: m.line,
      column: m.column,
      severity: m.severity === 2 ? "error" : "warning",
      rule: m.ruleId,
      message: m.message,
    })),
  };
}

// ---------------------------------------------------------------------------
// MCP Server setup
// ---------------------------------------------------------------------------
const server = new Server(
  {
    name: "eslint-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(
  ListToolsRequestSchema,
  async () => ({
    tools: [
      {
        name: "lint_code",
        description:
          "Run ESLint on a code snippet and return any errors or warnings. " +
          "Useful for catching common issues like unused variables, missing semicolons, " +
          "use of var, and equality checks before code is committed.",
        inputSchema: {
          type: "object" as const,
          properties: {
            code: {
              type: "string" as const,
              description: "The source code to lint",
            },
            filename: {
              type: "string" as const,
              description:
                "Virtual filename (controls parser). Use .ts/.tsx for TypeScript. Defaults to input.js",
            },
          },
          required: ["code"],
        },
      },
    ],
  })
);

server.setRequestHandler(
  CallToolRequestSchema,
  async (request) => {
    if (request.params.name !== "lint_code") {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      };
    }

    const parsed = LintCodeInput.parse(request.params.arguments);
    const result = await runLint(parsed.code, parsed.filename);

    const status =
      result.errorCount === 0 && result.warningCount === 0 ? "PASS" : "FAIL";

    const summary =
      `[${status}] ${result.filename} — ` +
      `${result.errorCount} error(s), ${result.warningCount} warning(s)`;

    const detail =
      result.messages.length === 0
        ? "No issues found."
        : result.messages
            .map(
              (m) =>
                `  Line ${m.line}:${m.column}  [${m.severity}]  ${m.rule}  →  ${m.message}`
            )
            .join("\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `${summary}\n${detail}`,
        },
      ],
      isError: result.errorCount > 0,
    };
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[eslint-mcp] Server running on stdio");
