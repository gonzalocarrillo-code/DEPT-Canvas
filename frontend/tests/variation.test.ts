// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { useGraphStore } from "@/graph/store";
import type { LayerManifestEntry } from "@/graph/types";

// A pushed design: 2 unlocked layers + 1 brand-locked logo. This manifest is the
// editor↔graph seam — locking in the editor lands here as locked layer nodes.
const LAYERS: LayerManifestEntry[] = [
  { id: "bg", name: "Background", kind: "image", locked: false },
  { id: "headline", name: "Headline", kind: "text", locked: false },
  { id: "logo", name: "Logo lockup", kind: "image", locked: true },
];

function reset() {
  useGraphStore.setState({ projectId: null, nodes: [], edges: [], past: [], future: [], clipboard: [], pushed: {}, graphCache: {} });
  useGraphStore.getState().pushToGraph("test", { title: "Test design", outputKind: "image", layers: LAYERS });
}

const node = (id: string) => useGraphStore.getState().nodes.find((n) => n.id === id);
const byKind = (k: string) => useGraphStore.getState().nodes.filter((n) => n.data.kind === k);
const variations = () => byKind("variation");
const edgesInto = (id: string) => useGraphStore.getState().edges.filter((e) => e.target === id);
const setChange = (layerId: string, change: string) => useGraphStore.getState().updateNodeData(`layer-${layerId}`, { change });

describe("layer-node variation model", () => {
  beforeEach(reset);

  it("push builds a design master + one node per layer, logo brand-locked", () => {
    expect(byKind("design")).toHaveLength(1);
    expect(byKind("layer")).toHaveLength(3);
    expect(node("design")!.data.layers).toHaveLength(3);
    expect(node("layer-logo")!.data.locked).toBe(true);
    expect(node("layer-bg")!.data.locked).toBe(false);
    // each layer is wired from the design
    expect(useGraphStore.getState().edges.filter((e) => e.source === "design")).toHaveLength(3);
  });

  it("addVariation auto-wires unlocked layers that carry a change and composes them", () => {
    setChange("bg", "swap to a Chinese flag backdrop");
    setChange("headline", "translate to Chinese");
    setChange("logo", "this should be ignored — locked"); // locked: never varies
    const vid = useGraphStore.getState().addVariation("design")!;
    expect(vid).toBeTruthy();
    expect(variations()).toHaveLength(1);
    const v = node(vid)!;
    // composed from the two unlocked layers only — the locked logo is excluded
    expect(v.data.changes).toHaveLength(2);
    expect((v.data.changes ?? []).map((c) => c.layerId).sort()).toEqual(["bg", "headline"]);
    expect(v.data.status).toBe("generating");
    expect(v.data.outputKind).toBe("image");
    // wired from the two unlocked layer nodes, not from the locked logo
    const sources = edgesInto(vid).map((e) => e.source).sort();
    expect(sources).toEqual(["layer-bg", "layer-headline"]);
  });

  it("a locked layer can never feed a variation (onConnect enforced in code)", () => {
    const vid = useGraphStore.getState().addVariation("design")!;
    setChange("logo", "Chinese flag");
    useGraphStore.getState().onConnect({ source: "layer-logo", target: vid, sourceHandle: null, targetHandle: null });
    expect(edgesInto(vid)).toHaveLength(0);
  });

  it("connecting an unlocked layer recomposes the variation", () => {
    const vid = useGraphStore.getState().addVariation("design")!; // empty (no changes yet)
    expect(node(vid)!.data.changes ?? []).toHaveLength(0);
    setChange("headline", "translate to Spanish");
    useGraphStore.getState().onConnect({ source: "layer-headline", target: vid, sourceHandle: null, targetHandle: null });
    expect(edgesInto(vid)).toHaveLength(1);
    expect(node(vid)!.data.changes).toHaveLength(1);
    expect(node(vid)!.data.changes![0].change).toBe("translate to Spanish");
  });

  it("composeVariation rebuilds the change list from the current layer nodes", () => {
    setChange("headline", "translate to Chinese");
    const vid = useGraphStore.getState().addVariation("design")!;
    setChange("headline", "translate to Japanese"); // edit after wiring
    useGraphStore.getState().composeVariation(vid);
    expect(node(vid)!.data.changes![0].change).toBe("translate to Japanese");
    expect(node(vid)!.data.status).toBe("generating");
    expect(node(vid)!.data.stale).toBe(false);
  });

  it("approve / reject flip a variation's approval", () => {
    setChange("bg", "x");
    const vid = useGraphStore.getState().addVariation("design")!;
    useGraphStore.getState().approveVariant(vid);
    expect(node(vid)!.data.approval).toBe("approved");
    useGraphStore.getState().rejectVariant(vid);
    expect(node(vid)!.data.approval).toBe("rejected");
  });

  it("markSetStale flags every variation when the design is re-edited", () => {
    setChange("bg", "x");
    const vid = useGraphStore.getState().addVariation("design")!;
    expect(node(vid)!.data.stale).toBeFalsy();
    useGraphStore.getState().markSetStale("design");
    expect(node(vid)!.data.stale).toBe(true);
  });

  it("syncManifest mirrors an editor lock onto the layer node (lock in editor → locked in graph)", () => {
    expect(node("layer-bg")!.data.locked).toBe(false);
    const locked = LAYERS.map((l) => (l.id === "bg" ? { ...l, locked: true } : l));
    useGraphStore.getState().syncManifest(locked);
    expect(node("layer-bg")!.data.locked).toBe(true);
    // and a freshly composed variation now excludes the newly-locked layer
    setChange("bg", "should be ignored now");
    setChange("headline", "translate to Chinese");
    const vid = useGraphStore.getState().addVariation("design")!;
    expect((node(vid)!.data.changes ?? []).map((c) => c.layerId)).toEqual(["headline"]);
  });

  it("multi-value layer changes zip into N aligned variations (locale-paired)", () => {
    setChange("headline", "translate to Chinese\ntranslate to Spanish\ntranslate to French");
    setChange("bg", "Chinese flag backdrop\nSpanish flag backdrop\nFrench flag backdrop");
    useGraphStore.getState().addVariation("design");
    const vs = variations();
    expect(vs).toHaveLength(3); // max value-count across layers
    // each variation pairs the SAME index from both layers (no cartesian mismatch)
    const byIndex = (i: number) => vs.find((v) => v.data.axisIndex === i)!;
    const val = (i: number, layerId: string) => byIndex(i).data.changes!.find((c) => c.layerId === layerId)!.change;
    expect([val(0, "headline"), val(0, "bg")]).toEqual(["translate to Chinese", "Chinese flag backdrop"]);
    expect([val(1, "headline"), val(1, "bg")]).toEqual(["translate to Spanish", "Spanish flag backdrop"]);
    expect([val(2, "headline"), val(2, "bg")]).toEqual(["translate to French", "French flag backdrop"]);
  });

  it("a shorter value list recycles its last value across the fan-out", () => {
    setChange("headline", "to Chinese\nto Spanish"); // 2 values
    setChange("bg", "neutral studio backdrop"); // 1 value — constant across both
    useGraphStore.getState().addVariation("design");
    const vs = variations();
    expect(vs).toHaveLength(2);
    const bgChanges = vs.map((v) => v.data.changes!.find((c) => c.layerId === "bg")!.change);
    expect(bgChanges).toEqual(["neutral studio backdrop", "neutral studio backdrop"]);
  });

  it("variations never overlap, even across repeated fan-outs (reflowed into the grid)", () => {
    setChange("bg", "a\nb\nc");
    useGraphStore.getState().addVariation("design"); // 3 variations
    setChange("headline", "x\ny");
    useGraphStore.getState().addVariation("design"); // +3 more (max value count) → 6 total
    const vs = variations();
    expect(vs.length).toBe(6);
    const slots = vs.map((v) => `${Math.round(v.position.x)},${Math.round(v.position.y)}`);
    expect(new Set(slots).size).toBe(vs.length); // every variation occupies a distinct slot
  });

  it("a chosen MD skill rides onto each fanned variation", () => {
    useGraphStore.getState().updateNodeData("design", { skillId: "meta-ads" });
    setChange("bg", "one\ntwo");
    useGraphStore.getState().addVariation("design");
    expect(variations().every((v) => v.data.skillId === "meta-ads")).toBe(true);
  });

  it("creating a variation is undoable", () => {
    const before = useGraphStore.getState().nodes.length;
    setChange("bg", "x");
    useGraphStore.getState().addVariation("design");
    expect(useGraphStore.getState().nodes.length).toBe(before + 1);
    useGraphStore.getState().undo();
    expect(useGraphStore.getState().nodes.length).toBe(before);
  });
});
