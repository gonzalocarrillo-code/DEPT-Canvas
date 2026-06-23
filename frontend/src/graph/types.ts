import type { Node, Edge } from "@xyflow/react";

export type NodeKind =
  | "brief"
  | "image"
  | "copy"
  | "video"
  | "transcreate"
  | "resize"
  | "animate"
  | "picture-idea"
  | "variation-set"
  | "variant";

export type NodeStatus = "idle" | "queued" | "generating" | "done" | "error";
export type VariantApproval = "pending" | "approved" | "rejected";

export interface CanvasNodeData {
  kind: NodeKind;
  title: string;
  prompt?: string;
  model?: string;
  mode?: "compose" | "constrained";
  status: NodeStatus;
  /** Thumbnail tint (hue 0-360) when the node has output. */
  hue?: number;
  /** Variation / output count. */
  count?: number;
  /** Brand-locked: regeneration disabled in the UI (server re-validates on save). */
  locked?: boolean;
  // ── per-process controls (shape depends on kind) ──
  skillId?: string | null;
  locales?: string[]; // transcreate
  formats?: string[]; // resize
  preset?: string; // animate (motion preset id)
  // ── variation-set (the job node) ──
  targetSlotIds?: string[];
  slotInstructions?: Record<string, string>;
  variationMode?: "generate" | "transcreate";
  // ── variant (one produced scene branched off a set) ──
  setId?: string;
  slotId?: string;
  /** Human label of the varied axis, e.g. "Background · v2" or "Headline · ES". */
  delta?: string;
  approval?: VariantApproval;
  variantText?: string;
  /** Real generated image (data URL or remote URL) when the AI gateway is configured. */
  imageUrl?: string;
  /** Master was re-edited after this variant was derived. */
  stale?: boolean;
  // React Flow node data must be index-compatible.
  [key: string]: unknown;
}

export type CanvasNode = Node<CanvasNodeData, "canvasNode">;
export type CanvasEdge = Edge;

export interface KindInfo {
  label: string;
  hue: number;
  defaultModel: string;
}

export const kindInfo: Record<NodeKind, KindInfo> = {
  brief: { label: "Brief", hue: 230, defaultModel: "planner" },
  image: { label: "Image", hue: 265, defaultModel: "gpt-image-2" },
  copy: { label: "Copy", hue: 200, defaultModel: "gpt-5.4-mini" },
  video: { label: "Video", hue: 320, defaultModel: "renderer" },
  transcreate: { label: "Transcreate", hue: 150, defaultModel: "gpt-5.4-mini" },
  resize: { label: "Resize", hue: 35, defaultModel: "engine" },
  animate: { label: "Animate", hue: 280, defaultModel: "motion-engine" },
  "picture-idea": { label: "New picture idea", hue: 95, defaultModel: "gpt-image-2" },
  "variation-set": { label: "Variations", hue: 175, defaultModel: "orchestrator" },
  variant: { label: "Variant", hue: 200, defaultModel: "gpt-image-2" },
};
