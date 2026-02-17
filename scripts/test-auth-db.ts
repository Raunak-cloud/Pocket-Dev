/**
 * Test script to validate authentication and database setup
 * Run with: npx tsx scripts/test-auth-db.ts
 */

// Load environment variables from .env.local manually
import { readFileSync } from "fs";
import { resolve } from "path";

try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  envFile.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex === -1) return;

    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();

    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key && value) {
      process.env[key] = value;
    }
  });
} catch (error) {
  console.error("Warning: Could not load .env.local file");
}

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testDatabaseConnection() {
  log("\n=== Testing Database Connection ===", "blue");

  try {
    // Test connection
    await prisma.$connect();
    log("✓ Database connection successful", "green");

    // Test query
    const userCount = await prisma.user.count();
    log(`✓ Found ${userCount} users in database`, "green");

    // Check if database is empty
    if (userCount === 0) {
      log("⚠ Database is empty (no users yet)", "yellow");
    }

    return true;
  } catch (error) {
    log("✗ Database connection failed", "red");
    if (error instanceof Error) {
      log(`  Error: ${error.message}`, "red");
    }
    return false;
  }
}

async function testSupabaseConnection() {
  log("\n=== Testing Supabase Connection ===", "blue");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Check environment variables
  if (!url) {
    log("✗ NEXT_PUBLIC_SUPABASE_URL not set", "red");
    return false;
  }
  log("✓ NEXT_PUBLIC_SUPABASE_URL is set", "green");

  if (!anonKey) {
    log("✗ NEXT_PUBLIC_SUPABASE_ANON_KEY not set", "red");
    return false;
  }
  log("✓ NEXT_PUBLIC_SUPABASE_ANON_KEY is set", "green");

  if (!serviceKey) {
    log("✗ SUPABASE_SERVICE_ROLE_KEY not set", "red");
    return false;
  }
  log("✓ SUPABASE_SERVICE_ROLE_KEY is set", "green");

  try {
    // Test connection with service role key
    const supabase = createClient(url, serviceKey);

    // Test auth connection by listing users (requires service role)
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    if (error) {
      log("✗ Supabase auth connection failed", "red");
      log(`  Error: ${error.message}`, "red");
      return false;
    }

    log("✓ Supabase auth connection successful", "green");
    log(`  Found ${data.users.length > 0 ? "users" : "no users yet"} in Supabase Auth`, "cyan");

    // Test storage connection
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

    if (bucketError) {
      log("✗ Supabase storage connection failed", "red");
      log(`  Error: ${bucketError.message}`, "red");
      return false;
    }

    log("✓ Supabase storage connection successful", "green");
    log(`  Found ${buckets.length} storage bucket(s)`, "cyan");

    if (buckets.length > 0) {
      buckets.forEach(bucket => {
        log(`    - ${bucket.name} (${bucket.public ? "public" : "private"})`, "cyan");
      });
    }

    return true;
  } catch (error) {
    log("✗ Supabase connection failed", "red");
    if (error instanceof Error) {
      log(`  Error: ${error.message}`, "red");
    }
    return false;
  }
}

async function testAuthDatabaseSync() {
  log("\n=== Testing Auth-Database Sync ===", "blue");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    log("⚠ Skipping sync test (Supabase not configured)", "yellow");
    return false;
  }

  try {
    const supabase = createClient(url, serviceKey);

    // Get Supabase users
    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUsers = authData?.users || [];

    if (authUsers.length === 0) {
      log("⚠ No users in Supabase Auth yet", "yellow");
      log("  Sign in at least once to test sync", "yellow");
      return true;
    }

    log(`Found ${authUsers.length} user(s) in Supabase Auth`, "cyan");

    // Check if they're synced to Prisma
    let syncedCount = 0;
    let unsyncedCount = 0;

    for (const authUser of authUsers) {
      const prismaUser = await prisma.user.findUnique({
        where: { authUserId: authUser.id },
      });

      if (prismaUser) {
        syncedCount++;
        log(`  ✓ ${authUser.email} is synced (ID: ${authUser.id})`, "green");
      } else {
        unsyncedCount++;
        log(`  ✗ ${authUser.email} is NOT synced (ID: ${authUser.id})`, "red");
      }
    }

    if (unsyncedCount > 0) {
      log(`\n⚠ ${unsyncedCount} user(s) not synced to database`, "yellow");
      log("  These users may have signed up before sync was implemented", "yellow");
      log("  They will be synced on their next login", "yellow");
    } else {
      log("\n✓ All Supabase users are synced to database", "green");
    }

    return unsyncedCount === 0;
  } catch (error) {
    log("✗ Auth-Database sync check failed", "red");
    if (error instanceof Error) {
      log(`  Error: ${error.message}`, "red");
    }
    return false;
  }
}

async function testEnvironmentVariables() {
  log("\n=== Checking Environment Variables ===", "blue");

  const requiredVars = [
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GEMINI_API_KEY",
    "REPLICATE_API_TOKEN",
  ];

  const optionalVars = [
    "STRIPE_SECRET_KEY",
    "RESEND_API_KEY",
    "INNGEST_EVENT_KEY",
  ];

  let allRequired = true;

  log("\nRequired Variables:", "cyan");
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      log(`  ✓ ${varName}`, "green");
    } else {
      log(`  ✗ ${varName} (MISSING)`, "red");
      allRequired = false;
    }
  }

  log("\nOptional Variables:", "cyan");
  for (const varName of optionalVars) {
    if (process.env[varName]) {
      log(`  ✓ ${varName}`, "green");
    } else {
      log(`  ⚠ ${varName} (not set)`, "yellow");
    }
  }

  return allRequired;
}

async function runAllTests() {
  log("╔═══════════════════════════════════════════════════════════╗", "cyan");
  log("║  Authentication & Database Configuration Test Suite     ║", "cyan");
  log("╚═══════════════════════════════════════════════════════════╝", "cyan");

  const results = {
    env: await testEnvironmentVariables(),
    database: await testDatabaseConnection(),
    supabase: await testSupabaseConnection(),
    sync: await testAuthDatabaseSync(),
  };

  // Summary
  log("\n" + "=".repeat(60), "cyan");
  log("TEST SUMMARY", "cyan");
  log("=".repeat(60), "cyan");

  const tests = [
    { name: "Environment Variables", passed: results.env },
    { name: "Database Connection", passed: results.database },
    { name: "Supabase Connection", passed: results.supabase },
    { name: "Auth-DB Sync", passed: results.sync },
  ];

  tests.forEach((test) => {
    const status = test.passed ? "✓ PASS" : "✗ FAIL";
    const color = test.passed ? "green" : "red";
    log(`${status} - ${test.name}`, color);
  });

  const allPassed = Object.values(results).every((r) => r === true);

  log("\n" + "=".repeat(60), "cyan");
  if (allPassed) {
    log("🎉 All tests passed! Your auth & database setup is correct.", "green");
  } else {
    log("⚠️  Some tests failed. Review the output above for details.", "yellow");
  }
  log("=".repeat(60) + "\n", "cyan");

  await prisma.$disconnect();

  process.exit(allPassed ? 0 : 1);
}

runAllTests().catch((error) => {
  log("\n✗ Test suite crashed", "red");
  console.error(error);
  process.exit(1);
});
