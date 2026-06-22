import * as jose from "jose";
import type { EdgeRole } from "./validate-token.js";
import { TokenValidationError } from "./validate-token.js";

export interface JwtVerifierConfig {
  issuer: string;
  audience: string;
}

let jwksOverride: jose.JWTVerifyGetKey | undefined;

export function setJwksForTests(jwks: jose.JWTVerifyGetKey | undefined): void {
  jwksOverride = jwks;
}

async function resolveJwks(): Promise<jose.JWTVerifyGetKey> {
  if (jwksOverride) {
    return jwksOverride;
  }
  const jwksUri = process.env.EDGE_JWKS_URI;
  if (!jwksUri) {
    throw new TokenValidationError("EDGE_JWKS_URI is not configured");
  }
  return jose.createRemoteJWKSet(new URL(jwksUri));
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

export async function verifyJwtAccessToken(
  token: string,
  config?: Partial<JwtVerifierConfig>,
): Promise<{ userId: string; tenantId: string; role: EdgeRole; expiresAt?: number }> {
  const issuer = config?.issuer ?? process.env.EDGE_JWT_ISSUER;
  const audience = config?.audience ?? process.env.EDGE_JWT_AUDIENCE;
  if (!issuer || !audience) {
    throw new TokenValidationError("JWT issuer/audience not configured");
  }

  const jwks = await resolveJwks();
  let payload: jose.JWTPayload;
  try {
    const verified = await jose.jwtVerify(token, jwks, {
      issuer,
      audience,
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

export async function exportPublicJwks(
  publicKey: CryptoKey,
): Promise<jose.JSONWebKeySet> {
  const jwk = await jose.exportJWK(publicKey);
  return { keys: [{ ...jwk, kid: "test-key", use: "sig", alg: "RS256" }] };
}

export async function signTestAccessToken(
  privateKey: CryptoKey,
  claims: Record<string, string>,
  options: { issuer: string; audience: string; expiresInSec?: number },
): Promise<string> {
  const builder = new jose.SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(options.issuer)
    .setAudience(options.audience)
    .setSubject(claims.sub ?? "test-user")
    .setIssuedAt();

  if (options.expiresInSec !== undefined && options.expiresInSec <= 0) {
    builder.setExpirationTime(Math.floor(Date.now() / 1000) - 60);
  } else {
    builder.setExpirationTime(`${options.expiresInSec ?? 300}s`);
  }

  return builder.sign(privateKey);
}
