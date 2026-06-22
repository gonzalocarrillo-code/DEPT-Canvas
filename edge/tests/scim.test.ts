import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createEdgeApp } from "../src/server.js";
import { clearScimUsersForTests } from "../src/scim/provisioning.js";
import {
  mintPlatformSessionJwt,
  setupPlatformJwtEnv,
  shutdownJwtHarness,
} from "./support/jwt-harness.js";

const PLATFORM_ISSUER = "https://platform.deptcanvas.test";
const PLATFORM_AUDIENCE = "dept-canvas-edge";

async function adminBearer(
  tenantId: string,
  sub = "scim-admin",
): Promise<string> {
  const token = await mintPlatformSessionJwt({
    sub,
    tenant_id: tenantId,
    role: "tenant_admin",
  });
  return `Bearer ${token}`;
}

describe("scim.test.ts live-path adversarial", () => {
  beforeAll(async () => {
    await setupPlatformJwtEnv(PLATFORM_ISSUER, PLATFORM_AUDIENCE);
    process.env.EDGE_AUTH_MODE = "oidc";
    process.env.NODE_ENV = "test";
  });

  afterAll(async () => {
    await shutdownJwtHarness();
  });

  afterEach(() => {
    clearScimUsersForTests();
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

  it("rejects_cross_tenant_provisioning_from_body", async () => {
    const app = createEdgeApp();
    const res = await request(app)
      .post("/scim/v2/Users")
      .set("Authorization", await adminBearer("tenant-a"))
      .send({
        userName: "cross-tenant-user",
        tenantId: "tenant-b",
        role: "viewer",
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("cross_tenant_denied");
  });

  it("rejects_role_escalation_in_body", async () => {
    const app = createEdgeApp();
    const res = await request(app)
      .post("/scim/v2/Users")
      .set("Authorization", await adminBearer("tenant-a"))
      .send({
        userName: "escalated-user",
        tenantId: "tenant-a",
        role: "tenant_admin",
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("role_escalation_denied");
  });

  it("creates_user_in_caller_tenant_with_viewer_role_only", async () => {
    const app = createEdgeApp();
    const createRes = await request(app)
      .post("/scim/v2/Users")
      .set("Authorization", await adminBearer("tenant-a"))
      .send({ userName: "new-user", tenantId: "tenant-b", role: "tenant_admin" });

    expect(createRes.status).toBe(403);
    expect(createRes.body.error).toBe("cross_tenant_denied");

    const okRes = await request(app)
      .post("/scim/v2/Users")
      .set("Authorization", await adminBearer("tenant-a"))
      .send({ userName: "new-user" });
    expect(okRes.status).toBe(201);
    expect(okRes.body.tenantId).toBe("tenant-a");
    expect(okRes.body.role).toBe("viewer");
  });

  it("rejects_cross_tenant_read", async () => {
    const app = createEdgeApp();
    const createRes = await request(app)
      .post("/scim/v2/Users")
      .set("Authorization", await adminBearer("tenant-a"))
      .send({ userName: "tenant-a-user" });
    expect(createRes.status).toBe(201);

    const crossRead = await request(app)
      .get(`/scim/v2/Users/${createRes.body.id}`)
      .set("Authorization", await adminBearer("tenant-b"));
    expect(crossRead.status).toBe(403);
    expect(crossRead.body.error).toBe("cross_tenant_denied");
  });

  it("allows_same_tenant_read", async () => {
    const app = createEdgeApp();
    const createRes = await request(app)
      .post("/scim/v2/Users")
      .set("Authorization", await adminBearer("tenant-a"))
      .send({ userName: "same-tenant-user" });
    expect(createRes.status).toBe(201);

    const getRes = await request(app)
      .get(`/scim/v2/Users/${createRes.body.id}`)
      .set("Authorization", await adminBearer("tenant-a"));
    expect(getRes.status).toBe(200);
    expect(getRes.body.userName).toBe("same-tenant-user");
  });

  it("rejects_non_admin_scim_caller", async () => {
    const viewerToken = await mintPlatformSessionJwt({
      sub: "viewer-user",
      tenant_id: "tenant-a",
      role: "viewer",
    });

    const app = createEdgeApp();
    const res = await request(app)
      .post("/scim/v2/Users")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ userName: "should-fail" });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("scim_forbidden");
  });
});
