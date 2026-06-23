import type { CanvasNode, CanvasEdge } from "./types";

const edge = (source: string, target: string): CanvasEdge => ({
  id: `e-${source}-${target}`,
  source,
  target,
});

// A small demo graph so the canvas is alive. Replaced by the planner agent (P3) /
// persisted project graph (P4).
export function seedGraph(_projectId: string): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
} {
  const nodes: CanvasNode[] = [
    {
      id: "brief",
      type: "canvasNode",
      position: { x: 0, y: 160 },
      data: {
        kind: "brief",
        title: "Campaign brief",
        status: "done",
        model: "planner",
        prompt:
          "Fall/Winter launch — bold, optimistic. Headline: “New season, new you.”",
      },
    },
    {
      id: "master",
      type: "canvasNode",
      position: { x: 360, y: 160 },
      data: {
        kind: "image",
        title: "Master keyframe",
        status: "done",
        model: "gpt-image-2",
        mode: "compose",
        hue: 265,
      },
    },
    {
      id: "transcreate",
      type: "canvasNode",
      position: { x: 720, y: 0 },
      data: {
        kind: "transcreate",
        title: "Transcreate — ES · FR · DE",
        status: "done",
        model: "gpt-5.4-mini",
        count: 3,
        hue: 150,
      },
    },
    {
      id: "resize",
      type: "canvasNode",
      position: { x: 720, y: 260 },
      data: {
        kind: "resize",
        title: "Resize — 9:16 · 1:1 · 16:9",
        status: "generating",
        model: "engine",
        count: 3,
        hue: 35,
      },
    },
    {
      id: "logo",
      type: "canvasNode",
      position: { x: 360, y: 420 },
      data: {
        kind: "image",
        title: "Logo lockup",
        status: "done",
        model: "asset",
        hue: 210,
        locked: true,
      },
    },
  ];

  const edges: CanvasEdge[] = [
    edge("brief", "master"),
    edge("master", "transcreate"),
    edge("master", "resize"),
    edge("logo", "master"),
  ];

  return { nodes, edges };
}
