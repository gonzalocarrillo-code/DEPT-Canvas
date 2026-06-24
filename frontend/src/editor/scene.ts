import type { Layer } from "./types";
import type { LayerManifestEntry } from "@/graph/types";

// The default design's layer manifest (id/name/kind/locked) — what the graph
// variation reads for a master that hasn't been opened/edited in the editor yet.
export function defaultLayerManifest(): LayerManifestEntry[] {
  return sampleScene().map((l) => ({
    id: l.id,
    name: l.name,
    kind: l.kind === "shape" ? "graphic" : l.kind,
    locked: l.locked,
  }));
}

// A real, editable sample scene so the editor is usable immediately (before the
// CE.SDK engine is connected). The "Logo lockup" is brand-locked to demonstrate locks.
export function sampleScene(): Layer[] {
  return [
    {
      id: "bg",
      name: "Background",
      kind: "image",
      x: 0, y: 0, w: 1, h: 1,
      rotation: 0, opacity: 1, visible: true, locked: false,
      hue: 265,
    },
    {
      id: "headline",
      name: "Headline",
      kind: "text",
      x: 0.08, y: 0.5, w: 0.84, h: 0.26,
      rotation: 0, opacity: 1, visible: true, locked: false,
      text: "New season,\nnew you.",
      fontFamily: "Inter",
      fontSize: 0.11,
      fontWeight: 700,
      color: "#ffffff",
      align: "left",
      lineHeight: 1.02,
      letterSpacing: -0.02,
    },
    {
      id: "subhead",
      name: "Subhead",
      kind: "text",
      x: 0.08, y: 0.79, w: 0.7, h: 0.08,
      rotation: 0, opacity: 0.92, visible: true, locked: false,
      text: "Fall / Winter collection",
      fontFamily: "Inter",
      fontSize: 0.035,
      fontWeight: 500,
      color: "#ece9ff",
      align: "left",
      lineHeight: 1.2,
      letterSpacing: 0.01,
    },
    {
      id: "cta",
      name: "CTA button",
      kind: "shape",
      x: 0.08, y: 0.88, w: 0.28, h: 0.07,
      rotation: 0, opacity: 1, visible: true, locked: false,
      fill: "#6f66e8",
      radius: 10,
      text: "Shop the drop",
      color: "#ffffff",
      fontSize: 0.026,
      fontWeight: 600,
      align: "center",
    },
    {
      id: "logo",
      name: "Logo lockup",
      kind: "image",
      x: 0.08, y: 0.07, w: 0.16, h: 0.07,
      rotation: 0, opacity: 1, visible: true, locked: true,
      hue: 210,
    },
  ];
}
