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
import { hueFor } from "../batch/batchStore";
import { defaultLayerManifest } from "../editor/scene";
import type { LayerManifestEntry, VariableLayer, VariationAxis } from "./types";
import { getAiStatus, requestGenerate } from "../api/ai";
import { useSkillsStore } from "../skills/skills";

export interface VariationConfig {
  variableLayers: VariableLayer[];
  outputKind: "image" | "video";
  skillId: string | null;
}

const PREVIEW_PER_LANE = 6; // cap spawned variant nodes per layer-lane to keep the canvas bounded

// Expand a variation axis into concrete values. A `values` axis is the list as-is;
// a `prompt` axis is expanded locally here (deterministic stub) — real semantic
// expansion is the orchestration mapping agent (needs a key), wired later.
function expandAxis(axis: VariationAxis): string[] {
  if (axis.kind === "values") return axis.values.map((v) => v.trim()).filter(Boolean);
  const n = Math.max(1, Math.min(200, axis.expandTo));
  const label = (axis.instruction || "variant").trim().slice(0, 28);
  return Array.from({ length: n }, (_, i) => `${label} ${i + 1}`);
}

// Per-layer generation prompt; the MD skill body scopes the AI for this layer only.
function buildLayerPrompt(
  layer: LayerManifestEntry,
  value: string,
  skillBody?: string,
): { kind: string; prompt: string } {
  const base =
    layer.kind === "text"
      ? `Write the ${layer.name} for an ad creative: ${value}.`
      : `On-brand ${layer.name} for an ad creative — ${value}.`;
  const skillText = skillBody ? `\n\n--- Apply this skill (for this layer only) ---\n${skillBody}` : "";
  return { kind: layer.kind === "text" ? "copy" : "image", prompt: `${base}${skillText}` };
}

function makeId(): string {
  try {
    return crypto.randomUUID().slice(0, 6);
  } catch {
    return Math.floor(Math.random() * 1e6).toString(36);
  }
}

const HISTORY_LIMIT = 50;
type GraphSnap = { nodes: CanvasNode[]; edges: CanvasEdge[] };
const cloneNodes = (ns: CanvasNode[]): CanvasNode[] =>
  ns.map((n) => ({ ...n, position: { ...n.position }, data: { ...n.data } }));
const cloneEdges = (es: CanvasEdge[]): CanvasEdge[] => es.map((e) => ({ ...e }));

interface PlanInput {
  master: { title: string; prompt: string };
  nodes: { kind: string; title: string; prompt: string }[];
}

interface GraphState {
  projectId: string | null;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  past: GraphSnap[];
  future: GraphSnap[];
  clipboard: CanvasNode[];
  loadProject: (projectId: string) => void;
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  updateNodeData: (id: string, patch: Partial<CanvasNodeData>) => void;
  addChild: (parentId: string, kind: NodeKind) => void;
  addNode: (kind: NodeKind) => void;
  generateAll: () => void;
  buildFromPlan: (projectId: string, plan: PlanInput) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  copyNodes: () => void;
  pasteNodes: () => void;
  createVariationSet: (masterId: string, config: VariationConfig) => void;
  approveVariant: (id: string) => void;
  rejectVariant: (id: string) => void;
  approveAllInSet: (setId: string) => void;
  markSetStale: (masterId: string) => void;
  reDeriveVariant: (id: string) => void;
}

// React Flow's recommended state-management pattern: the store is the single source
// of truth; ReactFlow is driven by it, and node components mutate it directly.
export const useGraphStore = create<GraphState>()((set, get) => {
  // Captured at drag-start so an entire node drag collapses into one undo step.
  let dragSnap: GraphSnap | null = null;
  const snapshot = (): GraphSnap => ({ nodes: cloneNodes(get().nodes), edges: cloneEdges(get().edges) });
  const commit = (snap: GraphSnap) =>
    set((s) => ({ past: [...s.past.slice(-(HISTORY_LIMIT - 1)), snap], future: [] }));

  // Resolve a variant: call the AI gateway when configured, otherwise keep the
  // simulated content already on the node. Either way the variant flips to done.
  const generateInto = (variantId: string, kind: string, prompt: string, configured: boolean, delay: number) => {
    if (!configured) {
      window.setTimeout(() => get().updateNodeData(variantId, { status: "done" }), delay);
      return;
    }
    requestGenerate(kind, prompt)
      .then((r) =>
        get().updateNodeData(variantId, {
          status: "done",
          ...(r.text ? { variantText: r.text } : {}),
          ...(r.dataUrl || r.url ? { imageUrl: r.dataUrl ?? r.url } : {}),
        }),
      )
      .catch(() => get().updateNodeData(variantId, { status: "done" }));
  };

  return {
  projectId: null,
  nodes: [],
  edges: [],
  past: [],
  future: [],
  clipboard: [],
  loadProject: (projectId) => {
    if (get().projectId === projectId && get().nodes.length > 0) return;
    const seeded = seedGraph(projectId);
    set({ projectId, nodes: seeded.nodes, edges: seeded.edges, past: [], future: [], clipboard: [] });
  },
  onNodesChange: (changes) => {
    const dragStart = changes.some((c) => c.type === "position" && c.dragging === true);
    const dragEnd = changes.some((c) => c.type === "position" && c.dragging === false);
    if (dragStart && !dragSnap) dragSnap = snapshot();
    set({ nodes: applyNodeChanges(changes, get().nodes) });
    if (dragEnd && dragSnap) {
      const snap = dragSnap;
      dragSnap = null;
      commit(snap);
    }
  },
  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: (connection) => {
    commit(snapshot());
    set({ edges: addEdge(connection, get().edges) });
  },
  pushHistory: () => commit(snapshot()),
  undo: () => {
    const s = get();
    if (!s.past.length) return;
    const prev = s.past[s.past.length - 1];
    set({
      past: s.past.slice(0, -1),
      future: [...s.future, snapshot()],
      nodes: prev.nodes,
      edges: prev.edges,
    });
  },
  redo: () => {
    const s = get();
    if (!s.future.length) return;
    const next = s.future[s.future.length - 1];
    set({
      future: s.future.slice(0, -1),
      past: [...s.past, snapshot()],
      nodes: next.nodes,
      edges: next.edges,
    });
  },
  copyNodes: () => {
    const selected = get().nodes.filter((n) => n.selected);
    if (selected.length) set({ clipboard: cloneNodes(selected) });
  },
  pasteNodes: () => {
    const clip = get().clipboard;
    if (!clip.length) return;
    commit(snapshot());
    const idMap = new Map<string, string>();
    const pasted: CanvasNode[] = clip.map((n) => {
      const id = `${n.data.kind}-${makeId()}`;
      idMap.set(n.id, id);
      return {
        ...n,
        id,
        position: { x: n.position.x + 40, y: n.position.y + 40 },
        selected: true,
        data: { ...n.data },
      };
    });
    set((s) => ({
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...pasted],
    }));
  },
  // Branch a layer-variation job off a master: one variation-set node + N variant
  // child nodes (one lane per varied layer). Locked layers can NEVER vary (the lock
  // toggled in the editor is enforced here in code); all other layers are inherited
  // at render time (generate-once / render-many, never baked).
  createVariationSet: (masterId, config) => {
    const master = get().nodes.find((n) => n.id === masterId);
    if (!master) return;
    const layers = (master.data.layers as LayerManifestEntry[] | undefined) ?? defaultLayerManifest();
    const skillBody = useSkillsStore.getState().getSkill(config.skillId)?.body;

    const lanes = config.variableLayers
      .map((vl) => ({ layer: layers.find((l) => l.id === vl.layerId), values: expandAxis(vl.axis) }))
      .filter(
        (j): j is { layer: LayerManifestEntry; values: string[] } =>
          Boolean(j.layer) && !j.layer!.locked && j.values.length > 0,
      );
    if (!lanes.length) return;
    commit(snapshot());

    const px = master.position.x;
    const py = master.position.y;
    const setId = `vset-${makeId()}`;
    const setInfo = kindInfo["variation-set"];
    const total = lanes.reduce((s, l) => s + l.values.length, 0);
    const setNode: CanvasNode = {
      id: setId,
      type: "canvasNode",
      position: { x: px + 360, y: py },
      data: {
        kind: "variation-set",
        title: "Variations",
        status: "done",
        model: setInfo.defaultModel,
        hue: setInfo.hue,
        variableLayers: config.variableLayers,
        outputKind: config.outputKind,
        skillId: config.skillId,
        count: total,
        collapsed: total > PREVIEW_PER_LANE * lanes.length,
      },
    };

    const nodes: CanvasNode[] = [setNode];
    const edges: CanvasEdge[] = [{ id: `e-${masterId}-${setId}`, source: masterId, target: setId }];
    const COL = 280;
    const ROW = 230;
    const laneBaseY = py - ((lanes.length - 1) * ROW) / 2;
    const jobs: { id: string; kind: string; prompt: string }[] = [];
    let gi = 0;
    lanes.forEach((lane, laneIdx) => {
      const isText = lane.layer.kind === "text";
      // Cap spawned nodes per lane; the set node's count reflects the full batch.
      lane.values.slice(0, PREVIEW_PER_LANE).forEach((value, i) => {
        const delta = `${lane.layer.name} · ${value}`;
        const vid = `variant-${makeId()}`;
        const { kind, prompt } = buildLayerPrompt(lane.layer, value, skillBody);
        nodes.push({
          id: vid,
          type: "canvasNode",
          position: { x: px + 680 + i * COL, y: laneBaseY + laneIdx * ROW },
          data: {
            kind: "variant",
            title: delta,
            status: "generating",
            model: isText ? "gpt-5.4-mini" : "gpt-image-2",
            hue: hueFor(gi),
            setId,
            slotId: lane.layer.id,
            delta,
            approval: "pending",
            outputKind: config.outputKind,
            variantText: isText ? value : undefined,
          },
        });
        edges.push({ id: `e-${setId}-${vid}`, source: setId, target: vid, label: delta });
        jobs.push({ id: vid, kind, prompt });
        gi++;
      });
    });

    set((s) => ({ nodes: [...s.nodes, ...nodes], edges: [...s.edges, ...edges] }));
    getAiStatus()
      .then((st) => jobs.forEach((j, idx) => generateInto(j.id, j.kind, j.prompt, st.configured, 700 + idx * 160)))
      .catch(() => jobs.forEach((j, idx) => generateInto(j.id, j.kind, j.prompt, false, 700 + idx * 160)));
  },
  approveVariant: (id) => get().updateNodeData(id, { approval: "approved" }),
  rejectVariant: (id) => get().updateNodeData(id, { approval: "rejected" }),
  approveAllInSet: (setId) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.data.kind === "variant" && n.data.setId === setId && n.data.status === "done"
          ? { ...n, data: { ...n.data, approval: "approved" } }
          : n,
      ),
    })),
  // The master scene was re-edited: flag dependent variants stale rather than
  // silently cascading — the human re-derives, preserving edits + locks.
  markSetStale: (masterId) => {
    const setIds = get()
      .edges.filter((e) => e.source === masterId)
      .map((e) => e.target);
    const sets = new Set(
      get().nodes.filter((n) => n.data.kind === "variation-set" && setIds.includes(n.id)).map((n) => n.id),
    );
    if (!sets.size) return;
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.data.kind === "variant" && n.data.setId && sets.has(n.data.setId) && !n.data.stale
          ? { ...n, data: { ...n.data, stale: true } }
          : n,
      ),
    }));
  },
  // Re-run ONLY this variant's varied layer on the current master; clears stale.
  // Never touches locked layers — the variant only ever carries the swapped layer.
  reDeriveVariant: (id) => {
    const v = get().nodes.find((n) => n.id === id);
    if (!v || v.data.kind !== "variant") return;
    const setNode = get().nodes.find((n) => n.id === v.data.setId);
    if (!setNode) {
      get().updateNodeData(id, { stale: false });
      return;
    }
    const masterId = get().edges.find((e) => e.target === setNode.id)?.source;
    const master = get().nodes.find((n) => n.id === masterId);
    const layers = (master?.data.layers as LayerManifestEntry[] | undefined) ?? defaultLayerManifest();
    const layer = layers.find((l) => l.id === v.data.slotId);
    // Layer gone or now locked in the editor → can't (re)vary it; just clear stale.
    if (!layer || layer.locked) {
      get().updateNodeData(id, { stale: false });
      return;
    }
    // The concrete value for this lane is the tail of the "Layer · value" delta.
    const value = v.data.variantText ?? v.data.delta?.split("·").pop()?.trim() ?? "";
    const skillBody = useSkillsStore.getState().getSkill(setNode.data.skillId ?? null)?.body;
    const { kind, prompt } = buildLayerPrompt(layer, value, skillBody);
    get().updateNodeData(id, { status: "generating", stale: false, approval: "pending" });
    getAiStatus()
      .then((st) => generateInto(id, kind, prompt, st.configured, 600))
      .catch(() => generateInto(id, kind, prompt, false, 600));
  },
  updateNodeData: (id, patch) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    }),
  addChild: (parentId, kind) => {
    commit(snapshot());
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
        // Kind-appropriate defaults so each process starts with sensible controls.
        ...(kind === "transcreate" ? { locales: ["ES", "FR", "DE"] } : {}),
        ...(kind === "resize" ? { formats: ["9:16", "1:1", "16:9"] } : {}),
      },
    };
    set({
      nodes: [...get().nodes, child],
      edges: addEdge(
        { id: `e-${parentId}-${id}`, source: parentId, target: id },
        get().edges,
      ),
    });
    // Simulate generation (real generate_asset wiring lives in the backend).
    window.setTimeout(() => {
      get().updateNodeData(id, {
        status: "done",
        hue: kindInfo[kind].hue,
        ...(kind === "copy" ? { count: 3 } : {}),
      });
    }, 1500);
  },
  addNode: (kind) => {
    commit(snapshot());
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
  // Run every generation node — each flips to a "generating" loading state, then
  // settles to done (staggered), so the whole graph renders its work in-place.
  generateAll: () => {
    const generatable = new Set<NodeKind>([
      "image",
      "copy",
      "video",
      "transcreate",
      "resize",
      "animate",
      "picture-idea",
      "variant",
    ]);
    const targets = get().nodes.filter((n) => generatable.has(n.data.kind) && !n.data.locked);
    if (!targets.length) return;
    const ids = new Set(targets.map((t) => t.id));
    set((s) => ({
      nodes: s.nodes.map((n) =>
        ids.has(n.id) ? { ...n, data: { ...n.data, status: "generating" } } : n,
      ),
    }));
    targets.forEach((n, idx) =>
      window.setTimeout(
        () => get().updateNodeData(n.id, { status: "done", hue: n.data.hue ?? kindInfo[n.data.kind].hue }),
        600 + idx * 180,
      ),
    );
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
          ...(kind === "transcreate" ? { locales: ["ES", "FR", "DE"] } : {}),
          ...(kind === "resize" ? { formats: ["9:16", "1:1", "16:9"] } : {}),
          ...(kind === "copy" ? { count: 3 } : {}),
        },
      });
      edges.push({ id: `e-master-${id}`, source: "master", target: id });
    });
    set({ projectId, nodes, edges, past: [], future: [], clipboard: [] });
  },
  };
});
