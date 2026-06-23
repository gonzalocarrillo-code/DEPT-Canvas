import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createEdgeApp } from "../src/server.js";
import { resetRateLimitsForTests } from "../src/rate-limit.js";
import {
  mintPlatformSessionJwt,
  setupPlatformJwtEnv,
  shutdownJwtHarness,
} from "./support/jwt-harness.js";

const ISSUER = "https://auth.deptcanvas.test";
const AUDIENCE = "dept-canvas-edge";

async function bearerFor(claims: Record<string, string>): Promise<string> {
  const token = await mintPlatformSessionJwt(claims, { expiresInSec: 300 });
  return `Bearer ${token}`;
}

describe("app-proxy.test.ts — edge → orchestration", () => {
  beforeAll(async () => {
    await setupPlatformJwtEnv(ISSUER, AUDIENCE);
    process.env.EDGE_AUTH_MODE = "oidc";
    process.env.NODE_ENV = "test";
  });

  afterAll(async () => {
    await shutdownJwtHarness();
  });

  afterEach(() => {
    resetRateLimitsForTests();
    delete process.env.ORCHESTRATION_URL;
    delete process.env.RENDERER_URL;
    delete process.env.EDGE_ALLOWED_ORIGIN;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    resetRateLimitsForTests();
  });

  it("forwards /api/ai/plan to orchestration with token-derived identity headers", async () => {
    process.env.ORCHESTRATION_URL = "http://orchestration.internal:8800";
    const captured: { url?: string; init?: RequestInit } = {};
    const realFetch = globalThis.fetch.bind(globalThis);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        if (typeof url === "string" && url.includes("orchestration.internal")) {
          captured.url = url;
          captured.init = init;
          return new Response(JSON.stringify({ master: { title: "M", prompt: "p" }, nodes: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return realFetch(url as string, init); // pass JWKS + everything else through
      }),
    );

    const app = createEdgeApp();
    const auth = await bearerFor({ sub: "u1", tenant_id: "tenant-a", role: "creator" });
    const res = await request(app).post("/api/ai/plan").set("authorization", auth).send({ brief: "hi" });

    expect(res.status).toBe(200);
    expect(res.body.master.title).toBe("M");
    expect(captured.url).toBe("http://orchestration.internal:8800/plan");
    const headers = captured.init?.headers as Record<string, string>;
    expect(headers["x-tenant-id"]).toBe("tenant-a");
    expect(headers["x-user-id"]).toBe("u1");
    expect(headers["x-user-role"]).toBe("creator");
  });

  it("denies a conflicting x-tenant-id (tenant is authoritative from the token)", async () => {
    process.env.ORCHESTRATION_URL = "http://orchestration.internal:8800";
    const realFetch = globalThis.fetch.bind(globalThis);
    let orchestrationCalled = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        if (typeof url === "string" && url.includes("orchestration.internal")) {
          orchestrationCalled = true;
          return new Response("{}", { status: 200 });
        }
        return realFetch(url as string, init);
      }),
    );
    const app = createEdgeApp();
    const auth = await bearerFor({ sub: "u1", tenant_id: "tenant-a", role: "creator" });
    const res = await request(app)
      .post("/api/ai/generate")
      .set("authorization", auth)
      .set("x-tenant-id", "tenant-b")
      .send({ kind: "image", prompt: "x" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("cross_tenant_denied");
    expect(orchestrationCalled).toBe(false);
  });

  it("status degrades to configured:false when ORCHESTRATION_URL is unset", async () => {
    const app = createEdgeApp();
    const auth = await bearerFor({ sub: "u1", tenant_id: "tenant-a", role: "creator" });
    const res = await request(app).get("/api/ai/status").set("authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
  });

  it("generate returns 503 ai_not_configured when ORCHESTRATION_URL is unset", async () => {
    const app = createEdgeApp();
    const auth = await bearerFor({ sub: "u1", tenant_id: "tenant-a", role: "creator" });
    const res = await request(app)
      .post("/api/ai/generate")
      .set("authorization", auth)
      .send({ kind: "image", prompt: "x" });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("ai_not_configured");
  });

  it("rejects unauthenticated app calls", async () => {
    const app = createEdgeApp();
    const res = await request(app).post("/api/ai/plan").send({ brief: "hi" });
    expect(res.status).toBe(401);
  });

  it("answers CORS preflight for the allowed origin without auth", async () => {
    process.env.EDGE_ALLOWED_ORIGIN = "http://127.0.0.1:5173";
    const app = createEdgeApp();
    const res = await request(app)
      .options("/api/ai/plan")
      .set("origin", "http://127.0.0.1:5173");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");
    expect(res.headers["access-control-allow-headers"]).toContain("authorization");
  });

  it("ignores a tenant_id in the body — tenant is the token's", async () => {
    process.env.ORCHESTRATION_URL = "http://orchestration.internal:8800";
    let forwardedTenant: string | undefined;
    const realFetch = globalThis.fetch.bind(globalThis);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        if (typeof url === "string" && url.includes("orchestration.internal")) {
          forwardedTenant = (init?.headers as Record<string, string>)["x-tenant-id"];
          return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
        }
        return realFetch(url as string, init);
      }),
    );
    const app = createEdgeApp();
    const auth = await bearerFor({ sub: "u1", tenant_id: "tenant-a", role: "creator" });
    await request(app)
      .post("/api/ai/generate")
      .set("authorization", auth)
      .send({ kind: "copy", prompt: "x", tenant_id: "tenant-b", tenantId: "tenant-b" });
    expect(forwardedTenant).toBe("tenant-a");
    vi.unstubAllGlobals();
  });

  it("forwards scene save/load with the path id and tenant from the token", async () => {
    process.env.ORCHESTRATION_URL = "http://orchestration.internal:8800";
    const seen: string[] = [];
    const realFetch = globalThis.fetch.bind(globalThis);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        if (typeof url === "string" && url.includes("orchestration.internal")) {
          seen.push(url);
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return realFetch(url as string, init);
      }),
    );
    const app = createEdgeApp();
    const auth = await bearerFor({ sub: "u1", tenant_id: "tenant-a", role: "creator" });
    const get = await request(app).get("/api/scenes/scene-1").set("authorization", auth);
    const post = await request(app)
      .post("/api/scenes/scene-1/save")
      .set("authorization", auth)
      .send({ layers: [] });
    expect(get.status).toBe(200);
    expect(post.status).toBe(200);
    expect(seen).toContain("http://orchestration.internal:8800/scenes/scene-1");
    expect(seen).toContain("http://orchestration.internal:8800/scenes/scene-1/save");
    vi.unstubAllGlobals();
  });

  it("forwards export + job-status to the renderer with tenant from the token", async () => {
    process.env.RENDERER_URL = "http://renderer.internal:8830";
    const seen: { url: string; tenant?: string }[] = [];
    const realFetch = globalThis.fetch.bind(globalThis);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        if (typeof url === "string" && url.includes("renderer.internal")) {
          const headers = (init?.headers ?? {}) as Record<string, string>;
          seen.push({ url, tenant: headers["x-tenant-id"] });
          return new Response(JSON.stringify({ jobId: "r1", status: "queued" }), {
            status: 202,
            headers: { "content-type": "application/json" },
          });
        }
        return realFetch(url as string, init);
      }),
    );
    const app = createEdgeApp();
    const auth = await bearerFor({ sub: "u1", tenant_id: "tenant-a", role: "creator" });
    const exp = await request(app)
      .post("/api/variations/export")
      .set("authorization", auth)
      .send({ sceneRef: "tenant/tenant-a/scenes/s1.scene", outputs: [{ width: 1080, height: 1080, format: "png" }] });
    const stat = await request(app).get("/api/jobs/r1/status").set("authorization", auth);
    expect(exp.status).toBe(202);
    expect(stat.status).toBe(202);
    expect(seen).toEqual([
      { url: "http://renderer.internal:8830/jobs", tenant: "tenant-a" },
      { url: "http://renderer.internal:8830/jobs/r1", tenant: "tenant-a" },
    ]);
    vi.unstubAllGlobals();
  });
});

describe("app-proxy.test.ts — dev auth mode", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "test";
    process.env.EDGE_AUTH_MODE = "dev";
  });
  afterAll(() => {
    process.env.EDGE_AUTH_MODE = "oidc";
  });
  afterEach(() => {
    resetRateLimitsForTests();
    delete process.env.ORCHESTRATION_URL;
  });

  function devToken(claims: Record<string, string>): string {
    const b64 = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
    return `Bearer dev:${b64}`;
  }

  it("accepts a dev: token and resolves tenant from it (no JWKS needed)", async () => {
    const app = createEdgeApp();
    const res = await request(app)
      .get("/api/ai/status")
      .set("authorization", devToken({ sub: "u1", tenant_id: "tenant-local", role: "creator" }));
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false); // ORCHESTRATION_URL unset → graceful
  });

  it("forwards the dev-token tenant to orchestration, not a client-supplied one", async () => {
    process.env.ORCHESTRATION_URL = "http://orchestration.internal:8800";
    const captured: { headers?: Record<string, string> } = {};
    const realFetch = globalThis.fetch.bind(globalThis);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        if (typeof url === "string" && url.includes("orchestration.internal")) {
          captured.headers = init?.headers as Record<string, string>;
          return new Response(JSON.stringify({ kind: "copy", text: "hi" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return realFetch(url as string, init);
      }),
    );
    const app = createEdgeApp();
    const res = await request(app)
      .post("/api/ai/generate")
      .set("authorization", devToken({ sub: "u1", tenant_id: "tenant-local", role: "creator" }))
      .send({ kind: "copy", prompt: "x" });
    expect(res.status).toBe(200);
    expect(captured.headers?.["x-tenant-id"]).toBe("tenant-local");
    vi.unstubAllGlobals();
  });
});
