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

function resolveAuthMode(): "oidc" | "dev" {
  const mode = process.env.EDGE_AUTH_MODE;
  if (isProduction()) {
    // Production is fail-closed: only signed OIDC sessions are accepted.
    if (mode !== "oidc") {
      throw new TokenValidationError("Authentication misconfigured for production");
    }
    return "oidc";
  }
  if (mode === "dev") {
    return "dev";
  }
  if (mode !== "oidc") {
    throw new TokenValidationError("Authentication misconfigured");
  }
  return "oidc";
}

const ROLES: readonly EdgeRole[] = [
  "viewer",
  "creator",
  "brand_owner",
  "approver",
  "tenant_admin",
];

// Local-only: accept the same `dev:<base64url(json)>` token scheme scene-mcp uses,
// so a single VITE_DEV_TOKEN works across the stack. Never enabled in production.
function parseDevToken(raw: string): SessionToken {
  if (!raw.startsWith("dev:")) {
    throw new TokenValidationError("dev auth mode expects a dev: token");
  }
  let claims: { sub?: string; tenant_id?: string; role?: string };
  try {
    claims = JSON.parse(Buffer.from(raw.slice(4), "base64url").toString("utf8"));
  } catch {
    throw new TokenValidationError("Malformed dev token");
  }
  if (!claims.tenant_id) {
    throw new TokenValidationError("dev token missing tenant_id");
  }
  const role = (ROLES as string[]).includes(claims.role ?? "")
    ? (claims.role as EdgeRole)
    : "creator";
  return { userId: claims.sub ?? "dev-user", tenantId: claims.tenant_id, role };
}

export async function validateSessionToken(
  authorization: string | undefined,
): Promise<SessionToken> {
  const mode = resolveAuthMode();
  const raw = parseBearer(authorization);

  if (mode === "dev") {
    return parseDevToken(raw);
  }

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
