import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export type ManagedSupabaseAuthConfig = {
  projectRef: string;
  supabaseUrl: string;
  anonKey: string;
  databaseUrl?: string;
};

type PreprovisionedEntry = {
  projectRef: string;
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey?: string;
  dbPassword?: string;
  databaseUrl?: string;
  organizationId?: string;
  region?: string;
};

type CreatedProject = {
  projectRef: string;
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey?: string;
  dbPassword: string;
  databaseUrl?: string;
  organizationId?: string;
  region?: string;
};

const DEFAULT_POOL_MIN_READY = 3;
const DEFAULT_REGION = process.env.SUPABASE_DEFAULT_REGION || "us-east-1";
const MGMT_API_BASE = "https://api.supabase.com/v1";
type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function parsePoolMinReady(): number {
  const raw = Number(process.env.SUPABASE_POOL_MIN_READY || DEFAULT_POOL_MIN_READY);
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_POOL_MIN_READY;
  return Math.floor(raw);
}

function randomPassword(length = 24): string {
  const bytes = crypto.randomBytes(length);
  return bytes
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, length);
}

function getEncryptionKey(): Buffer {
  const raw = process.env.SUPABASE_POOL_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("SUPABASE_POOL_ENCRYPTION_KEY is required");
  }

  // Accept base64/hex/plain; normalize to 32 bytes using sha256 if needed.
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
    if (key.length === 0) throw new Error("invalid base64");
  } catch {
    key = Buffer.from(raw);
  }

  if (key.length !== 32) {
    key = crypto.createHash("sha256").update(raw).digest();
  }

  return key;
}

function encryptSecret(plain: string): string {
  if (!plain) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  const data = Buffer.from(ciphertext, "base64");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

function hasProvisioningCredentials(): boolean {
  return Boolean(process.env.SUPABASE_MANAGEMENT_TOKEN && process.env.SUPABASE_ORGANIZATION_ID);
}

async function mgmtRequest(path: string, init?: RequestInit): Promise<unknown> {
  const token = process.env.SUPABASE_MANAGEMENT_TOKEN;
  if (!token) {
    throw new Error("SUPABASE_MANAGEMENT_TOKEN is not configured");
  }

  const res = await fetch(`${MGMT_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });

  const raw = await res.text();
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!res.ok) {
    const dataRecord = asRecord(data);
    const message =
      dataRecord?.message ||
      dataRecord?.error ||
      `Supabase management API error (${res.status})`;
    throw new Error(String(message));
  }

  return data;
}

function extractProjectRef(payload: unknown): string {
  const record = asRecord(payload);
  if (!record) return "";
  return (
    String(record.ref || "") ||
    String(record.id || "") ||
    String(record.project_ref || "") ||
    String(record.projectRef || "") ||
    ""
  );
}

function buildProjectUrl(ref: string): string {
  return `https://${ref}.supabase.co`;
}

function buildManagedDatabaseUrl(projectRef: string, dbPassword: string): string | undefined {
  const template = (process.env.SUPABASE_POOL_DATABASE_URL_TEMPLATE || "").trim();
  if (!template || !projectRef || !dbPassword) return undefined;

  return template
    .replace(/\{PROJECT_REF\}/g, projectRef)
    .replace(/\{DB_PASSWORD\}/g, encodeURIComponent(dbPassword))
    .replace(/\{DB_PASSWORD_RAW\}/g, dbPassword);
}

async function fetchApiKeys(projectRef: string): Promise<{
  anonKey: string;
  serviceRoleKey?: string;
}> {
  const data = await mgmtRequest(`/projects/${projectRef}/api-keys`, {
    method: "GET",
  });

  const record = asRecord(data);
  const list = Array.isArray(data)
    ? data
    : Array.isArray(record?.keys)
      ? record.keys
      : [];

  let anonKey = "";
  let serviceRoleKey = "";

  for (const key of list) {
    const keyRecord = asRecord(key);
    const name = String(keyRecord?.name || "").toLowerCase();
    const value = String(keyRecord?.api_key || keyRecord?.key || "");
    if (!value) continue;
    if (name.includes("anon") || name.includes("publishable")) {
      anonKey = value;
    }
    if (name.includes("service_role") || name.includes("service")) {
      serviceRoleKey = value;
    }
  }

  if (!anonKey) {
    throw new Error(`Could not find anon key for Supabase project ${projectRef}`);
  }

  return { anonKey, serviceRoleKey: serviceRoleKey || undefined };
}

async function waitForProjectKeys(projectRef: string): Promise<{
  anonKey: string;
  serviceRoleKey?: string;
}> {
  const maxAttempts = 20;
  const delayMs = 15000;

  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const keys = await fetchApiKeys(projectRef);
      if (keys.anonKey) return keys;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(
    `Timed out waiting for API keys for project ${projectRef}${lastError ? `: ${lastError}` : ""}`,
  );
}

async function createManagedProject(): Promise<CreatedProject> {
  const organizationId = process.env.SUPABASE_ORGANIZATION_ID;
  if (!organizationId) {
    throw new Error("SUPABASE_ORGANIZATION_ID is not configured");
  }

  const dbPassword = randomPassword(28);
  const name = `pd-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

  const created = await mgmtRequest("/projects", {
    method: "POST",
    body: JSON.stringify({
      name,
      organization_id: organizationId,
      region: DEFAULT_REGION,
      db_pass: dbPassword,
      plan: process.env.SUPABASE_PROJECT_PLAN || "free",
    }),
  });

  const projectRef = extractProjectRef(created);
  if (!projectRef) {
    throw new Error("Supabase create project response did not include project ref");
  }

  const keys = await waitForProjectKeys(projectRef);
  const databaseUrl = buildManagedDatabaseUrl(projectRef, dbPassword);

  return {
    projectRef,
    supabaseUrl: buildProjectUrl(projectRef),
    anonKey: keys.anonKey,
    serviceRoleKey: keys.serviceRoleKey,
    dbPassword,
    databaseUrl,
    organizationId,
    region: DEFAULT_REGION,
  };
}

function resolveDatabaseUrlFromRow(row: {
  projectRef: string;
  databaseUrlEncrypted: string | null;
  dbPasswordEncrypted: string | null;
}): string | undefined {
  try {
    const explicitUrl = decryptSecret(row.databaseUrlEncrypted);
    if (explicitUrl) return explicitUrl;

    const dbPassword = decryptSecret(row.dbPasswordEncrypted);
    if (!dbPassword) return undefined;

    return buildManagedDatabaseUrl(row.projectRef, dbPassword);
  } catch (error) {
    console.warn(
      "[supabase-pool] Unable to resolve managed database URL:",
      error instanceof Error ? error.message : String(error),
    );
    return undefined;
  }
}

export async function upsertPreprovisionedPoolEntries(): Promise<void> {
  const raw = process.env.SUPABASE_PREPROVISIONED_POOL;
  if (!raw) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error("[supabase-pool] Failed to parse SUPABASE_PREPROVISIONED_POOL", error);
    return;
  }

  if (!Array.isArray(parsed)) return;

  for (const item of parsed as PreprovisionedEntry[]) {
    if (!item?.projectRef || !item?.supabaseUrl || !item?.anonKey) continue;

    await prisma.supabaseProjectPool.upsert({
      where: { projectRef: item.projectRef },
      create: {
        projectRef: item.projectRef,
        organizationId: item.organizationId,
        region: item.region,
        status: "ready",
        bindingKey: null,
        supabaseUrl: item.supabaseUrl,
        anonKey: item.anonKey,
        serviceRoleKeyEncrypted: item.serviceRoleKey
          ? encryptSecret(item.serviceRoleKey)
          : null,
        dbPasswordEncrypted: item.dbPassword ? encryptSecret(item.dbPassword) : null,
        databaseUrlEncrypted: item.databaseUrl ? encryptSecret(item.databaseUrl) : null,
      },
      update: {
        organizationId: item.organizationId,
        region: item.region,
        supabaseUrl: item.supabaseUrl,
        anonKey: item.anonKey,
        serviceRoleKeyEncrypted: item.serviceRoleKey
          ? encryptSecret(item.serviceRoleKey)
          : undefined,
        dbPasswordEncrypted: item.dbPassword ? encryptSecret(item.dbPassword) : undefined,
        databaseUrlEncrypted: item.databaseUrl
          ? encryptSecret(item.databaseUrl)
          : undefined,
        lastError: null,
        status: "ready",
      },
    });
  }
}

export async function ensureSupabasePoolCapacity(minReady = parsePoolMinReady()): Promise<void> {
  await upsertPreprovisionedPoolEntries();

  const readyCount = await prisma.supabaseProjectPool.count({
    where: {
      status: "ready",
      bindingKey: null,
    },
  });

  if (readyCount >= minReady) return;
  if (!hasProvisioningCredentials()) {
    if (readyCount === 0) {
      throw new Error(
        "No pre-provisioned Supabase projects are available. Configure SUPABASE_PREPROVISIONED_POOL or management API credentials.",
      );
    }
    return;
  }

  const toCreate = minReady - readyCount;

  for (let i = 0; i < toCreate; i++) {
    try {
      const created = await createManagedProject();
      await prisma.supabaseProjectPool.upsert({
        where: { projectRef: created.projectRef },
        create: {
          projectRef: created.projectRef,
          organizationId: created.organizationId,
          region: created.region,
          status: "ready",
          bindingKey: null,
          supabaseUrl: created.supabaseUrl,
          anonKey: created.anonKey,
          serviceRoleKeyEncrypted: created.serviceRoleKey
            ? encryptSecret(created.serviceRoleKey)
            : null,
          dbPasswordEncrypted: encryptSecret(created.dbPassword),
          databaseUrlEncrypted: created.databaseUrl
            ? encryptSecret(created.databaseUrl)
            : null,
        },
        update: {
          organizationId: created.organizationId,
          region: created.region,
          status: "ready",
          supabaseUrl: created.supabaseUrl,
          anonKey: created.anonKey,
          serviceRoleKeyEncrypted: created.serviceRoleKey
            ? encryptSecret(created.serviceRoleKey)
            : undefined,
          dbPasswordEncrypted: encryptSecret(created.dbPassword),
          databaseUrlEncrypted: created.databaseUrl
            ? encryptSecret(created.databaseUrl)
            : undefined,
          lastError: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[supabase-pool] Failed to create managed project:", message);
    }
  }
}

export async function getAuthConfigForBindingKey(
  bindingKey: string,
): Promise<ManagedSupabaseAuthConfig | null> {
  const row = await prisma.supabaseProjectPool.findFirst({
    where: { bindingKey },
    orderBy: { createdAt: "asc" },
  });

  if (!row) return null;

  return {
    projectRef: row.projectRef,
    supabaseUrl: row.supabaseUrl,
    anonKey: row.anonKey,
    databaseUrl: resolveDatabaseUrlFromRow(row),
  };
}

async function tryAcquireReadyProject(bindingKey: string): Promise<ManagedSupabaseAuthConfig | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = await prisma.supabaseProjectPool.findFirst({
      where: {
        status: "ready",
        bindingKey: null,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!candidate) return null;

    const updated = await prisma.supabaseProjectPool.updateMany({
      where: {
        id: candidate.id,
        status: "ready",
        bindingKey: null,
      },
      data: {
        status: "assigned",
        bindingKey,
        lastError: null,
      },
    });

    if (updated.count > 0) {
      return {
        projectRef: candidate.projectRef,
        supabaseUrl: candidate.supabaseUrl,
        anonKey: candidate.anonKey,
        databaseUrl: resolveDatabaseUrlFromRow(candidate),
      };
    }
  }

  return null;
}

export async function acquireAuthConfigForBindingKey(
  bindingKey: string,
): Promise<ManagedSupabaseAuthConfig> {
  const existing = await getAuthConfigForBindingKey(bindingKey);
  if (existing) return existing;

  await ensureSupabasePoolCapacity();

  const allocated = await tryAcquireReadyProject(bindingKey);
  if (allocated) return allocated;

  await ensureSupabasePoolCapacity(parsePoolMinReady() + 1);
  const retry = await tryAcquireReadyProject(bindingKey);
  if (retry) return retry;

  throw new Error(
    "No Supabase project is available in the provisioning pool. Please try again in a minute.",
  );
}

export async function rebindAuthConfigBindingKey(
  fromBindingKey: string,
  toBindingKey: string,
): Promise<void> {
  if (!fromBindingKey || !toBindingKey || fromBindingKey === toBindingKey) return;

  const existingTarget = await prisma.supabaseProjectPool.findFirst({
    where: { bindingKey: toBindingKey },
    select: { id: true },
  });
  if (existingTarget) return;

  await prisma.supabaseProjectPool.updateMany({
    where: { bindingKey: fromBindingKey },
    data: { bindingKey: toBindingKey, status: "assigned" },
  });
}

export async function releaseBindingKey(bindingKey: string): Promise<void> {
  await prisma.supabaseProjectPool.updateMany({
    where: { bindingKey },
    data: {
      bindingKey: null,
      status: "ready",
      lastError: null,
    },
  });
}

export async function getSupabasePoolStats() {
  const [ready, assigned, provisioning, failed] = await Promise.all([
    prisma.supabaseProjectPool.count({ where: { status: "ready", bindingKey: null } }),
    prisma.supabaseProjectPool.count({ where: { status: "assigned" } }),
    prisma.supabaseProjectPool.count({ where: { status: "provisioning" } }),
    prisma.supabaseProjectPool.count({ where: { status: "failed" } }),
  ]);

  return { ready, assigned, provisioning, failed };
}
