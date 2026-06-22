import { describe, expect, it, afterEach } from "vitest";
import {
  assertNativeMp4Rejected,
  containerE2ePending,
} from "../src/cesdk-render.js";
import {
  clearRenderQueueForTests,
  enqueueRenderJob,
  estimateRenderJob,
  processRenderJob,
} from "../src/worker.js";

describe("render-worker", () => {
  afterEach(() => {
    clearRenderQueueForTests();
  });

  it("rejects native Node exportVideo for mp4 path", async () => {
    await assertNativeMp4Rejected();
  });

  it("enqueue + estimate returns count/cost/eta", () => {
    const est = estimateRenderJob([
      { width: 1080, height: 1080, format: "png" },
      { width: 1080, height: 1920, format: "mp4", durationSec: 6 },
    ]);
    expect(est.count).toBe(2);
    expect(est.costUsd).toBeGreaterThan(0);
    expect(est.etaSec).toBeGreaterThan(0);
  });

  it("worker writes only tenant-scoped output refs", async () => {
    const job = enqueueRenderJob({
      tenantId: "tenant-a",
      sceneRef: "tenant/tenant-a/scenes/sample.scene",
      outputs: [{ width: 400, height: 400, format: "png" }],
    });

    const processed = await processRenderJob(job.id);
    expect(processed.status).toBe("completed");
    expect(processed.results[0]?.outputRef).toMatch(/^tenant\/tenant-a\//);
  });

  it("container mp4 e2e pending without CESDK_LICENSE", () => {
    if (!process.env.CESDK_LICENSE) {
      expect(containerE2ePending()).toBe(true);
    }
  });
});
