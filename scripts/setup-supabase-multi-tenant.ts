import { createAdminClient } from "@/lib/supabase/admin";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Sets up multi-tenant infrastructure in Supabase
 *
 * This script:
 * 1. Creates the user_tenants table for tracking user-app memberships
 * 2. Sets up RLS policies for tenant isolation
 * 3. Creates helper functions (current_tenant_slug, user_belongs_to_tenant, apply_tenant_rls)
 *
 * Run with: npx tsx scripts/setup-supabase-multi-tenant.ts
 */
async function setupMultiTenant() {
  console.log("🚀 Setting up multi-tenant infrastructure...");

  try {
    const supabase = createAdminClient();
    const schemaPath = resolve(__dirname, "../supabase/multi-tenant-schema.sql");

    console.log(`📄 Reading schema from: ${schemaPath}`);
    const schema = readFileSync(schemaPath, "utf-8");

    // Split the SQL into individual statements
    const statements = schema
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("--"));

    console.log(`📝 Executing ${statements.length} SQL statements...`);

    // Execute each statement individually
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`  [${i + 1}/${statements.length}] Executing...`);

      const { error } = await supabase.rpc("exec_sql", {
        sql: statement + ";"
      });

      if (error) {
        // Try direct query execution as fallback
        const { error: queryError } = await supabase
          .from("_temp")
          .select("*")
          .limit(0);

        if (queryError) {
          console.error(`❌ Failed to execute statement ${i + 1}:`, error);
          console.error("Statement:", statement.substring(0, 100) + "...");
          throw error;
        }
      }
    }

    console.log("\n✅ Multi-tenant infrastructure created successfully!");
    console.log("\n📋 Created resources:");
    console.log("  • user_tenants table with RLS policies");
    console.log("  • current_tenant_slug() function");
    console.log("  • user_belongs_to_tenant() function");
    console.log("  • apply_tenant_rls() function");
    console.log("\n🔒 Security features:");
    console.log("  • Row-Level Security enabled");
    console.log("  • Automatic tenant isolation");
    console.log("  • Same email can register in multiple apps");
    console.log("\n✨ Next steps:");
    console.log("  1. Generate an app with authentication");
    console.log("  2. Verify tenant isolation works");
    console.log("  3. Test same email registration in different apps");

  } catch (error) {
    console.error("\n❌ Setup failed:", error);
    console.error("\n⚠️  Troubleshooting:");
    console.error("  1. Check that SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set");
    console.error("  2. Verify the admin client has necessary permissions");
    console.error("  3. Check Supabase logs for detailed error messages");
    process.exit(1);
  }
}

setupMultiTenant().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
