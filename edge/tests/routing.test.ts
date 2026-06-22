import * as jose from "jose";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { assertMcpEgressAllowed } from "../src/egress-policy.js";
import { normalizeRequestPath } from "../src/path-normalize.js";
import {
  exportPublicJwks,
  setJwksForTests,
  signTestAccessToken,
} from "../src/jwt-verifier.js";
import { resetRateLimitsForTests } from "../src/rate-limit.js";
import { createEdgeApp } from "../src/server.js";
import { routeRequest } from "../src/tenant-router.js";
import { validateSessionToken } from "../src/validate-token.js";

const ISSUER = "https://auth.deptcanvas.test";
const AUDIENCE = "dept-canvas-edge";

let privateKey: CryptoKey;
let publicJwks: jose.JWTVerifyGetKey;

async function bearerFor(
  claims: Record<string, string>,
  options?: { expired?: boolean },
): Promise<string> {
  const token = await signTestAccessToken(privateKey, claims, {
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresInSec: options?.expired ? -120 : 300,
  });
  return `Bearer ${token}`;
}

describe("routing.test.ts adversarial", () => {
  beforeAll(async () => {
    const pair = await jose.generateKeyPair("RS256");
    privateKey = pair.privateKey;
    const jwks = await exportPublicJwks(pair.publicKey);
    publicJwks = jose.createLocalJWKSet(jwks);
    setJwksForTests(publicJwks);
    process.env.EDGE_AUTH_MODE = "oidc";
    process.env.EDGE_JWT_ISSUER = ISSUER;
    process.env.EDGE_JWT_AUDIENCE = AUDIENCE;
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    resetRateLimitsForTests();
    delete process.env.TENANT_SILO_MAP;
    delete process.env.EDGE_RATE_LIMIT_RPM;
  });

  it("rejects_forged_unsigned_token", async () => {
    const forged = Buffer.from(
      JSON.stringify({
        sub: "attacker",
        tenant_id: "tenant-b",
        role: "tenant_admin",
      }),
      "utf8",
    ).toString("base64url");

    await expect(
      validateSessionToken(`Bearer ${forged}`),
    ).rejects.toThrow(/rejected|failed|misconfigured/i);
  });

  it("rejects_expired_jwt", async () => {
    const auth = await bearerFor(
      { sub: "user-1", tenant_id: "tenant-a", role: "creator" },
      { expired: true },
    );
    await expect(validateSessionToken(auth)).rejects.toThrow(/failed|invalid/i);
  });

  it("rejects_cross_tenant_header_spoof", async () => {
    const app = createEdgeApp();
    const auth = await bearerFor({
      sub: "user-1",
      tenant_id: "tenant-a",
      role: "creator",
    });
    const res = await request(app)
      .get("/api/mcp")
      .set("Authorization", auth)
      .set("x-tenant-id", "tenant-b");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("cross_tenant_denied");
  });

  it("routes_verified_token_to_own_tenant_silo", async () => {
    process.env.TENANT_SILO_MAP =
      "tenant-a|http://mcp.internal/tenant-a|europe-west1";
    const auth = await bearerFor({
      sub: "user-1",
      tenant_id: "tenant-a",
      role: "creator",
    });

    const app = createEdgeApp();
    const res = await request(app).get("/api/mcp").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe("tenant-a");
    expect(res.body.upstreamUrl).toContain("tenant-a");
  });

  it("denies_global_storage_googleapis_egress", () => {
    expect(() =>
      assertMcpEgressAllowed("tenant-a", "storage.googleapis.com"),
    ).toThrow(/not allowed/i);
  });

  it("allows_tenant_scoped_bucket_egress_only", () => {
    expect(() =>
      assertMcpEgressAllowed(
        "tenant-a",
        "dept-canvas-tenant-a-assets.storage.googleapis.com",
      ),
    ).not.toThrow();
    expect(() =>
      assertMcpEgressAllowed(
        "tenant-a",
        "dept-canvas-tenant-b-assets.storage.googleapis.com",
      ),
    ).toThrow(/not allowed/i);
  });

  it("blocks_path_traversal", () => {
    expect(() => normalizeRequestPath("/api/../tenant-b/mcp")).toThrow(
      /traversal/i,
    );
    expect(() =>
      routeRequest(
        { userId: "u", tenantId: "tenant-a", role: "creator" },
        "/../secrets",
      ),
    ).toThrow(/traversal/i);
  });

  it("rate_limit_trips_without_leaking_internals", async () => {
    process.env.EDGE_RATE_LIMIT_RPM = "2";
    const app = createEdgeApp();
    const auth = await bearerFor({
      sub: "user-1",
      tenant_id: "tenant-a",
      role: "viewer",
    });

    await request(app).get("/api/mcp").set("Authorization", auth);
    await request(app).get("/api/mcp").set("Authorization", auth);
    const third = await request(app).get("/api/mcp").set("Authorization", auth);
    expect(third.status).toBe(429);
    expect(third.body.error).toBe("rate_limit_exceeded");
  });
});
