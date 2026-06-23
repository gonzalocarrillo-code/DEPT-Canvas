import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import type { CanvasNode, CanvasEdge, CanvasNodeData, NodeKind } from "./types";
import { kindInfo } from "./types";
import { seedGraph } from "./seed";

function makeId(): string {
  try {
    return crypto.randomUUID().slice(0, 6);
  } catch {
    return Math.floor(Math.random() * 1e6).toString(36);
  }
}

const countedKinds = new Set<NodeKind>(["transcreate", "resize", "copy"]);

interface PlanInput {
  master: { title: string; prompt: string };
  nodes: { kind: string; title: string; prompt: string }[];
}

interface GraphState {
  projectId: string | null;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  loadProject: (projectId: string) => void;
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  updateNodeData: (id: string, patch: Partial<CanvasNodeData>) => void;
  addChild: (parentId: string, kind: NodeKind) => void;
  addNode: (kind: NodeKind) => void;
  buildFromPlan: (projectId: string, plan: PlanInput) => void;
}

// React Flow's recommended state-management pattern: the store is the single source
// of truth; ReactFlow is driven by it, and node components mutate it directly.
export const useGraphStore = create<GraphState>()((set, get) => ({
  projectId: null,
  nodes: [],
  edges: [],
  loadProject: (projectId) => {
    if (get().projectId === projectId && get().nodes.length > 0) return;
    const seeded = seedGraph(projectId);
    set({ projectId, nodes: seeded.nodes, edges: seeded.edges });
  },
  onNodesChange: (changes) =>
    set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: (connection) => set({ edges: addEdge(connection, get().edges) }),
  updateNodeData: (id, patch) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    }),
  addChild: (parentId, kind) => {
    const parent = get().nodes.find((n) => n.id === parentId);
    const siblings = get().edges.filter((e) => e.source === parentId).length;
    const px = parent?.position.x ?? 0;
    const py = parent?.position.y ?? 0;
    const id = `${kind}-${makeId()}`;
    const child: CanvasNode = {
      id,
      type: "canvasNode",
      position: { x: px + 360, y: py + siblings * 140 - 40 },
      data: {
        kind,
        title: kindInfo[kind].label,
        status: "generating",
        model: kindInfo[kind].defaultModel,
        mode: "compose",
      },
    };
    set({
      nodes: [...get().nodes, child],
      edges: addEdge(
        { id: `e-${parentId}-${id}`, source: parentId, target: id },
        get().edges,
      ),
    });
    // Simulate generation (P4 wires the real generate_asset call).
    window.setTimeout(() => {
      get().updateNodeData(id, {
        status: "done",
        hue: kindInfo[kind].hue,
        ...(countedKinds.has(kind) ? { count: 3 } : {}),
      });
    }, 1500);
  },
  addNode: (kind) => {
    const count = get().nodes.length;
    const id = `${kind}-${makeId()}`;
    const node: CanvasNode = {
      id,
      type: "canvasNode",
      position: { x: 160 + (count % 4) * 60, y: 140 + (count % 6) * 56 },
      data: {
        kind,
        title: kindInfo[kind].label,
        status: kind === "brief" ? "done" : "idle",
        model: kindInfo[kind].defaultModel,
        mode: "compose",
      },
    };
    set((s) => ({ nodes: [...s.nodes, node] }));
  },
  buildFromPlan: (projectId, plan) => {
    const sanitize = (k: string): NodeKind => (k in kindInfo ? (k as NodeKind) : "image");
    const nodes: CanvasNode[] = [
      {
        id: "brief",
        type: "canvasNode",
        position: { x: 0, y: 220 },
        data: {
          kind: "brief",
          title: "Campaign brief",
          status: "done",
          model: "planner",
          prompt: plan.master.prompt,
        },
      },
      {
        id: "master",
        type: "canvasNode",
        position: { x: 360, y: 220 },
        data: {
          kind: "image",
          title: plan.master.title || "Master keyframe",
          status: "done",
          model: kindInfo.image.defaultModel,
          mode: "compose",
          hue: kindInfo.image.hue,
          prompt: plan.master.prompt,
        },
      },
    ];
    const edges: CanvasEdge[] = [
      { id: "e-brief-master", source: "brief", target: "master" },
    ];
    plan.nodes.slice(0, 6).forEach((n, i) => {
      const kind = sanitize(n.kind);
      const id = `${kind}-${i}`;
      nodes.push({
        id,
        type: "canvasNode",
        position: { x: 720, y: i * 150 - 80 },
        data: {
          kind,
          title: n.title,
          status: "done",
          model: kindInfo[kind].defaultModel,
          hue: kindInfo[kind].hue,
          prompt: n.prompt,
          ...(countedKinds.has(kind) ? { count: 3 } : {}),
        },
      });
      edges.push({ id: `e-master-${id}`, source: "master", target: id });
    });
    set({ projectId, nodes, edges });
  },
}));
