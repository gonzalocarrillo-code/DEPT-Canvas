// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { useGraphStore } from "@/graph/store";
import type { CanvasNode, LayerManifestEntry, VariableLayer } from "@/graph/types";

// The master mirrors a real editor design: 3 unlocked layers + 1 brand-locked logo.
// This manifest is the editor↔graph seam — locking in the editor lands here.
const LAYERS: LayerManifestEntry[] = [
  { id: "bg", name: "Background", kind: "image", locked: false },
  { id: "headline", name: "Headline", kind: "text", locked: false },
  { id: "cta", name: "CTA button", kind: "graphic", locked: false },
  { id: "logo", name: "Logo lockup", kind: "image", locked: true },
];

const master: CanvasNode = {
  id: "master",
  type: "canvasNode",
  position: { x: 0, y: 0 },
  data: { kind: "image", title: "Master", status: "done", layers: LAYERS },
};

function reset() {
  useGraphStore.setState({
    projectId: "test",
    nodes: [{ ...master, data: { ...master.data, layers: LAYERS } }],
    edges: [],
    past: [],
    future: [],
    clipboard: [],
  });
}

// Prompt axis expanded to n values, by layer id.
const prompt = (layerId: string, expandTo: number): VariableLayer => ({
  layerId,
  axis: { kind: "prompt", instruction: layerId, expandTo },
});
const values = (layerId: string, vals: string[]): VariableLayer => ({
  layerId,
  axis: { kind: "values", values: vals },
});

const variants = () => useGraphStore.getState().nodes.filter((n) => n.data.kind === "variant");
const sets = () => useGraphStore.getState().nodes.filter((n) => n.data.kind === "variation-set");

describe("graph-native variations — createVariationSet (layer-based)", () => {
  beforeEach(reset);

  it("branches one variation-set + N variants per layer-lane (3 layers × 4 = 12)", () => {
    useGraphStore.getState().createVariationSet("master", {
      variableLayers: [prompt("bg", 4), prompt("headline", 4), prompt("cta", 4)],
      outputKind: "image",
      skillId: null,
    });
    expect(sets()).toHaveLength(1);
    expect(variants()).toHaveLength(12);
    // every variant is wired to the set, and the set to the master
    const setId = sets()[0].id;
    const edges = useGraphStore.getState().edges;
    expect(edges.some((e) => e.source === "master" && e.target === setId)).toBe(true);
    expect(edges.filter((e) => e.source === setId).length).toBe(12);
    // edges carry the delta label so the wire states the varied axis
    expect(edges.filter((e) => e.source === setId).every((e) => typeof e.label === "string")).toBe(true);
  });

  it("drops layers locked in the editor — they can never become a varied axis", () => {
    useGraphStore.getState().createVariationSet("master", {
      variableLayers: [prompt("logo", 3), prompt("bg", 3)], // logo is locked in the manifest
      outputKind: "image",
      skillId: null,
    });
    // only the unlocked background varied; the locked logo produced nothing
    expect(variants()).toHaveLength(3);
    expect(variants().every((v) => v.data.slotId === "bg")).toBe(true);
  });

  it("a values axis produces one variant per value (text layers carry variantText)", () => {
    useGraphStore.getState().createVariationSet("master", {
      variableLayers: [values("headline", ["EN", "ES", "FR"])],
      outputKind: "image",
      skillId: "meta-ads",
    });
    expect(variants()).toHaveLength(3);
    expect(variants().every((v) => typeof v.data.variantText === "string")).toBe(true);
  });

  it("caps spawned variant nodes per lane (prompt expandTo 50 → 6 nodes, full count on the set)", () => {
    useGraphStore.getState().createVariationSet("master", {
      variableLayers: [prompt("bg", 50)],
      outputKind: "image",
      skillId: null,
    });
    expect(variants()).toHaveLength(6); // PREVIEW_PER_LANE cap
    expect(sets()[0].data.count).toBe(50); // set node reflects the full batch
  });

  it("carries the chosen output kind onto the set and variants", () => {
    useGraphStore.getState().createVariationSet("master", {
      variableLayers: [prompt("bg", 2)],
      outputKind: "video",
      skillId: null,
    });
    expect(sets()[0].data.outputKind).toBe("video");
    expect(variants().every((v) => v.data.outputKind === "video")).toBe(true);
  });

  it("approve / reject flip a variant's approval", () => {
    useGraphStore.getState().createVariationSet("master", {
      variableLayers: [prompt("bg", 2)],
      outputKind: "image",
      skillId: null,
    });
    const [a, b] = variants();
    useGraphStore.getState().approveVariant(a.id);
    useGraphStore.getState().rejectVariant(b.id);
    const after = variants();
    expect(after.find((v) => v.id === a.id)?.data.approval).toBe("approved");
    expect(after.find((v) => v.id === b.id)?.data.approval).toBe("rejected");
  });

  it("creating a set is undoable (history snapshot)", () => {
    const before = useGraphStore.getState().nodes.length;
    useGraphStore.getState().createVariationSet("master", {
      variableLayers: [prompt("bg", 3)],
      outputKind: "image",
      skillId: null,
    });
    expect(useGraphStore.getState().nodes.length).toBeGreaterThan(before);
    useGraphStore.getState().undo();
    expect(useGraphStore.getState().nodes.length).toBe(before);
  });

  it("markSetStale flags variants derived from a re-edited master", () => {
    useGraphStore.getState().createVariationSet("master", {
      variableLayers: [prompt("bg", 2), prompt("headline", 2)],
      outputKind: "image",
      skillId: null,
    });
    expect(variants().every((v) => !v.data.stale)).toBe(true);
    useGraphStore.getState().markSetStale("master");
    expect(variants().every((v) => v.data.stale === true)).toBe(true);
  });

  it("reDeriveVariant clears stale and re-enters generating", () => {
    useGraphStore.getState().createVariationSet("master", {
      variableLayers: [prompt("bg", 1)],
      outputKind: "image",
      skillId: null,
    });
    useGraphStore.getState().markSetStale("master");
    const v = variants()[0];
    useGraphStore.getState().reDeriveVariant(v.id);
    const after = variants().find((x) => x.id === v.id);
    expect(after?.data.stale).toBe(false);
    expect(after?.data.status).toBe("generating");
    expect(after?.data.approval).toBe("pending");
  });

  it("a layer locked in the editor after derivation cannot be re-derived", () => {
    useGraphStore.getState().createVariationSet("master", {
      variableLayers: [prompt("bg", 1)],
      outputKind: "image",
      skillId: null,
    });
    const v = variants()[0];
    useGraphStore.getState().updateNodeData(v.id, { status: "done" }); // it finished
    // Simulate the editor locking the background and re-publishing the manifest.
    const lockedLayers = LAYERS.map((l) => (l.id === "bg" ? { ...l, locked: true } : l));
    useGraphStore.getState().updateNodeData("master", { layers: lockedLayers });
    useGraphStore.getState().markSetStale("master");
    useGraphStore.getState().reDeriveVariant(v.id);
    const after = variants().find((x) => x.id === v.id);
    // lock is enforced in code: stale clears but it does NOT re-enter generating
    expect(after?.data.stale).toBe(false);
    expect(after?.data.status).toBe("done");
  });
});
