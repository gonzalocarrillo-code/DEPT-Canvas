import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import type { CanvasNode, CanvasEdge, CanvasNodeData, LayerChange, LayerManifestEntry } from "./types";
import { kindInfo } from "./types";
import { seedGraph, buildDesignGraph, type DesignInput } from "./seed";
import { hueFor } from "../batch/batchStore";
import { getAiStatus, requestGenerate } from "../api/ai";
import { useSkillsStore } from "../skills/skills";

// Demo projects from the dashboard open with a populated graph; everything else is
// "editor-first" and stays gated until the user pushes a design from the editor.
const DEMO_PROJECT_IDS = ["aurora-fw", "northwind", "lumen-drop", "vela-aon", "dept-reels", "kontur-tz"];

const COL = 320;
const ROW = 132;

function makeId(): string {
  try {
    return crypto.randomUUID().slice(0, 6);
  } catch {
    return Math.floor(Math.random() * 1e6).toString(36);
  }
}

// A short human label for a composed variation, from its layer changes.
function titleFromChanges(changes: LayerChange[]): string {
  if (!changes.length) return "Variation";
  const joined = changes.map((c) => c.change).join(" · ");
  return joined.length > 46 ? `${joined.slice(0, 45)}…` : joined;
}

// One generation prompt for the whole composed variation: the design with each
// connected layer's change applied. The MD skill (if any) scopes the generation.
function composePrompt(changes: LayerChange[], skillBody?: string): string {
  const lines = changes.map((c) => `- ${c.layerName} (${c.layerKind}): ${c.change}`).join("\n");
  const skill = skillBody ? `\n\n--- Apply this skill ---\n${skillBody}` : "";
  return `Produce an on-brand variation of the master design with these layer changes (all other layers, and every locked layer, unchanged):\n${lines}${skill}`;
}

const HISTORY_LIMIT = 50;
type GraphSnap = { nodes: CanvasNode[]; edges: CanvasEdge[] };
const cloneNodes = (ns: CanvasNode[]): CanvasNode[] =>
  ns.map((n) => ({ ...n, position: { ...n.position }, data: { ...n.data } }));
const cloneEdges = (es: CanvasEdge[]): CanvasEdge[] => es.map((e) => ({ ...e }));

interface GraphState {
  projectId: string | null;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  past: GraphSnap[];
  future: GraphSnap[];
  clipboard: CanvasNode[];
  /** Projects whose design has been pushed from the editor (gates the graph). */
  pushed: Record<string, boolean>;
  /** Built graphs persisted across navigation. */
  graphCache: Record<string, GraphSnap>;
  loadProject: (projectId: string) => void;
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  updateNodeData: (id: string, patch: Partial<CanvasNodeData>) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  copyNodes: () => void;
  pasteNodes: () => void;
  // editor → graph
  pushToGraph: (projectId: string, design: DesignInput) => void;
  syncManifest: (manifest: LayerManifestEntry[]) => void;
  // variations
  addVariation: (designId: string) => string | null;
  composeVariation: (variationId: string) => void;
  approveVariant: (id: string) => void;
  rejectVariant: (id: string) => void;
  approveAll: () => void;
  /** Mark every variation stale (the design was re-edited). */
  markSetStale: (sceneId: string) => void;
  generateAll: () => void;
}

export const useGraphStore = create<GraphState>()((set, get) => {
  let dragSnap: GraphSnap | null = null;
  const snapshot = (): GraphSnap => ({ nodes: cloneNodes(get().nodes), edges: cloneEdges(get().edges) });
  const commit = (snap: GraphSnap) =>
    set((s) => ({ past: [...s.past.slice(-(HISTORY_LIMIT - 1)), snap], future: [] }));
  const cache = (projectId: string | null, nodes: CanvasNode[], edges: CanvasEdge[]) => {
    if (!projectId) return {};
    return { graphCache: { ...get().graphCache, [projectId]: { nodes: cloneNodes(nodes), edges: cloneEdges(edges) } } };
  };

  // Resolve a variation: call the AI gateway when configured, otherwise keep the
  // simulated preview. Either way the variation flips generating → done.
  const render = (variationId: string, prompt: string, configured: boolean, delay: number) => {
    if (!configured) {
      window.setTimeout(() => get().updateNodeData(variationId, { status: "done" }), delay);
      return;
    }
    requestGenerate("image", prompt)
      .then((r) =>
        get().updateNodeData(variationId, {
          status: "done",
          ...(r.dataUrl || r.url ? { imageUrl: r.dataUrl ?? r.url } : {}),
        }),
      )
      .catch(() => get().updateNodeData(variationId, { status: "done" }));
  };

  // Rebuild a variation's change list from its CURRENT connected layer nodes, then
  // render. Locked layers can never contribute (enforced here in code).
  const recompose = (variationId: string) => {
    const v = get().nodes.find((n) => n.id === variationId);
    if (!v || v.data.kind !== "variation") return;
    const sourceIds = new Set(get().edges.filter((e) => e.target === variationId).map((e) => e.source));
    const changes: LayerChange[] = get()
      .nodes.filter((n) => sourceIds.has(n.id) && n.data.kind === "layer" && !n.data.locked)
      .map((n) => ({
        layerId: n.data.layerId as string,
        layerName: (n.data.layerName as string) ?? (n.data.title as string),
        layerKind: (n.data.layerKind as LayerChange["layerKind"]) ?? "image",
        change: ((n.data.change as string) ?? "").trim(),
      }))
      .filter((c) => c.change.length > 0);
    const skillBody = useSkillsStore.getState().getSkill((v.data.skillId as string | null) ?? null)?.body;
    get().updateNodeData(variationId, {
      changes,
      title: titleFromChanges(changes),
      status: changes.length ? "generating" : "idle",
      stale: false,
      approval: "pending",
    });
    if (!changes.length) return;
    getAiStatus()
      .then((st) => render(variationId, composePrompt(changes, skillBody), st.configured, 900))
      .catch(() => render(variationId, composePrompt(changes, skillBody), false, 900));
  };

  return {
    projectId: null,
    nodes: [],
    edges: [],
    past: [],
    future: [],
    clipboard: [],
    pushed: Object.fromEntries(DEMO_PROJECT_IDS.map((id) => [id, true])),
    graphCache: {},

    loadProject: (projectId) => {
      if (get().projectId === projectId && get().nodes.length > 0) return;
      const cached = get().graphCache[projectId];
      if (cached) {
        set({ projectId, nodes: cloneNodes(cached.nodes), edges: cloneEdges(cached.edges), past: [], future: [], clipboard: [] });
        return;
      }
      if (get().pushed[projectId]) {
        const seeded = seedGraph(projectId);
        set({ projectId, nodes: seeded.nodes, edges: seeded.edges, past: [], future: [], clipboard: [], ...cache(projectId, seeded.nodes, seeded.edges) });
        return;
      }
      // Not pushed yet — the GraphPage shows the gated empty state.
      set({ projectId, nodes: [], edges: [], past: [], future: [], clipboard: [] });
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
      set(cache(get().projectId, get().nodes, get().edges));
    },
    onEdgesChange: (changes) => {
      set({ edges: applyEdgeChanges(changes, get().edges) });
      set(cache(get().projectId, get().nodes, get().edges));
    },
    onConnect: (connection) => {
      if (!connection.source || !connection.target) return;
      const target = get().nodes.find((n) => n.id === connection.target);
      const source = get().nodes.find((n) => n.id === connection.source);
      // Only layer → variation feeds a composition; ignore other ad-hoc wires.
      if (target?.data.kind !== "variation" || source?.data.kind !== "layer") return;
      // A locked layer can never feed a variation (lock enforced in code).
      if (source.data.locked) return;
      commit(snapshot());
      const label = `${source.data.layerName ?? source.data.title} · ${((source.data.change as string) ?? "").trim() || "—"}`;
      set({ edges: addEdge({ ...connection, label }, get().edges) });
      recompose(connection.target);
      set(cache(get().projectId, get().nodes, get().edges));
    },
    updateNodeData: (id, patch) => {
      set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)) });
      set(cache(get().projectId, get().nodes, get().edges));
    },
    pushHistory: () => commit(snapshot()),
    undo: () => {
      const s = get();
      if (!s.past.length) return;
      const prev = s.past[s.past.length - 1];
      set({ past: s.past.slice(0, -1), future: [...s.future, snapshot()], nodes: prev.nodes, edges: prev.edges });
      set(cache(get().projectId, prev.nodes, prev.edges));
    },
    redo: () => {
      const s = get();
      if (!s.future.length) return;
      const next = s.future[s.future.length - 1];
      set({ future: s.future.slice(0, -1), past: [...s.past, snapshot()], nodes: next.nodes, edges: next.edges });
      set(cache(get().projectId, next.nodes, next.edges));
    },
    copyNodes: () => {
      const selected = get().nodes.filter((n) => n.selected && n.data.kind === "variation");
      if (selected.length) set({ clipboard: cloneNodes(selected) });
    },
    pasteNodes: () => {
      const clip = get().clipboard;
      if (!clip.length) return;
      commit(snapshot());
      const pasted: CanvasNode[] = clip.map((n) => ({
        ...n,
        id: `variation-${makeId()}`,
        position: { x: n.position.x + 48, y: n.position.y + 48 },
        selected: true,
        data: { ...n.data, approval: "pending" },
      }));
      set((s) => ({ nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...pasted] }));
      set(cache(get().projectId, get().nodes, get().edges));
    },

    // ── editor → graph ───────────────────────────────────────────────────
    // Build (or refresh) the graph from the editor's design. Preserves authored
    // layer changes + existing variations on a re-push, marking variations stale.
    pushToGraph: (projectId, design) => {
      const reusing = get().projectId === projectId ? get() : get().graphCache[projectId] ? { nodes: get().graphCache[projectId].nodes, edges: get().graphCache[projectId].edges } : null;
      const prevChanges: Record<string, string> = {};
      const variations: CanvasNode[] = [];
      let varEdges: CanvasEdge[] = [];
      if (reusing) {
        reusing.nodes.forEach((n) => {
          if (n.data.kind === "layer" && n.data.layerId) prevChanges[n.data.layerId as string] = (n.data.change as string) ?? "";
          if (n.data.kind === "variation") variations.push({ ...n, data: { ...n.data, stale: true } });
        });
        varEdges = reusing.edges.filter((e) => reusing.nodes.some((n) => n.id === e.target && n.data.kind === "variation"));
      }
      const built = buildDesignGraph({ ...design, changes: { ...prevChanges, ...(design.changes ?? {}) } });
      const layerIds = new Set(built.nodes.filter((n) => n.data.kind === "layer").map((n) => n.id));
      const keptVarEdges = varEdges.filter((e) => layerIds.has(e.source));
      const nodes = [...built.nodes, ...variations];
      const edges = [...built.edges, ...keptVarEdges];
      set((s) => ({
        projectId,
        nodes,
        edges,
        pushed: { ...s.pushed, [projectId]: true },
        graphCache: { ...s.graphCache, [projectId]: { nodes: cloneNodes(nodes), edges: cloneEdges(edges) } },
        past: [],
        future: [],
        clipboard: [],
      }));
    },
    // Live mirror of editor lock/identity onto the design + layer nodes (lock in
    // editor → locked in graph), without rebuilding variations.
    syncManifest: (manifest) => {
      if (!get().nodes.some((n) => n.id === "design")) return;
      set({
        nodes: get().nodes.map((n) => {
          if (n.id === "design") return { ...n, data: { ...n.data, layers: manifest } };
          if (n.data.kind === "layer" && n.data.layerId) {
            const m = manifest.find((x) => x.id === n.data.layerId);
            if (m) return { ...n, data: { ...n.data, layerName: m.name, title: m.name, layerKind: m.kind, locked: m.locked } };
          }
          return n;
        }),
      });
      set(cache(get().projectId, get().nodes, get().edges));
    },

    // ── variations ──────────────────────────────────────────────────────
    // Create a variation node and auto-wire it from every unlocked layer node that
    // already carries a change (the Chinese example in one click), then render.
    addVariation: (designId) => {
      const design = get().nodes.find((n) => n.id === designId && n.data.kind === "design");
      if (!design) return null;
      commit(snapshot());
      const layerNodes = get().nodes.filter(
        (n) => n.data.kind === "layer" && !n.data.locked && ((n.data.change as string) ?? "").trim(),
      );
      const existingVars = get().nodes.filter((n) => n.data.kind === "variation").length;
      const vid = `variation-${makeId()}`;
      const changes: LayerChange[] = layerNodes.map((n) => ({
        layerId: n.data.layerId as string,
        layerName: (n.data.layerName as string) ?? (n.data.title as string),
        layerKind: (n.data.layerKind as LayerChange["layerKind"]) ?? "image",
        change: ((n.data.change as string) ?? "").trim(),
      }));
      const node: CanvasNode = {
        id: vid,
        type: "canvasNode",
        position: { x: COL * 2 + 60, y: existingVars * ROW },
        data: {
          kind: "variation",
          title: titleFromChanges(changes),
          status: changes.length ? "generating" : "idle",
          outputKind: (design.data.outputKind as "image" | "video") ?? "image",
          hue: hueFor(existingVars),
          changes,
          approval: "pending",
        },
      };
      const newEdges: CanvasEdge[] = layerNodes.map((n) => ({
        id: `e-${n.id}-${vid}`,
        source: n.id,
        target: vid,
        label: `${n.data.layerName ?? n.data.title} · ${((n.data.change as string) ?? "").trim()}`,
      }));
      set((s) => ({ nodes: [...s.nodes, node], edges: [...s.edges, ...newEdges] }));
      if (changes.length) {
        const skillBody = useSkillsStore.getState().getSkill(null)?.body;
        getAiStatus()
          .then((st) => render(vid, composePrompt(changes, skillBody), st.configured, 900))
          .catch(() => render(vid, composePrompt(changes, skillBody), false, 900));
      }
      set(cache(get().projectId, get().nodes, get().edges));
      return vid;
    },
    composeVariation: (variationId) => recompose(variationId),
    approveVariant: (id) => get().updateNodeData(id, { approval: "approved" }),
    rejectVariant: (id) => get().updateNodeData(id, { approval: "rejected" }),
    approveAll: () => {
      set({
        nodes: get().nodes.map((n) =>
          n.data.kind === "variation" && n.data.status === "done" && n.data.approval !== "rejected"
            ? { ...n, data: { ...n.data, approval: "approved" } }
            : n,
        ),
      });
      set(cache(get().projectId, get().nodes, get().edges));
    },
    markSetStale: () => {
      set({
        nodes: get().nodes.map((n) =>
          n.data.kind === "variation" && !n.data.stale ? { ...n, data: { ...n.data, stale: true } } : n,
        ),
      });
      set(cache(get().projectId, get().nodes, get().edges));
    },
    generateAll: () => {
      const variations = get().nodes.filter((n) => n.data.kind === "variation");
      if (!variations.length) return;
      variations.forEach((v) => recompose(v.id));
    },
  };
});

export { kindInfo };
