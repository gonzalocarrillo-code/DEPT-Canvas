import { EgressDeniedError } from "./errors.js";

const OPENAI_HOST = "api.openai.com";

export function tenantBucketHost(tenantId: string): string {
  return `dept-canvas-${tenantId}-assets.storage.googleapis.com`;
}

export function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? host;
}

export function isEgressAllowed(tenantId: string, host: string): boolean {
  const normalized = normalizeHost(host);
  if (normalized === OPENAI_HOST) {
    return true;
  }
  if (normalized === tenantBucketHost(tenantId)) {
    return true;
  }
  if (normalized === "storage.googleapis.com") {
    return false;
  }
  return false;
}

export function assertMcpEgressAllowed(tenantId: string, host: string): void {
  if (!isEgressAllowed(tenantId, host)) {
    throw new EgressDeniedError(normalizeHost(host));
  }
}
