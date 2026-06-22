import type { SessionToken } from "./validate-token.js";
import { TenantRoutingError } from "./errors.js";
import { normalizeRequestPath } from "./path-normalize.js";
import { tenantBucketHost } from "./egress-policy.js";

export interface TenantSilo {
  tenantId: string;
  region: string;
  mcpInternalUrl: string;
  rendererQueue: string;
  bucketHost: string;
}

const DEFAULT_REGION = process.env.DEFAULT_TENANT_REGION ?? "europe-west1";

function siloRegistry(): Map<string, TenantSilo> {
  const registry = new Map<string, TenantSilo>();
  const tenants = (process.env.TENANT_SILO_MAP ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of tenants) {
    const [tenantId, mcpUrl, region] = entry.split("|");
    if (!tenantId || !mcpUrl) {
      continue;
    }
    registry.set(tenantId, {
      tenantId,
      region: region ?? DEFAULT_REGION,
      mcpInternalUrl: mcpUrl,
      rendererQueue: `render-${tenantId}`,
      bucketHost: tenantBucketHost(tenantId),
    });
  }
  return registry;
}

export function resolveTenantSilo(tenantId: string): TenantSilo {
  const configured = siloRegistry().get(tenantId);
  if (configured) {
    return configured;
  }

  const baseMcp =
    process.env.MCP_INTERNAL_BASE_URL ?? "http://scene-mcp.internal:3100";
  return {
    tenantId,
    region: DEFAULT_REGION,
    mcpInternalUrl: `${baseMcp}/tenants/${tenantId}`,
    rendererQueue: `render-${tenantId}`,
    bucketHost: tenantBucketHost(tenantId),
  };
}

export interface RoutedRequest {
  tenantId: string;
  upstreamUrl: string;
  region: string;
  rendererQueue: string;
  bucketHost: string;
}

export function routeRequest(
  session: SessionToken,
  rawPath: string,
  requestedTenantId?: string,
): RoutedRequest {
  const authoritativeTenant = session.tenantId;
  if (requestedTenantId && requestedTenantId !== authoritativeTenant) {
    throw new TenantRoutingError("Cross-tenant routing denied");
  }

  const path = normalizeRequestPath(rawPath);
  const silo = resolveTenantSilo(authoritativeTenant);
  const upstreamUrl = `${silo.mcpInternalUrl}${path}`;

  return {
    tenantId: authoritativeTenant,
    upstreamUrl,
    region: silo.region,
    rendererQueue: silo.rendererQueue,
    bucketHost: silo.bucketHost,
  };
}
