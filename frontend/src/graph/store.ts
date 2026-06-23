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
import { MASTER_SLOTS, hueFor, fakeText, type AssetSlot } from "../batch/batchStore";
import { getAiStatus, requestGenerate } from "../api/ai";
import { useSkillsStore } from "../skills/skills";

export interface VariationConfig {
  targetSlotIds: string[];
  slotInstructions: Record<string, string>;
  mode: "generate" | "transcreate";
  count: number;
  locales: string[];
  skillId: string | null;
}

// Build the generation prompt for one variant. The MD skill body is injected for
// this asset only (scopes the AI per the skill), matching the variation contract.
function buildVariantPrompt(
  slot: AssetSlot,
  instr: string,
  locale: string | undefined,
  skillBody?: string,
): { kind: string; prompt: string } {
  const base =
    slot.type === "image"
      ? `On-brand ${slot.name.toLowerCase()} for an ad creative. ${instr || slot.hint}.`
      : `Write the ${slot.name.toLowerCase()} for an ad creative. ${instr || ""}`.trim();
  const loc = locale
    ? ` Target locale: ${locale}; transcreate (preserve intent and CTA energy, do not translate literally).`
    : "";
  const skillText = skillBody ? `\n\n--- Apply this skill (for this asset only) ---\n${skillBody}` : "";
  const kind = slot.type === "text" ? (locale ? "transcreate" : "copy") : "image";
  return { kind, prompt: `${base}${loc}${skillText}` };
}

function makeId(): string {
  try {
    return crypto.randomUUID().slice(0, 6);
  } catch {
    return Math.floor(Math.random() * 1e6).toString(36);
  }
}

const countedKinds = new Set<NodeKind>(["transcreate", "resize", "copy"]);

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
  // Branch a multi-slot variation job off a master: one variation-set node +
  // N variant child nodes (one lane per slot), each an editable scene.
  createVariationSet: (masterId, config) => {
    const master = get().nodes.find((n) => n.id === masterId);
    if (!master) return;
    // Locks enforced: drop any locked slot before it can become a varied axis.
    const slots = config.targetSlotIds
      .map((id) => MASTER_SLOTS.find((s) => s.id === id))
      .filter((s): s is AssetSlot => Boolean(s) && !s!.locked)
      .slice(0, 3);
    if (!slots.length) return;
    commit(snapshot());

    const px = master.position.x;
    const py = master.position.y;
    const setId = `vset-${makeId()}`;
    const setInfo = kindInfo["variation-set"];
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
        targetSlotIds: slots.map((s) => s.id),
        slotInstructions: config.slotInstructions,
        skillId: config.skillId,
        variationMode: config.mode,
        locales: config.locales,
      },
    };

    const nodes: CanvasNode[] = [setNode];
    const edges: CanvasEdge[] = [{ id: `e-${masterId}-${setId}`, source: masterId, target: setId }];
    const COL = 280;
    const ROW = 230;
    const laneBaseY = py - ((slots.length - 1) * ROW) / 2;
    const skillBody = useSkillsStore.getState().getSkill(config.skillId)?.body;
    const jobs: { id: string; kind: string; prompt: string }[] = [];
    let gi = 0;
    slots.forEach((slot, lane) => {
      const effMode = slot.type === "text" ? config.mode : "generate";
      const units =
        effMode === "transcreate"
          ? config.locales
          : Array.from({ length: config.count }, (_, i) => i);
      const instr = config.slotInstructions[slot.id] ?? "";
      units.forEach((unit, i) => {
        const locale = effMode === "transcreate" ? (unit as string) : undefined;
        const delta = `${slot.name} · ${locale ?? `v${i + 1}`}`;
        const vid = `variant-${makeId()}`;
        const { kind, prompt } = buildVariantPrompt(slot, instr, locale, skillBody);
        nodes.push({
          id: vid,
          type: "canvasNode",
          position: { x: px + 680 + i * COL, y: laneBaseY + lane * ROW },
          data: {
            kind: "variant",
            title: delta,
            status: "generating",
            model: slot.type === "text" ? "gpt-5.4-mini" : "gpt-image-2",
            hue: hueFor(gi),
            setId,
            slotId: slot.id,
            delta,
            approval: "pending",
            // Simulated content is the fallback; replaced when the AI gateway is configured.
            variantText: slot.type === "text" ? fakeText(slot, instr, i, locale) : undefined,
          },
        });
        edges.push({ id: `e-${setId}-${vid}`, source: setId, target: vid, label: delta });
        jobs.push({ id: vid, kind, prompt });
        gi++;
      });
    });

    set((s) => ({ nodes: [...s.nodes, ...nodes], edges: [...s.edges, ...edges] }));
    // Generate through the AI gateway when configured; otherwise keep the simulated
    // content. One status check, then resolve each variant generating → done.
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
  // Re-run ONLY this variant's varied axis on the current master; clears stale.
  // Never touches locked props — the variant only ever carries the swapped asset.
  reDeriveVariant: (id) => {
    const v = get().nodes.find((n) => n.id === id);
    if (!v || v.data.kind !== "variant") return;
    const setNode = get().nodes.find((n) => n.id === v.data.setId);
    const slot = MASTER_SLOTS.find((s) => s.id === v.data.slotId);
    if (!setNode || !slot) {
      get().updateNodeData(id, { stale: false });
      return;
    }
    const cfg = setNode.data;
    const instr = (cfg.slotInstructions ?? {})[slot.id] ?? "";
    const locale =
      cfg.variationMode === "transcreate" && slot.type === "text"
        ? v.data.delta?.split("·").pop()?.trim()
        : undefined;
    const skillBody = useSkillsStore.getState().getSkill(cfg.skillId ?? null)?.body;
    const { kind, prompt } = buildVariantPrompt(slot, instr, locale, skillBody);
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
          ...(countedKinds.has(kind) ? { count: 3 } : {}),
        },
      });
      edges.push({ id: `e-master-${id}`, source: "master", target: id });
    });
    set({ projectId, nodes, edges, past: [], future: [], clipboard: [] });
  },
  };
});
