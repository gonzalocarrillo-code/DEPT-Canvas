import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRendererApp } from "../src/server.js";
import { clearRenderQueueForTests, setRenderFnForTests } from "../src/worker.js";

const TENANT = "tenant-a";
const SCENE = "tenant/tenant-a/scenes/scene-1.scene";

async function pollDone(app: ReturnType<typeof createRendererApp>, jobId: string, tenant = TENANT) {
  for (let i = 0; i < 20; i++) {
    const res = await request(app).get(`/jobs/${jobId}`).set("x-tenant-id", tenant);
    if (res.body.status === "done" || res.body.status === "error") return res;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("render job did not settle");
}

describe("renderer HTTP server", () => {
  beforeEach(() => {
    // Stub the render so the lifecycle is testable without a CESDK license.
    setRenderFnForTests(async (_t, sceneRef, spec) => ({
      outputRef: `${sceneRef}.${spec.format}`,
      format: spec.format,
      bytes: 2048,
    }));
  });
  afterEach(() => {
    setRenderFnForTests(undefined);
    clearRenderQueueForTests();
  });

  it("enqueues a job, processes it, and reports done with a downloadUrl", async () => {
    const app = createRendererApp();
    const create = await request(app)
      .post("/jobs")
      .set("x-tenant-id", TENANT)
      .send({ sceneRef: SCENE, outputs: [{ width: 1080, height: 1080, format: "png" }] });
    expect(create.status).toBe(202);
    expect(create.body.jobId).toBeTruthy();
    expect(create.body.estimated.count).toBe(1);

    const done = await pollDone(app, create.body.jobId);
    expect(done.body.status).toBe("done");
    expect(done.body.progress).toBe(1);
    expect(done.body.downloadUrl).toContain("png");
    expect(done.body.outputs[0].format).toBe("png");
  });

  it("renders generate-once / render-many (one scene, many sizes)", async () => {
    const app = createRendererApp();
    const create = await request(app)
      .post("/jobs")
      .set("x-tenant-id", TENANT)
      .send({
        sceneRef: SCENE,
        outputs: [
          { width: 1080, height: 1080, format: "png" },
          { width: 1080, height: 1920, format: "png" },
          { width: 1920, height: 1080, format: "jpeg" },
        ],
      });
    expect(create.body.estimated.count).toBe(3);
    const done = await pollDone(app, create.body.jobId);
    expect(done.body.outputs).toHaveLength(3);
  });

  it("does not leak a job across tenants", async () => {
    const app = createRendererApp();
    const create = await request(app)
      .post("/jobs")
      .set("x-tenant-id", TENANT)
      .send({ sceneRef: SCENE, outputs: [{ width: 100, height: 100, format: "png" }] });
    const other = await request(app).get(`/jobs/${create.body.jobId}`).set("x-tenant-id", "tenant-b");
    expect(other.status).toBe(404);
  });

  it("denies a cross-tenant sceneRef", async () => {
    const app = createRendererApp();
    const res = await request(app)
      .post("/jobs")
      .set("x-tenant-id", TENANT)
      .send({ sceneRef: "tenant/tenant-b/scenes/x.scene", outputs: [{ width: 100, height: 100, format: "png" }] });
    expect(res.status).toBe(403);
  });

  it("gates MP4 behind the renderer container", async () => {
    const app = createRendererApp();
    const res = await request(app)
      .post("/jobs")
      .set("x-tenant-id", TENANT)
      .send({ sceneRef: SCENE, outputs: [{ width: 1080, height: 1920, format: "mp4" }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("video_render_requires_container");
  });

  it("requires a tenant header", async () => {
    const app = createRendererApp();
    const res = await request(app)
      .post("/jobs")
      .send({ sceneRef: SCENE, outputs: [{ width: 100, height: 100, format: "png" }] });
    expect(res.status).toBe(401);
  });
});
