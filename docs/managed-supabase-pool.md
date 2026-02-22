# Managed Supabase Pool Setup

This project now supports strict per-app Supabase isolation for generated apps.

## Required

- `SUPABASE_POOL_ENCRYPTION_KEY`
  - Any strong secret. Used to encrypt keys/passwords stored in `supabase_project_pool`.

## Pool sources (choose one or both)

- Pre-provisioned pool:
  - `SUPABASE_PREPROVISIONED_POOL` as JSON array.
  - Example:
    ```json
    [
      {
        "projectRef": "abcd1234",
        "supabaseUrl": "https://abcd1234.supabase.co",
        "anonKey": "sb_publishable_...",
        "serviceRoleKey": "sb_secret_...",
        "dbPassword": "your-db-password",
        "databaseUrl": "postgresql://postgres:...@db.abcd1234.supabase.co:5432/postgres"
      }
    ]
    ```

- Auto-provision via Supabase Management API:
  - `SUPABASE_MANAGEMENT_TOKEN`
  - `SUPABASE_ORGANIZATION_ID`
  - Optional:
    - `SUPABASE_PROJECT_PLAN` (default: `free`)
    - `SUPABASE_DEFAULT_REGION` (default: `us-east-1`)
    - `SUPABASE_POOL_MIN_READY` (default: `3`)

## Optional database URL template

- `SUPABASE_POOL_DATABASE_URL_TEMPLATE`
  - Used to derive `DATABASE_URL` for generated apps from project ref + db password.
  - Supported placeholders:
    - `{PROJECT_REF}`
    - `{DB_PASSWORD}` (URL-encoded)
    - `{DB_PASSWORD_RAW}` (unencoded)
  - Example:
    `postgresql://postgres:{DB_PASSWORD}@db.{PROJECT_REF}.supabase.co:5432/postgres`

## Lifecycle behavior

- Generation allocates a pool project when auth/db is requested.
- New saved project rebinds allocation from generation run ID to persistent `project.id`.
- Edits reuse the same `project.id` binding.
- Publish resolves binding by `project.id` and auto-allocates for older projects if auth/db signals are detected.

## Optional admin endpoint

- `GET /api/admin/supabase-pool`
  - Returns pool counts (`ready`, `assigned`, `provisioning`, `failed`).
- `POST /api/admin/supabase-pool`
  - Refill/sync pool.
  - Body:
    - `minReady` (number, optional)
    - `syncPreprovisioned` (boolean, optional)
- To protect this endpoint, set:
  - `SUPABASE_POOL_ADMIN_TOKEN`
  - Send header `x-supabase-pool-admin-token: <token>`
