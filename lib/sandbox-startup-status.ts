import fs from "node:fs";
import path from "node:path";
import os from "node:os";

type StartupPhase = "creating" | "installing" | "starting" | "ready" | "error";

type SandboxStartupStatus = {
  id: string;
  phase: StartupPhase;
  logs: string[];
  error: string | null;
  sandboxId: string | null;
  url: string | null;
  updatedAt: number;
  expiresAt: number;
};

const STATUS_TTL_MS = 30 * 60 * 1000;
const MAX_LOG_LINES = 250;
const STATUS_DIR = path.join(os.tmpdir(), "pocket-dev-sandbox-status");

function now() {
  return Date.now();
}

function ensureDir() {
  if (!fs.existsSync(STATUS_DIR)) {
    fs.mkdirSync(STATUS_DIR, { recursive: true });
  }
}

function getStatusPath(id: string) {
  return path.join(STATUS_DIR, `${id}.json`);
}

function writeStatus(status: SandboxStartupStatus) {
  ensureDir();
  const target = getStatusPath(status.id);
  const temp = `${target}.tmp-${process.pid}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  fs.writeFileSync(temp, JSON.stringify(status), "utf8");
  fs.renameSync(temp, target);
}

function readStatus(id: string): SandboxStartupStatus | null {
  ensureDir();
  const file = getStatusPath(id);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as SandboxStartupStatus;
  } catch {
    return null;
  }
}

export function cleanupSandboxStartupStatus() {
  ensureDir();
  const t = now();
  for (const file of fs.readdirSync(STATUS_DIR)) {
    if (!file.endsWith(".json")) continue;
    const fullPath = path.join(STATUS_DIR, file);
    try {
      const raw = fs.readFileSync(fullPath, "utf8");
      const status = JSON.parse(raw) as SandboxStartupStatus;
      if (!status.expiresAt || status.expiresAt <= t) {
        fs.unlinkSync(fullPath);
      }
    } catch {
      // Ignore malformed/in-flight files; do not delete to avoid races.
    }
  }
}

export function initSandboxStartupStatus(id: string) {
  cleanupSandboxStartupStatus();
  const status: SandboxStartupStatus = {
    id,
    phase: "creating",
    logs: ["Creating sandbox environment..."],
    error: null,
    sandboxId: null,
    url: null,
    updatedAt: now(),
    expiresAt: now() + STATUS_TTL_MS,
  };
  writeStatus(status);
  return status;
}

export function getSandboxStartupStatus(id: string) {
  cleanupSandboxStartupStatus();
  return readStatus(id);
}

export function setSandboxStartupPhase(id: string, phase: StartupPhase) {
  const existing = getSandboxStartupStatus(id) ?? initSandboxStartupStatus(id);
  writeStatus({
    ...existing,
    phase,
    updatedAt: now(),
    expiresAt: now() + STATUS_TTL_MS,
  });
}

export function appendSandboxStartupLog(id: string, line: string) {
  const text = line?.trim();
  if (!text) return;

  const existing = getSandboxStartupStatus(id) ?? initSandboxStartupStatus(id);
  const nextLogs = [...existing.logs, text];
  const logs =
    nextLogs.length > MAX_LOG_LINES
      ? nextLogs.slice(nextLogs.length - MAX_LOG_LINES)
      : nextLogs;

  writeStatus({
    ...existing,
    logs,
    updatedAt: now(),
    expiresAt: now() + STATUS_TTL_MS,
  });
}

export function completeSandboxStartupStatus(
  id: string,
  payload: { sandboxId: string; url: string }
) {
  const existing = getSandboxStartupStatus(id) ?? initSandboxStartupStatus(id);
  writeStatus({
    ...existing,
    phase: "ready",
    sandboxId: payload.sandboxId,
    url: payload.url,
    error: null,
    updatedAt: now(),
    expiresAt: now() + STATUS_TTL_MS,
  });
}

export function failSandboxStartupStatus(id: string, error: string) {
  const existing = getSandboxStartupStatus(id) ?? initSandboxStartupStatus(id);
  writeStatus({
    ...existing,
    phase: "error",
    error,
    updatedAt: now(),
    expiresAt: now() + STATUS_TTL_MS,
  });
}
