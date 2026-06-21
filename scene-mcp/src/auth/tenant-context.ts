import type { IncomingMessage } from "node:http";
import type { Request } from "express";
import { verifyToken } from "./verify-token.js";
import type { Role } from "./rbac.js";

export interface CallerContext {
  tenantId: string;
  userId: string;
  role: Role;
}

type RequestLike = IncomingMessage | Request | { headers: IncomingMessage["headers"] };

function authorizationHeader(req: RequestLike): string | undefined {
  const raw = req.headers.authorization ?? req.headers.Authorization;
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return raw;
}

export async function contextFromRequest(req: RequestLike): Promise<CallerContext> {
  const verified = verifyToken(authorizationHeader(req));
  return {
    tenantId: verified.tenantId,
    userId: verified.userId,
    role: verified.role,
  };
}

/**
 * Resolves the authoritative tenant for a tool call. The scoped token always
 * wins — any tenant_id supplied in tool arguments is ignored.
 */
export function resolveTenantId(
  ctx: CallerContext,
  _toolArgs?: Record<string, unknown>,
): string {
  return ctx.tenantId;
}

export function assertSameTenant(
  ctx: CallerContext,
  requestedTenantId: string,
): void {
  if (requestedTenantId !== ctx.tenantId) {
    throw new TenantAccessDeniedError(ctx.tenantId, requestedTenantId);
  }
}

export class TenantAccessDeniedError extends Error {
  readonly tokenTenantId: string;
  readonly requestedTenantId: string;

  constructor(tokenTenantId: string, requestedTenantId: string) {
    super(
      `Access denied: token tenant '${tokenTenantId}' cannot access tenant '${requestedTenantId}'`,
    );
    this.name = "TenantAccessDeniedError";
    this.tokenTenantId = tokenTenantId;
    this.requestedTenantId = requestedTenantId;
  }
}
