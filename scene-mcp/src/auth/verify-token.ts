import type { Role } from "./rbac.js";

const VALID_ROLES: readonly Role[] = [
  "viewer",
  "creator",
  "brand_owner",
  "approver",
  "tenant_admin",
];

function isRole(value: string): value is Role {
  return (VALID_ROLES as readonly string[]).includes(value);
}

export interface VerifiedToken {
  userId: string;
  tenantId: string;
  role: Role;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export interface DevTokenPayload {
  sub: string;
  tenant_id: string;
  role: Role;
  exp?: number;
}

const DEV_PREFIX = "dev:";

function parseBearerHeader(authorization: string | undefined): string {
  if (!authorization) {
    throw new AuthError("Missing Authorization header");
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match) {
    throw new AuthError("Authorization header must use Bearer scheme");
  }
  return match[1];
}

function decodeDevToken(token: string): DevTokenPayload {
  if (!token.startsWith(DEV_PREFIX)) {
    throw new AuthError("Invalid dev token prefix");
  }
  const encoded = token.slice(DEV_PREFIX.length);
  let json: string;
  try {
    json = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    throw new AuthError("Dev token payload is not valid base64url");
  }
  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    throw new AuthError("Dev token payload is not valid JSON");
  }
  if (!payload || typeof payload !== "object") {
    throw new AuthError("Dev token payload must be an object");
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.sub !== "string" || record.sub.length === 0) {
    throw new AuthError("Dev token missing sub");
  }
  if (typeof record.tenant_id !== "string" || record.tenant_id.length === 0) {
    throw new AuthError("Dev token missing tenant_id");
  }
  if (typeof record.role !== "string" || !isRole(record.role)) {
    throw new AuthError("Dev token missing or invalid role");
  }
  if (typeof record.exp === "number" && record.exp * 1000 < Date.now()) {
    throw new AuthError("Dev token expired");
  }
  return {
    sub: record.sub,
    tenant_id: record.tenant_id,
    role: record.role,
    exp: typeof record.exp === "number" ? record.exp : undefined,
  };
}

export function createDevToken(payload: DevTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${DEV_PREFIX}${encoded}`;
}

export function verifyToken(authorization: string | undefined): VerifiedToken {
  const raw = parseBearerHeader(authorization);
  const mode = process.env.SCENE_MCP_AUTH_MODE ?? "dev";

  if (mode === "dev") {
    const payload = decodeDevToken(raw);
    return {
      userId: payload.sub,
      tenantId: payload.tenant_id,
      role: payload.role,
    };
  }

  throw new AuthError(`OIDC token verification is not configured (mode=${mode})`);
}
