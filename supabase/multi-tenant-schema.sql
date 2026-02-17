-- Multi-Tenant Authentication Schema
-- This schema enables multiple apps to share a single Supabase instance
-- with complete data isolation between tenants (apps)

-- User-Tenant Memberships Table
-- Tracks which users belong to which apps (tenants)
CREATE TABLE IF NOT EXISTS public.user_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(user_id, tenant_slug)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id ON public.user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_slug ON public.user_tenants(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_user_tenants_lookup ON public.user_tenants(user_id, tenant_slug);

-- Enable Row Level Security
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_tenants table
CREATE POLICY "Users can view own tenant memberships"
  ON public.user_tenants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to join tenants"
  ON public.user_tenants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Tenant Context Functions
-- Get the current tenant slug from session context
CREATE OR REPLACE FUNCTION public.current_tenant_slug()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_tenant', true);
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if current user belongs to current tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant()
RETURNS BOOLEAN AS $$
DECLARE
  v_tenant TEXT;
  v_user_id UUID;
BEGIN
  v_tenant := public.current_tenant_slug();
  v_user_id := auth.uid();

  IF v_tenant IS NULL OR v_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id = v_user_id AND tenant_slug = v_tenant
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- RLS Policy Template Generator
-- Applies tenant isolation policies to any table
-- Usage: SELECT apply_tenant_rls('table_name', 'tenant_slug_column');
CREATE OR REPLACE FUNCTION public.apply_tenant_rls(
  p_table_name TEXT,
  p_tenant_column TEXT DEFAULT 'tenant_slug'
)
RETURNS VOID AS $$
BEGIN
  -- Enable RLS on the table
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);

  -- Policy for SELECT: User can see rows for their tenant
  EXECUTE format(
    'CREATE POLICY "tenant_isolation_select_%s" ON %I FOR SELECT USING (%I = public.current_tenant_slug() AND public.user_belongs_to_tenant())',
    p_table_name, p_table_name, p_tenant_column
  );

  -- Policy for INSERT: User can only insert rows for their tenant
  EXECUTE format(
    'CREATE POLICY "tenant_isolation_insert_%s" ON %I FOR INSERT WITH CHECK (%I = public.current_tenant_slug() AND public.user_belongs_to_tenant())',
    p_table_name, p_table_name, p_tenant_column
  );

  -- Policy for UPDATE: User can only update rows for their tenant
  EXECUTE format(
    'CREATE POLICY "tenant_isolation_update_%s" ON %I FOR UPDATE USING (%I = public.current_tenant_slug() AND public.user_belongs_to_tenant())',
    p_table_name, p_table_name, p_tenant_column
  );

  -- Policy for DELETE: User can only delete rows for their tenant
  EXECUTE format(
    'CREATE POLICY "tenant_isolation_delete_%s" ON %I FOR DELETE USING (%I = public.current_tenant_slug() AND public.user_belongs_to_tenant())',
    p_table_name, p_table_name, p_tenant_column
  );
END;
$$ LANGUAGE plpgsql;
