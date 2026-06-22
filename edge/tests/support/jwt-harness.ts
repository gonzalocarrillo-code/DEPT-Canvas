import { createServer, type Server } from "node:http";
import * as jose from "jose";

export interface JwtTrustDomain {
  issuer: string;
  audience: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  jwksUri: string;
}

let platformDomain: JwtTrustDomain | undefined;
let idpDomain: JwtTrustDomain | undefined;
let breakGlassDomain: JwtTrustDomain | undefined;
let platformServer: Server | undefined;
let idpServer: Server | undefined;
let breakGlassServer: Server | undefined;

async function startJwksServer(
  publicKey: CryptoKey,
): Promise<{ uri: string; server: Server }> {
  const jwk = await jose.exportJWK(publicKey);
  const body = JSON.stringify({
    keys: [{ ...jwk, kid: "test-key", use: "sig", alg: "RS256" }],
  });

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (req.url === "/.well-known/jwks.json") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(body);
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("JWKS test server failed to bind"));
        return;
      }
      resolve({
        uri: `http://127.0.0.1:${address.port}/.well-known/jwks.json`,
        server,
      });
    });
  });
}

export async function setupPlatformJwtEnv(
  issuer = "https://platform.deptcanvas.test",
  audience = "dept-canvas-edge",
): Promise<JwtTrustDomain> {
  if (platformDomain) {
    return platformDomain;
  }
  const pair = await jose.generateKeyPair("RS256", { extractable: true });
  const { uri, server } = await startJwksServer(pair.publicKey);
  platformServer = server;
  platformDomain = {
    issuer,
    audience,
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    jwksUri: uri,
  };
  process.env.EDGE_JWT_ISSUER = issuer;
  process.env.EDGE_JWT_AUDIENCE = audience;
  process.env.EDGE_JWKS_URI = uri;
  const pem = await jose.exportPKCS8(pair.privateKey);
  process.env.EDGE_SESSION_SIGNING_KEY_PEM = pem;
  return platformDomain;
}

export async function setupIdpJwtEnv(
  issuer = "https://idp.deptcanvas.test",
  audience = "dept-canvas-idp",
): Promise<JwtTrustDomain> {
  if (idpDomain) {
    return idpDomain;
  }
  const pair = await jose.generateKeyPair("RS256", { extractable: true });
  const { uri, server } = await startJwksServer(pair.publicKey);
  idpServer = server;
  idpDomain = {
    issuer,
    audience,
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    jwksUri: uri,
  };
  process.env.EDGE_IDP_JWT_ISSUER = issuer;
  process.env.EDGE_IDP_JWT_AUDIENCE = audience;
  process.env.EDGE_IDP_JWKS_URI = uri;
  return idpDomain;
}

export async function setupBreakGlassJwtEnv(
  issuer = "https://break-glass.deptcanvas.test",
  audience = "dept-canvas-break-glass",
): Promise<JwtTrustDomain> {
  if (breakGlassDomain) {
    return breakGlassDomain;
  }
  const pair = await jose.generateKeyPair("RS256", { extractable: true });
  const { uri, server } = await startJwksServer(pair.publicKey);
  breakGlassServer = server;
  breakGlassDomain = {
    issuer,
    audience,
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    jwksUri: uri,
  };
  process.env.EDGE_BREAK_GLASS_ISSUER = issuer;
  process.env.EDGE_BREAK_GLASS_AUDIENCE = audience;
  process.env.EDGE_BREAK_GLASS_JWKS_URI = uri;
  return breakGlassDomain;
}

export async function mintPlatformSessionJwt(
  claims: Record<string, string>,
  options?: { expiresInSec?: number },
): Promise<string> {
  const domain = platformDomain ?? (await setupPlatformJwtEnv());
  const builder = new jose.SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(domain.issuer)
    .setAudience(domain.audience)
    .setSubject(claims.sub ?? "test-user")
    .setIssuedAt();

  if (options?.expiresInSec !== undefined && options.expiresInSec <= 0) {
    builder.setExpirationTime(Math.floor(Date.now() / 1000) - 60);
  } else {
    builder.setExpirationTime(`${options?.expiresInSec ?? 300}s`);
  }

  return builder.sign(domain.privateKey);
}

export async function mintIdpIdToken(
  claims: Record<string, string>,
  options?: { expiresInSec?: number },
): Promise<string> {
  const domain = idpDomain ?? (await setupIdpJwtEnv());
  const builder = new jose.SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(domain.issuer)
    .setAudience(domain.audience)
    .setSubject(claims.sub ?? "idp-user")
    .setIssuedAt();

  if (options?.expiresInSec !== undefined && options.expiresInSec <= 0) {
    builder.setExpirationTime(Math.floor(Date.now() / 1000) - 60);
  } else {
    builder.setExpirationTime(`${options?.expiresInSec ?? 300}s`);
  }

  return builder.sign(domain.privateKey);
}

export async function mintBreakGlassToken(claims: {
  sub: string;
  tenant_id: string;
}): Promise<string> {
  const domain = breakGlassDomain ?? (await setupBreakGlassJwtEnv());
  return new jose.SignJWT({ break_glass: true, tenant_id: claims.tenant_id })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(domain.issuer)
    .setAudience(domain.audience)
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(domain.privateKey);
}

export async function shutdownJwtHarness(): Promise<void> {
  await Promise.all([
    platformServer
      ? new Promise<void>((resolve) => platformServer!.close(() => resolve()))
      : Promise.resolve(),
    idpServer
      ? new Promise<void>((resolve) => idpServer!.close(() => resolve()))
      : Promise.resolve(),
    breakGlassServer
      ? new Promise<void>((resolve) => breakGlassServer!.close(() => resolve()))
      : Promise.resolve(),
  ]);
  platformServer = undefined;
  idpServer = undefined;
  breakGlassServer = undefined;
  platformDomain = undefined;
  idpDomain = undefined;
  breakGlassDomain = undefined;
}
