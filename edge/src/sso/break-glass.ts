import * as jose from "jose";
import { TokenValidationError } from "../validate-token.js";

export interface BreakGlassClaims {
  userId: string;
  tenantId: string;
}

let breakGlassJwksOverride: jose.JWTVerifyGetKey | undefined;

export function setBreakGlassJwksForTests(
  jwks: jose.JWTVerifyGetKey | undefined,
): void {
  breakGlassJwksOverride = jwks;
}

async function resolveBreakGlassJwks(): Promise<jose.JWTVerifyGetKey> {
  if (breakGlassJwksOverride) {
    return breakGlassJwksOverride;
  }
  const jwksUri = process.env.EDGE_BREAK_GLASS_JWKS_URI;
  if (!jwksUri) {
    throw new TokenValidationError("Break-glass JWKS is not configured");
  }
  return jose.createRemoteJWKSet(new URL(jwksUri));
}

export async function verifyBreakGlassToken(
  authorization: string | undefined,
): Promise<BreakGlassClaims> {
  if (!authorization) {
    throw new TokenValidationError("Missing Authorization header");
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match) {
    throw new TokenValidationError("Authorization must use Bearer scheme");
  }

  const issuer = process.env.EDGE_BREAK_GLASS_ISSUER;
  const audience = process.env.EDGE_BREAK_GLASS_AUDIENCE;
  if (!issuer || !audience) {
    throw new TokenValidationError("Break-glass issuer/audience not configured");
  }

  const jwks = await resolveBreakGlassJwks();
  let payload: jose.JWTPayload;
  try {
    const verified = await jose.jwtVerify(match[1], jwks, {
      issuer,
      audience,
      algorithms: ["RS256", "ES256"],
    });
    payload = verified.payload;
  } catch {
    throw new TokenValidationError("Break-glass JWT verification failed");
  }

  if (payload.break_glass !== true) {
    throw new TokenValidationError("Break-glass claim missing");
  }

  const sub = payload.sub;
  const tenantId = payload.tenant_id;
  if (typeof sub !== "string" || sub.length === 0) {
    throw new TokenValidationError("Break-glass JWT missing sub");
  }
  if (typeof tenantId !== "string" || tenantId.length === 0) {
    throw new TokenValidationError("Break-glass JWT missing tenant_id");
  }

  return { userId: sub, tenantId };
}

export async function signTestBreakGlassToken(
  privateKey: CryptoKey,
  claims: { sub: string; tenant_id: string },
  options: { issuer: string; audience: string },
): Promise<string> {
  return new jose.SignJWT({ break_glass: true, tenant_id: claims.tenant_id })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(options.issuer)
    .setAudience(options.audience)
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}
