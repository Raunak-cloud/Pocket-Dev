CREATE TABLE IF NOT EXISTS "supabase_project_pool" (
  "id" TEXT NOT NULL,
  "projectRef" TEXT NOT NULL,
  "organizationId" TEXT,
  "region" TEXT,
  "status" TEXT NOT NULL DEFAULT 'provisioning',
  "bindingKey" TEXT,
  "supabaseUrl" TEXT NOT NULL,
  "anonKey" TEXT NOT NULL,
  "serviceRoleKeyEncrypted" TEXT,
  "dbPasswordEncrypted" TEXT,
  "databaseUrlEncrypted" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "supabase_project_pool_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "supabase_project_pool_projectRef_key"
  ON "supabase_project_pool"("projectRef");

CREATE UNIQUE INDEX IF NOT EXISTS "supabase_project_pool_bindingKey_key"
  ON "supabase_project_pool"("bindingKey");

CREATE INDEX IF NOT EXISTS "supabase_project_pool_status_idx"
  ON "supabase_project_pool"("status");

CREATE INDEX IF NOT EXISTS "supabase_project_pool_bindingKey_idx"
  ON "supabase_project_pool"("bindingKey");

ALTER TABLE "supabase_project_pool"
  ADD COLUMN IF NOT EXISTS "databaseUrlEncrypted" TEXT;
