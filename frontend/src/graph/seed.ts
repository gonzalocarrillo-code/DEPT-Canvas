import type { CanvasNode, CanvasEdge, LayerChange, LayerManifestEntry } from "./types";
import { kindInfo } from "./types";
import { defaultLayerManifest } from "../editor/scene";
import { layerCenterY, layoutLayer, variationSlot } from "./layout";

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
  const designNode: CanvasNode = {
    id: "design",
    type: "canvasNode",
    position: { x: 0, y: layerCenterY(layers.length) },
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
      position: layoutLayer(i),
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
  // Two values per layer (one per line) — they zip by index into two aligned
  // market variations, illustrating multi-value fan-out the moment a demo opens.
  const { nodes, edges } = buildDesignGraph({
    title: "Fall / Winter — Master",
    outputKind: "image",
    layers: manifest,
    changes: {
      headline: "translate the headline to Chinese\ntranslate the headline to Spanish",
      bg: "swap the backdrop for a Chinese-flag-inspired scene\nswap the backdrop for a Spanish-flag-inspired scene",
    },
  });

  const entry = (id: string) => manifest.find((m) => m.id === id)!;
  const markets = [
    { idx: 0, name: "Chinese market", headline: "translate the headline to Chinese", bg: "swap the backdrop for a Chinese-flag-inspired scene", hlLabel: "Chinese", bgLabel: "Chinese flag", hue: 0 },
    { idx: 1, name: "Spanish market", headline: "translate the headline to Spanish", bg: "swap the backdrop for a Spanish-flag-inspired scene", hlLabel: "Spanish", bgLabel: "Spanish flag", hue: 45 },
  ];
  markets.forEach((m, k) => {
    const changes: LayerChange[] = [
      { layerId: "headline", layerName: entry("headline").name, layerKind: "text", change: m.headline },
      { layerId: "bg", layerName: entry("bg").name, layerKind: "image", change: m.bg },
    ];
    const vid = `variation-${m.idx}`;
    nodes.push({
      id: vid,
      type: "canvasNode",
      position: variationSlot(k, markets.length, layerCenterY(manifest.length)),
      data: { kind: "variation", title: m.name, status: "done", outputKind: "image", hue: m.hue, changes, approval: "pending", axisIndex: m.idx },
    });
    edges.push(
      { id: `e-layer-headline-${vid}`, source: "layer-headline", target: vid, label: `Headline · ${m.hlLabel}` },
      { id: `e-layer-bg-${vid}`, source: "layer-bg", target: vid, label: `Background · ${m.bgLabel}` },
    );
  });

  return { nodes, edges };
}
