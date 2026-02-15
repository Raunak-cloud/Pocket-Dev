export function getProjectAuthTenantSlug(projectId: string): string {
  const normalized = projectId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const compact = normalized.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `pd-${compact}`.slice(0, 63);
}

