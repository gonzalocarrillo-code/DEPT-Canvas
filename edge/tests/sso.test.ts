import * as jose from "jose";
import selfsigned from "selfsigned";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  clearBreakGlassAuditForTests,
  getBreakGlassAuditRecordsForTests,
} from "../src/audit/break-glass-audit.js";
import {
  exportPublicJwks,
  setIdpJwksForTests,
  setJwksForTests,
  signTestAccessToken,
} from "../src/jwt-verifier.js";
import { createEdgeApp } from "../src/server.js";
import { configureSessionSigningForTests } from "../src/sso/auth-routes.js";
import {
  setBreakGlassJwksForTests,
  signTestBreakGlassToken,
} from "../src/sso/break-glass.js";
import { createSignedTestSamlResponse, verifySamlResponse } from "../src/sso/saml.js";
import { clearScimUsersForTests } from "../src/scim/provisioning.js";

const ISSUER = "https://auth.deptcanvas.test";
const AUDIENCE = "dept-canvas-edge";
const BG_ISSUER = "https://break-glass.deptcanvas.test";
const BG_AUDIENCE = "dept-canvas-break-glass";

let sessionKeys: CryptoKeyPair;
let idpKeys: CryptoKeyPair;
let breakGlassKeys: CryptoKeyPair;
let idpCertPem: string;
let idpPrivateKeyPem: string;

describe("sso.test.ts adversarial", () => {
  beforeAll(async () => {
    sessionKeys = await jose.generateKeyPair("RS256");
    idpKeys = await jose.generateKeyPair("RS256");
    breakGlassKeys = await jose.generateKeyPair("RS256");

    const idpAttrs = selfsigned.generate([], { days: 1, keySize: 2048 });
    idpCertPem = idpAttrs.cert;
    idpPrivateKeyPem = idpAttrs.private;

    const idpJwks = await exportPublicJwks(idpKeys.publicKey);
    setIdpJwksForTests(jose.createLocalJWKSet(idpJwks));

    const sessionJwks = await exportPublicJwks(sessionKeys.publicKey);
    setJwksForTests(jose.createLocalJWKSet(sessionJwks));

    await configureSessionSigningForTests(sessionKeys);

    const bgJwks = await exportPublicJwks(breakGlassKeys.publicKey);
    setBreakGlassJwksForTests(jose.createLocalJWKSet(bgJwks));
    process.env.EDGE_JWT_ISSUER = ISSUER;
    process.env.EDGE_JWT_AUDIENCE = AUDIENCE;
    process.env.SAML_IDP_CERT = idpCertPem;
    process.env.EDGE_BREAK_GLASS_ISSUER = BG_ISSUER;
    process.env.EDGE_BREAK_GLASS_AUDIENCE = BG_AUDIENCE;
    process.env.EDGE_AUTH_MODE = "oidc";
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    clearBreakGlassAuditForTests();
    clearScimUsersForTests();
  });

  it("rejects_unsigned_saml_response", () => {
    const unsigned = Buffer.from(
      `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"><saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:NameID>user@test</saml:NameID></saml:Assertion></samlp:Response>`,
      "utf8",
    ).toString("base64");
    expect(() => verifySamlResponse(unsigned)).toThrow(/not signed/i);
  });

  it("rejects_saml_signed_with_wrong_certificate", () => {
    const wrongAttrs = selfsigned.generate([], { days: 1, keySize: 2048 });
    const samlResponse = createSignedTestSamlResponse({
      userId: "user@test",
      tenantId: "tenant-a",
      role: "creator",
      privateKeyPem: wrongAttrs.private,
      certificatePem: wrongAttrs.cert,
    });
    expect(() => verifySamlResponse(samlResponse)).toThrow(/verification failed/i);
  });

  it("verify_signed_saml_response_directly", () => {
    const samlResponse = createSignedTestSamlResponse({
      userId: "user@test",
      tenantId: "tenant-a",
      role: "creator",
      privateKeyPem: idpPrivateKeyPem,
      certificatePem: idpCertPem,
    });
    const profile = verifySamlResponse(samlResponse);
    expect(profile.tenantId).toBe("tenant-a");
  });

  it("accepts_signed_saml_and_issues_verified_session_jwt", async () => {
    const samlResponse = createSignedTestSamlResponse({
      userId: "user@test",
      tenantId: "tenant-a",
      role: "creator",
      privateKeyPem: idpPrivateKeyPem,
      certificatePem: idpCertPem,
    });

    const app = createEdgeApp();
    const res = await request(app)
      .post("/auth/saml/acs")
      .send({ SAMLResponse: samlResponse });
    expect(res.status).toBe(200);
    expect(res.body.session.tenantId).toBe("tenant-a");
    expect(res.body.access_token).toBeTruthy();
    expect(res.body.access_token.startsWith("dev:")).toBe(false);
  });

  it("rejects_unsigned_oidc_id_token", async () => {
    const forged = Buffer.from(
      JSON.stringify({
        sub: "attacker",
        tenant_id: "tenant-b",
        role: "tenant_admin",
      }),
      "utf8",
    ).toString("base64url");

    const app = createEdgeApp();
    const res = await request(app)
      .post("/auth/oidc/callback")
      .send({ id_token: forged });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("oidc_verification_failed");
  });

  it("accepts_verified_oidc_id_token", async () => {
    const idToken = await signTestAccessToken(
      idpKeys.privateKey,
      { sub: "oidc-user", tenant_id: "tenant-a", role: "approver" },
      { issuer: ISSUER, audience: AUDIENCE },
    );

    const app = createEdgeApp();
    const res = await request(app)
      .post("/auth/oidc/callback")
      .send({ id_token: idToken });
    expect(res.status).toBe(200);
    expect(res.body.session.role).toBe("approver");
  });

  it("rejects_forged_break_glass_token", async () => {
    const app = createEdgeApp();
    const res = await request(app)
      .post("/auth/break-glass")
      .set(
        "Authorization",
        `Bearer ${Buffer.from(JSON.stringify({ break_glass: true, tenant_id: "tenant-a", sub: "evil" }), "utf8").toString("base64url")}`,
      )
      .send({ reason: "incident response drill" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("break_glass_denied");
  });

  it("break_glass_writes_audit_and_returns_verified_session", async () => {
    const bgToken = await signTestBreakGlassToken(
      breakGlassKeys.privateKey,
      { sub: "admin-1", tenant_id: "tenant-a" },
      { issuer: BG_ISSUER, audience: BG_AUDIENCE },
    );

    const app = createEdgeApp();
    const res = await request(app)
      .post("/auth/break-glass")
      .set("Authorization", `Bearer ${bgToken}`)
      .send({ reason: "incident response drill" });

    expect(res.status).toBe(200);
    expect(res.body.audited).toBe(true);
    expect(res.body.session.role).toBe("tenant_admin");
    expect(getBreakGlassAuditRecordsForTests()).toHaveLength(1);
    expect(getBreakGlassAuditRecordsForTests()[0]?.reason).toContain("incident");
  });

  it("rejects_unsigned_scim_bearer", async () => {
    const app = createEdgeApp();
    const res = await request(app)
      .post("/scim/v2/Users")
      .set("Authorization", "Bearer dev:fake")
      .send({ userName: "new-user", tenantId: "tenant-a", role: "viewer" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_scim_token");
  });

  it("accepts_verified_scim_bearer", async () => {
    const scimToken = await signTestAccessToken(
      sessionKeys.privateKey,
      { sub: "scim-provisioner", tenant_id: "tenant-a", role: "tenant_admin" },
      { issuer: ISSUER, audience: AUDIENCE },
    );

    const app = createEdgeApp();
    const createRes = await request(app)
      .post("/scim/v2/Users")
      .set("Authorization", `Bearer ${scimToken}`)
      .send({ userName: "new-user", tenantId: "tenant-a", role: "viewer" });
    expect(createRes.status).toBe(201);

    const getRes = await request(app)
      .get(`/scim/v2/Users/${createRes.body.id}`)
      .set("Authorization", `Bearer ${scimToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.userName).toBe("new-user");
  });
});
