import { generateFullCode } from "./lib/ai-code-generator";
import { prepareE2BFiles } from "./lib/e2b-utils";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const TEST_DIR = path.join(process.cwd(), ".test-build");

async function main() {
  console.log("=== Pocket Dev Test Generation ===\n");

  // 1. Generate a test project
  console.log("[1/4] Generating test website with AI...");
  const result = await generateFullCode(
    "Create a modern restaurant website called Bella Cucina with a home page featuring a hero section, menu page with Italian dishes, reservations page with a booking form, and about page with the restaurant story",
    (msg) => console.log(`  -> ${msg}`)
  );

  console.log(`  -> Generated ${result.files.length} files`);
  console.log(`  -> Dependencies: ${Object.keys(result.dependencies).join(", ")}`);
  console.log(`  -> Lint: ${result.lintReport.passed ? "PASSED" : "FAILED"} (${result.lintReport.errors} errors, ${result.lintReport.warnings} warnings)`);

  // 2. Prepare files using the same logic as E2B (managed configs override AI configs)
  console.log("\n[2/4] Preparing project files (applying managed configs)...");
  const e2bFiles = prepareE2BFiles(result);
  const fileCount = Object.keys(e2bFiles).length;
  console.log(`  -> ${fileCount} total files after config merge`);

  // 3. Write all files to the test directory
  console.log(`\n[3/4] Writing files to ${TEST_DIR}...`);
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });

  for (const [filePath, content] of Object.entries(e2bFiles)) {
    const fullPath = path.join(TEST_DIR, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, "utf-8");
  }
  console.log(`  -> All files written`);

  // List the generated files
  console.log("\n  Files:");
  for (const filePath of Object.keys(e2bFiles).sort()) {
    console.log(`    ${filePath}`);
  }

  // 4. Install deps and build
  console.log("\n[4/4] Installing dependencies and building...");
  try {
    execSync("npm install --legacy-peer-deps", {
      cwd: TEST_DIR,
      stdio: "pipe",
      timeout: 120000,
    });
    console.log("  -> npm install: OK");
  } catch (err: any) {
    console.error("  -> npm install FAILED:");
    console.error(err.stdout?.toString().slice(-500));
    console.error(err.stderr?.toString().slice(-500));
    process.exit(1);
  }

  try {
    const buildOutput = execSync("npx next build", {
      cwd: TEST_DIR,
      stdio: "pipe",
      timeout: 180000,
    });
    console.log("  -> next build: OK");
    console.log(buildOutput.toString().slice(-600));
  } catch (err: any) {
    console.error("\n  -> next build FAILED:");
    const stderr = err.stderr?.toString() || "";
    const stdout = err.stdout?.toString() || "";
    console.error(stdout.slice(-1500));
    console.error(stderr.slice(-1500));
    process.exit(1);
  }

  console.log("\n=== TEST PASSED — Generated website builds without errors ===");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
