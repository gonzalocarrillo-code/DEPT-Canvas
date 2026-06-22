import * as jose from "jose";
import selfsigned from "selfsigned";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  clearBreakGlassAuditForTests,
  getBreakGlassAuditRecordsForTests,
} from "../src/audit/break-glass-audit.js";
import { createEdgeApp } from "../src/server.js";
import { clearSamlReplayCacheForTests } from "../src/sso/saml-replay-cache.js";
import { clearScimUsersForTests } from "../src/scim/provisioning.js";
import {
  mintBreakGlassToken,
  mintIdpIdToken,
  setupBreakGlassJwtEnv,
  setupIdpJwtEnv,
  setupPlatformJwtEnv,
  shutdownJwtHarness,
} from "./support/jwt-harness.js";
import {
  createSignedTestSamlResponse,
  createStaleSamlResponse,
  createWrappedSamlAttackResponse,
  createWrongAudienceSamlResponse,
} from "./support/saml-harness.js";

const PLATFORM_ISSUER = "https://platform.deptcanvas.test";
const PLATFORM_AUDIENCE = "dept-canvas-edge";
const IDP_ISSUER = "https://idp.deptcanvas.test";
const IDP_AUDIENCE = "dept-canvas-idp";
const SAML_AUDIENCE = "dept-canvas-sp";

let idpCertPem: string;
let idpPrivateKeyPem: string;

describe("sso.test.ts live-path adversarial", () => {
  beforeAll(async () => {
    await setupPlatformJwtEnv(PLATFORM_ISSUER, PLATFORM_AUDIENCE);
    await setupIdpJwtEnv(IDP_ISSUER, IDP_AUDIENCE);
    await setupBreakGlassJwtEnv();

    const idpAttrs = selfsigned.generate([], { days: 1, keySize: 2048 });
    idpCertPem = idpAttrs.cert;
    idpPrivateKeyPem = idpAttrs.private;

    process.env.SAML_IDP_CERT = idpCertPem;
    process.env.SAML_SP_AUDIENCE = SAML_AUDIENCE;
    process.env.EDGE_AUTH_MODE = "oidc";
    process.env.NODE_ENV = "test";
  });

  afterAll(async () => {
    await shutdownJwtHarness();
  });

  afterEach(() => {
    clearBreakGlassAuditForTests();
    clearScimUsersForTests();
    clearSamlReplayCacheForTests();
  });

  it("rejects_unsigned_saml_via_live_acs", async () => {
    const unsigned = Buffer.from(
      `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"><saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:NameID>user@test</saml:NameID></saml:Assertion></samlp:Response>`,
      "utf8",
    ).toString("base64");

    const app = createEdgeApp();
    const res = await request(app)
      .post("/auth/saml/acs")
      .send({ SAMLResponse: unsigned });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("saml_verification_failed");
  });

  it("ignores_unsigned_wrapped_assertion_and_uses_signed_profile", async () => {
    const wrapped = createWrappedSamlAttackResponse({
      userId: "user@test",
      tenantId: "tenant-a",
      role: "creator",
      privateKeyPem: idpPrivateKeyPem,
      certificatePem: idpCertPem,
      audience: SAML_AUDIENCE,
    });

    const app = createEdgeApp();
    const res = await request(app)
      .post("/auth/saml/acs")
      .send({ SAMLResponse: wrapped });
    expect(res.status).toBe(200);
    expect(res.body.session.tenantId).toBe("tenant-a");
    expect(res.body.session.role).toBe("creator");
  });

  it("rejects_stale_saml_via_live_acs", async () => {
    const stale = createStaleSamlResponse({
      userId: "user@test",
      tenantId: "tenant-a",
      role: "creator",
      privateKeyPem: idpPrivateKeyPem,
      certificatePem: idpCertPem,
      audience: SAML_AUDIENCE,
    });

    const app = createEdgeApp();
    const res = await request(app)
      .post("/auth/saml/acs")
      .send({ SAMLResponse: stale });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("saml_verification_failed");
  });

  it("rejects_wrong_audience_saml_via_live_acs", async () => {
    const wrongAudience = createWrongAudienceSamlResponse({
      userId: "user@test",
      tenantId: "tenant-a",
      role: "creator",
      privateKeyPem: idpPrivateKeyPem,
      certificatePem: idpCertPem,
      audience: SAML_AUDIENCE,
    });

    const app = createEdgeApp();
    const res = await request(app)
      .post("/auth/saml/acs")
      .send({ SAMLResponse: wrongAudience });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("saml_verification_failed");
  });

  it("accepts_valid_saml_via_live_acs_and_issues_platform_session", async () => {
    const samlResponse = createSignedTestSamlResponse({
      userId: "user@test",
      tenantId: "tenant-a",
      role: "creator",
      privateKeyPem: idpPrivateKeyPem,
      certificatePem: idpCertPem,
      audience: SAML_AUDIENCE,
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

  it("rejects_replayed_saml_assertion_via_live_acs", async () => {
    const samlResponse = createSignedTestSamlResponse({
      userId: "user@test",
      tenantId: "tenant-a",
      role: "creator",
      privateKeyPem: idpPrivateKeyPem,
      certificatePem: idpCertPem,
      audience: SAML_AUDIENCE,
      assertionId: "_assertion_replay_probe",
    });

    const app = createEdgeApp();
    const first = await request(app)
      .post("/auth/saml/acs")
      .send({ SAMLResponse: samlResponse });
    expect(first.status).toBe(200);

    const replay = await request(app)
      .post("/auth/saml/acs")
      .send({ SAMLResponse: samlResponse });
    expect(replay.status).toBe(401);
    expect(replay.body.error).toBe("saml_verification_failed");
  });

  it("rejects_unsigned_oidc_id_token_via_live_callback", async () => {
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

  it("accepts_idp_signed_token_via_live_callback", async () => {
    const idToken = await mintIdpIdToken({
      sub: "oidc-user",
      tenant_id: "tenant-a",
      role: "approver",
    });

    const app = createEdgeApp();
    const res = await request(app)
      .post("/auth/oidc/callback")
      .send({ id_token: idToken });
    expect(res.status).toBe(200);
    expect(res.body.session.role).toBe("approver");
  });

  it("rejects_idp_token_signed_with_platform_keys_at_oidc_callback", async () => {
    const domain = await setupPlatformJwtEnv(PLATFORM_ISSUER, PLATFORM_AUDIENCE);
    const roguePlatformAsIdp = await new jose.SignJWT({
      tenant_id: "tenant-b",
      role: "tenant_admin",
    })
      .setProtectedHeader({ alg: "RS256", kid: "rogue-platform-kid" })
      .setIssuer(IDP_ISSUER)
      .setAudience(IDP_AUDIENCE)
      .setSubject("attacker")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(domain.privateKey);

    const app = createEdgeApp();
    const res = await request(app)
      .post("/auth/oidc/callback")
      .send({ id_token: roguePlatformAsIdp });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("oidc_verification_failed");
  });

  it("rejects_forged_break_glass_token_via_live_path", async () => {
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

  it("break_glass_writes_audit_via_live_path", async () => {
    const bgToken = await mintBreakGlassToken({
      sub: "admin-1",
      tenant_id: "tenant-a",
    });

    const app = createEdgeApp();
    const res = await request(app)
      .post("/auth/break-glass")
      .set("Authorization", `Bearer ${bgToken}`)
      .send({ reason: "incident response drill" });

    expect(res.status).toBe(200);
    expect(res.body.audited).toBe(true);
    expect(getBreakGlassAuditRecordsForTests()).toHaveLength(1);
  });
});
