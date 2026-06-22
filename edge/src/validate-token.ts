export type EdgeRole =
  | "viewer"
  | "creator"
  | "brand_owner"
  | "approver"
  | "tenant_admin";

export interface SessionToken {
  userId: string;
  tenantId: string;
  role: EdgeRole;
  expiresAt?: number;
}

export class TokenValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenValidationError";
  }
}

function parseBearer(authorization: string | undefined): string {
  if (!authorization) {
    throw new TokenValidationError("Missing Authorization header");
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match) {
    throw new TokenValidationError("Authorization must use Bearer scheme");
  }
  return match[1];
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function resolveAuthMode(): "oidc" {
  const mode = process.env.EDGE_AUTH_MODE;
  if (isProduction() && mode !== "oidc") {
    throw new TokenValidationError("Authentication misconfigured for production");
  }
  if (mode !== "oidc") {
    throw new TokenValidationError("Authentication misconfigured");
  }
  return "oidc";
}

export async function validateSessionToken(
  authorization: string | undefined,
): Promise<SessionToken> {
  resolveAuthMode();
  const raw = parseBearer(authorization);

  if (raw.startsWith("dev:") || raw.startsWith("svc:")) {
    throw new TokenValidationError("Unsigned dev/service tokens are rejected");
  }

  const { verifyPlatformAccessToken } = await import("./jwt-verifier.js");
  const verified = await verifyPlatformAccessToken(raw);
  return {
    userId: verified.userId,
    tenantId: verified.tenantId,
    role: verified.role,
    expiresAt: verified.expiresAt,
  };
}
