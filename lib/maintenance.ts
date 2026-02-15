import type { CompatibleUser } from "@/app/contexts/AuthContext";

export interface MaintenanceStatus {
  enabled: boolean;
  message?: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: Date;
}

export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  try {
    const response = await fetch("/api/maintenance", { cache: "no-store" });
    if (!response.ok) {
      return { enabled: false };
    }
    const data = await response.json();
    return {
      enabled: Boolean(data.enabled),
      message: typeof data.message === "string" ? data.message : undefined,
      lastUpdatedBy:
        typeof data.lastUpdatedBy === "string" ? data.lastUpdatedBy : undefined,
      lastUpdatedAt: data.lastUpdatedAt ? new Date(data.lastUpdatedAt) : undefined,
    };
  } catch (error) {
    console.error("Error getting maintenance status:", error);
    return { enabled: false };
  }
}

export async function setMaintenanceStatus(
  enabled: boolean,
  adminEmail: string,
  message?: string,
): Promise<void> {
  const response = await fetch("/api/maintenance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled, adminEmail, message }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Failed to update maintenance mode");
  }
}

export async function isUserAdmin(
  user: CompatibleUser | null,
): Promise<boolean> {
  if (!user) return false;
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  return Boolean(adminEmail && user.email === adminEmail);
}
