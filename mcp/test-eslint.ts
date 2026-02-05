/**
 * MCP client test — spins up the eslint-mcp server over stdio, calls lint_code
 * twice (once with clean code, once with intentionally broken code), and prints
 * the server's response for each.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverScript = resolve(__dirname, "eslint-server.ts");

// ---------------------------------------------------------------------------
// Sample snippets
// ---------------------------------------------------------------------------

/** Well-written code — should produce zero errors / warnings */
const GOOD_CODE = `
const add = (a, b) => a + b;
add(2, 3);
`.trim();

/** Intentionally broken code — triggers multiple rules */
const BAD_CODE = `
var greeting = "hello";
const unused = 42;
if (greeting == "hello") {
  console.log("matched");
}

function empty() {}
`.trim();

// ---------------------------------------------------------------------------
// Helper — call lint_code and pretty-print the response
// ---------------------------------------------------------------------------
async function callLint(client: Client, label: string, code: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(` ${label}`);
  console.log("=".repeat(60));
  console.log("Code being linted:");
  console.log("─".repeat(40));
  code.split("\n").forEach((line, i) => console.log(`  ${i + 1} │ ${line}`));
  console.log("─".repeat(40));

  const response = await client.callTool({ name: "lint_code", arguments: { code } });

  const text =
    response.content &&
    Array.isArray(response.content) &&
    response.content[0] &&
    "text" in response.content[0]
      ? (response.content[0] as { text: string }).text
      : JSON.stringify(response, null, 2);

  console.log("\nESLint MCP Response:");
  console.log("─".repeat(40));
  console.log(text);
  console.log("─".repeat(40));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("Starting eslint-mcp server via stdio...");

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", serverScript],
  });

  const client = new Client(
    { name: "eslint-test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log("Connected to eslint-mcp server.");

  // 1. List available tools (sanity check)
  const { tools } = await client.listTools();
  console.log("\nAvailable tools:", tools.map((t) => t.name));

  // 2. Lint good code
  await callLint(client, "TEST 1 — Good Code (expect PASS)", GOOD_CODE);

  // 3. Lint bad code
  await callLint(client, "TEST 2 — Bad Code (expect FAIL)", BAD_CODE);

  // Cleanup
  await client.close();
  console.log("\nDone. Client disconnected.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
