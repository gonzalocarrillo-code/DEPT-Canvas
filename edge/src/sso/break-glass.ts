import * as jose from "jose";
import { TokenValidationError } from "../validate-token.js";

export interface BreakGlassClaims {
  userId: string;
  tenantId: string;
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
  const jwksUri = process.env.EDGE_BREAK_GLASS_JWKS_URI;
  if (!issuer || !audience || !jwksUri) {
    throw new TokenValidationError("Break-glass issuer/audience not configured");
  }

  const jwks = jose.createRemoteJWKSet(new URL(jwksUri));
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
