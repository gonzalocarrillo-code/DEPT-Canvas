import type { Node, Edge } from "@xyflow/react";

// The graph has exactly three node kinds now:
//  - design   : the master scene pushed from the editor (the single source of truth)
//  - layer     : one per layer of the design; unlocked layers carry an authored change
//  - variation : composes the changes of all connected layer nodes over the design and
//                pre-renders one output (image or video)
export type NodeKind = "design" | "layer" | "variation";

export type NodeStatus = "idle" | "queued" | "generating" | "done" | "error";
export type VariantApproval = "pending" | "approved" | "rejected";

export type LayerKindTag = "text" | "image" | "graphic";

// The design's real layers + per-layer lock state, mirrored from the editor so the
// graph varies REAL layers and honors REAL locks (lock in editor → locked in graph).
export interface LayerManifestEntry {
  id: string;
  name: string;
  kind: LayerKindTag;
  locked: boolean;
}

// One authored change to a specific layer, captured on a layer node and composed
// into a variation: e.g. { layerName: "Headline", change: "translate to Chinese" }.
export interface LayerChange {
  layerId: string;
  layerName: string;
  layerKind: LayerKindTag;
  change: string;
}

export interface CanvasNodeData {
  kind: NodeKind;
  title: string;
  model?: string;
  status: NodeStatus;
  /** Thumbnail tint (hue 0-360). */
  hue?: number;
  /** image | video — chosen once in the editor, inherited by every node. */
  outputKind?: "image" | "video";
  // ── design (the master) ──
  layers?: LayerManifestEntry[];
  /** Number of variation nodes branched off this design. */
  count?: number;
  // ── layer node ──
  layerId?: string;
  layerName?: string;
  layerKind?: LayerKindTag;
  /** Locked in the editor — cannot author a change, cannot feed a variation. */
  locked?: boolean;
  /** The authored change for this layer (e.g. "translate to Chinese"). */
  change?: string;
  // ── variation node (the composed pre-render) ──
  /** The connected layer changes composed into this variation. */
  changes?: LayerChange[];
  approval?: VariantApproval;
  /** Real generated image (data URL or remote URL) when the AI gateway is configured. */
  imageUrl?: string;
  /** The design was re-edited after this variation was rendered. */
  stale?: boolean;
  /** MD skill scoping the generation for this variation. */
  skillId?: string | null;
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
  design: { label: "Design", hue: 265, defaultModel: "scene" },
  layer: { label: "Layer", hue: 200, defaultModel: "gpt-image-2" },
  variation: { label: "Variation", hue: 175, defaultModel: "orchestrator" },
};
