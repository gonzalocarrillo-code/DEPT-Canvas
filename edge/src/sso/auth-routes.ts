import type { Request, Response } from "express";
import * as jose from "jose";
import { writeBreakGlassAudit } from "../audit/break-glass-audit.js";
import type { SessionToken } from "../validate-token.js";
import { TokenValidationError } from "../validate-token.js";
import { verifyBreakGlassToken } from "./break-glass.js";
import { handleOidcCallback } from "./oidc.js";
import { verifySamlResponse } from "./saml.js";

export interface AuthExchangeResult {
  accessToken: string;
  session: SessionToken;
}

async function resolveSessionPrivateKey(): Promise<CryptoKey> {
  const pem = process.env.EDGE_SESSION_SIGNING_KEY_PEM;
  if (!pem) {
    throw new TokenValidationError("Session signing key is not configured");
  }
  const der = Buffer.from(
    pem
      .replace(/-----BEGIN PRIVATE KEY-----/g, "")
      .replace(/-----END PRIVATE KEY-----/g, "")
      .replace(/\s+/g, ""),
    "base64",
  );
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function issueSessionJwt(session: SessionToken): Promise<string> {
  const issuer = process.env.EDGE_JWT_ISSUER;
  const audience = process.env.EDGE_JWT_AUDIENCE;
  if (!issuer || !audience) {
    throw new TokenValidationError("JWT issuer/audience not configured");
  }
  const privateKey = await resolveSessionPrivateKey();
  return new jose.SignJWT({
    tenant_id: session.tenantId,
    role: session.role,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

export async function handleSamlAcsRequest(
  body: Record<string, unknown>,
): Promise<AuthExchangeResult> {
  const samlResponse = String(body.SAMLResponse ?? "");
  const profile = verifySamlResponse(samlResponse);
  const session: SessionToken = {
    userId: profile.userId,
    tenantId: profile.tenantId,
    role: profile.role,
  };
  const accessToken = await issueSessionJwt(session);
  return { accessToken, session };
}

export async function handleOidcCallbackRequest(
  body: Record<string, unknown>,
): Promise<AuthExchangeResult> {
  const session = await handleOidcCallback({
    id_token: String(body.id_token ?? ""),
  });
  const accessToken = await issueSessionJwt(session);
  return { accessToken, session };
}

export async function handleBreakGlassRequest(
  req: Request,
): Promise<AuthExchangeResult> {
  const claims = await verifyBreakGlassToken(req.header("authorization"));
  const reason = String(req.body?.reason ?? "");
  if (!reason || reason.length < 8) {
    throw new TokenValidationError("Break-glass reason is required");
  }

  writeBreakGlassAudit({
    timestamp: new Date().toISOString(),
    userId: claims.userId,
    tenantId: claims.tenantId,
    reason,
    actorIp: req.ip,
  });

  const session: SessionToken = {
    userId: claims.userId,
    tenantId: claims.tenantId,
    role: "tenant_admin",
  };
  const accessToken = await issueSessionJwt(session);
  return { accessToken, session };
}

export function registerAuthRoutes(
  app: import("express").Express,
  safeError: (res: Response, status: number, code: string) => void,
): void {
  app.post("/auth/saml/acs", async (req, res) => {
    try {
      const result = await handleSamlAcsRequest(req.body ?? {});
      res.json({ access_token: result.accessToken, session: result.session });
    } catch (error) {
      if (error instanceof TokenValidationError) {
        safeError(res, 401, "saml_verification_failed");
        return;
      }
      safeError(res, 500, "internal_error");
    }
  });

  app.post("/auth/oidc/callback", async (req, res) => {
    try {
      const result = await handleOidcCallbackRequest(req.body ?? {});
      res.json({ access_token: result.accessToken, session: result.session });
    } catch (error) {
      if (error instanceof TokenValidationError) {
        safeError(res, 401, "oidc_verification_failed");
        return;
      }
      safeError(res, 500, "internal_error");
    }
  });

  app.post("/auth/break-glass", async (req, res) => {
    try {
      const result = await handleBreakGlassRequest(req);
      res.json({
        access_token: result.accessToken,
        session: result.session,
        audited: true,
      });
    } catch (error) {
      if (error instanceof TokenValidationError) {
        safeError(res, 401, "break_glass_denied");
        return;
      }
      safeError(res, 500, "internal_error");
    }
  });
}

export function isPublicAuthPath(path: string): boolean {
  return (
    path === "/health" ||
    path === "/auth/saml/acs" ||
    path === "/auth/oidc/callback" ||
    path === "/auth/break-glass" ||
    path.startsWith("/scim/v2")
  );
}
