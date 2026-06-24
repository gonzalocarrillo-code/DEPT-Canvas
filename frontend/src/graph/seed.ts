import type { CanvasNode, CanvasEdge, LayerChange, LayerManifestEntry } from "./types";
import { kindInfo } from "./types";
import { defaultLayerManifest } from "../editor/scene";

const COL = 320; // horizontal gap between columns
const ROW = 132; // vertical gap between layer nodes

export interface DesignInput {
  title?: string;
  outputKind?: "image" | "video";
  layers: LayerManifestEntry[];
  /** Optional pre-authored layer changes (layerId → instruction). */
  changes?: Record<string, string>;
}

// The canonical graph for a pushed design: a design master + one node per layer.
// Used both by the editor "Push to graph" action and the demo seed below.
export function buildDesignGraph(design: DesignInput): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const layers = design.layers;
  const outputKind = design.outputKind ?? "image";
  const colY = ((layers.length - 1) * ROW) / 2;
  const designNode: CanvasNode = {
    id: "design",
    type: "canvasNode",
    position: { x: 0, y: colY },
    data: {
      kind: "design",
      title: design.title || "Design",
      status: "done",
      model: kindInfo.design.defaultModel,
      hue: kindInfo.design.hue,
      outputKind,
      layers,
    },
  };
  const nodes: CanvasNode[] = [designNode];
  const edges: CanvasEdge[] = [];
  layers.forEach((l, i) => {
    const id = `layer-${l.id}`;
    nodes.push({
      id,
      type: "canvasNode",
      position: { x: COL, y: i * ROW },
      data: {
        kind: "layer",
        title: l.name,
        status: "done",
        outputKind,
        layerId: l.id,
        layerName: l.name,
        layerKind: l.kind,
        locked: l.locked,
        change: design.changes?.[l.id] ?? "",
      },
    });
    edges.push({ id: `e-design-${id}`, source: "design", target: id });
  });
  return { nodes, edges };
}

// A demo graph so the canvas is alive: the design, its layers (logo brand-locked),
// two layers pre-authored and ONE composed "Chinese" variation wired from them —
// illustrating connect-and-compose the moment a demo project opens.
export function seedGraph(_projectId: string): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const manifest = defaultLayerManifest();
  const { nodes, edges } = buildDesignGraph({
    title: "Fall / Winter — Master",
    outputKind: "image",
    layers: manifest,
    changes: {
      headline: "translate the headline to Chinese",
      bg: "swap the backdrop for a Chinese-flag-inspired scene",
    },
  });

  const entry = (id: string) => manifest.find((m) => m.id === id)!;
  const changes: LayerChange[] = [
    { layerId: "headline", layerName: entry("headline").name, layerKind: "text", change: "translate the headline to Chinese" },
    { layerId: "bg", layerName: entry("bg").name, layerKind: "image", change: "swap the backdrop for a Chinese-flag-inspired scene" },
  ];
  const variationId = "variation-demo";
  nodes.push({
    id: variationId,
    type: "canvasNode",
    position: { x: COL * 2 + 60, y: ROW },
    data: {
      kind: "variation",
      title: "Chinese market",
      status: "done",
      outputKind: "image",
      hue: 0,
      changes,
      approval: "pending",
    },
  });
  edges.push(
    { id: `e-layer-headline-${variationId}`, source: "layer-headline", target: variationId, label: "Headline · Chinese" },
    { id: `e-layer-bg-${variationId}`, source: "layer-bg", target: variationId, label: "Background · Chinese flag" },
  );

  return { nodes, edges };
}
