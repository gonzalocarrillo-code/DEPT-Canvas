import { getJson, postJson } from "./client";

export interface PlanNode {
  kind: string;
  title: string;
  prompt: string;
}

export interface GraphPlan {
  master: { title: string; prompt: string };
  nodes: PlanNode[];
  rationale?: string;
  estimatedCostUsd?: number;
}

export interface AiStatus {
  configured: boolean;
  planModel: string;
  imageModel: string;
}

export interface GenerateResult {
  kind: string;
  dataUrl?: string;
  url?: string;
  text?: string;
}

export function getAiStatus(): Promise<AiStatus> {
  return getJson<AiStatus>("/api/ai/status");
}

export function requestPlan(brief: string): Promise<GraphPlan> {
  return postJson<GraphPlan>("/api/ai/plan", { brief });
}

export function requestGenerate(kind: string, prompt: string): Promise<GenerateResult> {
  return postJson<GenerateResult>("/api/ai/generate", { kind, prompt });
}

export interface SaveSceneResult {
  success: boolean;
  sceneId: string;
  applied?: boolean;
  note?: string;
}

export interface LoadSceneResult {
  sceneId: string;
  scene: string;
  sizeBytes: number;
}

// Persist editor edits through the edge → orchestration → scene-mcp (locks are
// enforced server-side by set_properties; tenant resolved from the session).
export function saveScene(
  sceneId: string,
  body: { projectId?: string; layers: unknown[]; keyframes: Record<string, unknown>; locked?: boolean },
): Promise<SaveSceneResult> {
  return postJson<SaveSceneResult>(`/api/scenes/${encodeURIComponent(sceneId)}/save`, body);
}

export function loadSceneFromBackend(sceneId: string): Promise<LoadSceneResult> {
  return getJson<LoadSceneResult>(`/api/scenes/${encodeURIComponent(sceneId)}`);
}

// ── Render / export (generate-once / render-many) ──────────────────────────
export interface RenderOutputSpec {
  width: number;
  height: number;
  durationSec?: number;
  format: "png" | "jpeg" | "pdf" | "mp4";
}

export interface ExportJob {
  jobId: string;
  status: string;
  estimated?: { count: number; costUsd: number; etaSec: number };
}

export interface JobStatus {
  jobId: string;
  status: "queued" | "rendering" | "done" | "error";
  progress: number;
  downloadUrl?: string;
  error?: string;
  outputs?: { outputRef: string; format: string; bytes?: number }[];
}

// One approved scene → many sizes server-side (never re-generated per aspect).
// The edge resolves the tenant-scoped sceneRef from the session + this sceneId.
export function exportVariations(body: {
  sceneId: string;
  outputs: RenderOutputSpec[];
}): Promise<ExportJob> {
  return postJson<ExportJob>("/api/variations/export", body);
}

export function getJobStatus(jobId: string): Promise<JobStatus> {
  return getJson<JobStatus>(`/api/jobs/${encodeURIComponent(jobId)}/status`);
}

/** Poll until the render job is done/error or the attempt budget is exhausted. */
export async function pollJobStatus(
  jobId: string,
  opts: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<JobStatus> {
  const intervalMs = opts.intervalMs ?? 1000;
  const maxAttempts = opts.maxAttempts ?? 60;
  let last: JobStatus | undefined;
  for (let i = 0; i < maxAttempts; i++) {
    last = await getJobStatus(jobId);
    if (last.status === "done" || last.status === "error") return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last ?? { jobId, status: "error", progress: 0, error: "timeout" };
}
