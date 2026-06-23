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
