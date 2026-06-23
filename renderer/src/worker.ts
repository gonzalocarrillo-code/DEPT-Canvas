import { randomUUID } from "node:crypto";
import {
  type RenderJobPayload,
  type RenderOutputSpec,
  type RenderResult,
  renderOutput,
} from "./cesdk-render.js";

// Render seam: defaults to the real CE.SDK render, overridable in tests so the
// job lifecycle + HTTP surface can be verified without a CESDK license.
type RenderFn = (tenantId: string, sceneRef: string, spec: RenderOutputSpec) => Promise<RenderResult>;
let renderFn: RenderFn = renderOutput;
export function setRenderFnForTests(fn: RenderFn | undefined): void {
  renderFn = fn ?? renderOutput;
}

export interface QueuedRenderJob extends RenderJobPayload {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  results: RenderResult[];
  error?: string;
}

const queue: QueuedRenderJob[] = [];

export function enqueueRenderJob(payload: RenderJobPayload): QueuedRenderJob {
  const job: QueuedRenderJob = {
    ...payload,
    id: randomUUID(),
    status: "queued",
    results: [],
  };
  queue.push(job);
  return job;
}

export function listRenderJobs(): QueuedRenderJob[] {
  return [...queue];
}

export function getRenderJob(jobId: string): QueuedRenderJob | undefined {
  return queue.find((job) => job.id === jobId);
}

export function clearRenderQueueForTests(): void {
  queue.length = 0;
}

export async function processRenderJob(jobId: string): Promise<QueuedRenderJob> {
  const job = getRenderJob(jobId);
  if (!job) {
    throw new Error(`Unknown render job: ${jobId}`);
  }

  job.status = "running";
  try {
    for (const output of job.outputs) {
      const result = await renderFn(job.tenantId, job.sceneRef, output);
      job.results.push(result);
    }
    job.status = "completed";
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : String(error);
    throw error;
  }

  return job;
}

export function estimateRenderJob(outputs: RenderJobPayload["outputs"]): {
  count: number;
  costUsd: number;
  etaSec: number;
} {
  const count = outputs.length;
  const costUsd = roundUsd(count * 0.005 + outputs.filter((o) => o.format === "mp4").length * 0.02);
  const etaSec = count * 3 + outputs.filter((o) => o.format === "mp4").length * 15;
  return { count, costUsd, etaSec };
}

function roundUsd(value: number): number {
  return Math.round(value * 10000) / 10000;
}
