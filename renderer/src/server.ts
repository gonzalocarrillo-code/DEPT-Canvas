import express, { type Express, type Request, type Response } from "express";
import { assertTenantSceneRef, type RenderFormat, type RenderOutputSpec } from "./cesdk-render.js";
import {
  enqueueRenderJob,
  estimateRenderJob,
  getRenderJob,
  processRenderJob,
  type QueuedRenderJob,
} from "./worker.js";

// Renderer data-plane HTTP surface. The edge forwards the tenant (from the
// session) as X-Tenant-Id; jobs are tenant-scoped and a job can only be read by
// its owning tenant. Worker statuses are mapped to the frontend's vocabulary.
const STATUS_MAP: Record<QueuedRenderJob["status"], "queued" | "rendering" | "done" | "error"> = {
  queued: "queued",
  running: "rendering",
  completed: "done",
  failed: "error",
};

const LOCAL_FORMATS: RenderFormat[] = ["png", "jpeg", "pdf"];

function tenantOf(req: Request): string | undefined {
  const raw = req.header("x-tenant-id");
  return raw && raw.trim() ? raw.trim() : undefined;
}

// MP4 needs the imgly renderer container; gate it unless one is configured.
function mp4Available(): boolean {
  return Boolean(process.env.CESDK_RENDERER_IMAGE && process.env.CESDK_LICENSE);
}

export function createRendererApp(): Express {
  const app = express();
  app.use(express.json({ limit: "4mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "dept-canvas-renderer" });
  });

  app.post("/jobs", (req: Request, res: Response) => {
    const tenant = tenantOf(req);
    if (!tenant) {
      res.status(401).json({ error: "missing_tenant" });
      return;
    }
    const sceneRef = req.body?.sceneRef;
    const outputs = req.body?.outputs as RenderOutputSpec[] | undefined;
    if (typeof sceneRef !== "string" || !Array.isArray(outputs) || outputs.length === 0) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    try {
      assertTenantSceneRef(tenant, sceneRef);
    } catch {
      res.status(403).json({ error: "cross_tenant_denied" });
      return;
    }
    if (outputs.some((o) => o.format === "mp4") && !mp4Available()) {
      res.status(400).json({
        error: "video_render_requires_container",
        detail: "MP4 needs CESDK_RENDERER_IMAGE + CESDK_LICENSE; png/jpeg/pdf render locally.",
      });
      return;
    }

    const estimated = estimateRenderJob(outputs);
    const job = enqueueRenderJob({ tenantId: tenant, sceneRef, outputs });
    // Process out-of-band so the caller can poll status; failures land on the job.
    void processRenderJob(job.id).catch(() => undefined);
    res.status(202).json({ jobId: job.id, status: "queued", estimated });
  });

  app.get("/jobs/:id", (req: Request, res: Response) => {
    const tenant = tenantOf(req);
    if (!tenant) {
      res.status(401).json({ error: "missing_tenant" });
      return;
    }
    const job = getRenderJob(req.params.id);
    if (!job || job.tenantId !== tenant) {
      // Don't leak existence across tenants.
      res.status(404).json({ error: "job_not_found" });
      return;
    }
    const status = STATUS_MAP[job.status];
    const total = job.outputs.length || 1;
    res.json({
      jobId: job.id,
      status,
      progress: Math.min(1, job.results.length / total),
      outputs: job.results.map((r) => ({ outputRef: r.outputRef, format: r.format, bytes: r.bytes })),
      downloadUrl:
        status === "done" && job.results[0]
          ? `/outputs/${encodeURIComponent(job.results[0].outputRef)}`
          : undefined,
      error: job.error,
    });
  });

  return app;
}

export function startRenderer(port = Number(process.env.RENDERER_PORT ?? 8830)): void {
  createRendererApp().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`dept-canvas-renderer listening on :${port} (formats: ${LOCAL_FORMATS.join(", ")}${mp4Available() ? ", mp4" : ""})`);
  });
}

// Start only when run directly (tsx src/server.ts), not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  startRenderer();
}
