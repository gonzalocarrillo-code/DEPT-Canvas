import * as jose from "jose";
import type { EdgeRole } from "./validate-token.js";
import { TokenValidationError } from "./validate-token.js";

export interface JwtVerifierConfig {
  issuer: string;
  audience: string;
  jwksUri: string;
}

export interface VerifiedAccessToken {
  userId: string;
  tenantId: string;
  role: EdgeRole;
  expiresAt?: number;
}

function claimString(payload: jose.JWTPayload, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new TokenValidationError(`JWT missing required claim: ${key}`);
  }
  return value;
}

function claimRole(payload: jose.JWTPayload): EdgeRole {
  const role = claimString(payload, process.env.JWT_ROLE_CLAIM ?? "role");
  const valid: EdgeRole[] = [
    "viewer",
    "creator",
    "brand_owner",
    "approver",
    "tenant_admin",
  ];
  if (!valid.includes(role as EdgeRole)) {
    throw new TokenValidationError("JWT role claim is invalid");
  }
  return role as EdgeRole;
}

async function verifyWithConfig(
  token: string,
  config: JwtVerifierConfig,
): Promise<VerifiedAccessToken> {
  const jwks = jose.createRemoteJWKSet(new URL(config.jwksUri));
  let payload: jose.JWTPayload;
  try {
    const verified = await jose.jwtVerify(token, jwks, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ["RS256", "ES256"],
    });
    payload = verified.payload;
  } catch {
    throw new TokenValidationError("JWT signature or claims verification failed");
  }

  const tenantClaim = process.env.JWT_TENANT_CLAIM ?? "tenant_id";
  return {
    userId: claimString(payload, "sub"),
    tenantId: claimString(payload, tenantClaim),
    role: claimRole(payload),
    expiresAt: payload.exp ? payload.exp * 1000 : undefined,
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new TokenValidationError(`${name} is not configured`);
  }
  return value;
}

/** Platform-issued session tokens (edge API, SCIM). */
export async function verifyPlatformAccessToken(
  token: string,
): Promise<VerifiedAccessToken> {
  return verifyWithConfig(token, {
    issuer: requireEnv("EDGE_JWT_ISSUER"),
    audience: requireEnv("EDGE_JWT_AUDIENCE"),
    jwksUri: requireEnv("EDGE_JWKS_URI"),
  });
}

/** IdP-issued OIDC id_tokens at login callback. */
export async function verifyIdpAccessToken(
  token: string,
): Promise<VerifiedAccessToken> {
  return verifyWithConfig(token, {
    issuer: requireEnv("EDGE_IDP_JWT_ISSUER"),
    audience: requireEnv("EDGE_IDP_JWT_AUDIENCE"),
    jwksUri: requireEnv("EDGE_IDP_JWKS_URI"),
  });
}

/** @deprecated Use verifyPlatformAccessToken */
export async function verifyJwtAccessToken(
  token: string,
): Promise<VerifiedAccessToken> {
  return verifyPlatformAccessToken(token);
}
