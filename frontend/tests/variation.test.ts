// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { useGraphStore } from "@/graph/store";
import type { CanvasNode } from "@/graph/types";

const master: CanvasNode = {
  id: "master",
  type: "canvasNode",
  position: { x: 0, y: 0 },
  data: { kind: "image", title: "Master", status: "done" },
};

function reset() {
  useGraphStore.setState({
    projectId: "test",
    nodes: [{ ...master, data: { ...master.data } }],
    edges: [],
    past: [],
    future: [],
    clipboard: [],
  });
}

const variants = () => useGraphStore.getState().nodes.filter((n) => n.data.kind === "variant");
const sets = () => useGraphStore.getState().nodes.filter((n) => n.data.kind === "variation-set");

describe("graph-native variations — createVariationSet", () => {
  beforeEach(reset);

  it("branches one variation-set + N variants per slot (3 slots × 4 = 12)", () => {
    useGraphStore.getState().createVariationSet("master", {
      targetSlotIds: ["background", "headline", "cta"],
      slotInstructions: {},
      mode: "generate",
      count: 4,
      locales: [],
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

  it("drops brand-locked slots — they can never become a varied axis", () => {
    useGraphStore.getState().createVariationSet("master", {
      targetSlotIds: ["logo", "background"], // logo is locked in MASTER_SLOTS
      slotInstructions: {},
      mode: "generate",
      count: 3,
      locales: [],
      skillId: null,
    });
    expect(sets()[0].data.targetSlotIds).toEqual(["background"]);
    expect(variants()).toHaveLength(3); // only the unlocked background varied
  });

  it("transcreation produces one variant per locale for text slots", () => {
    useGraphStore.getState().createVariationSet("master", {
      targetSlotIds: ["headline"],
      slotInstructions: {},
      mode: "transcreate",
      count: 4,
      locales: ["EN", "ES", "FR"],
      skillId: "meta-ads",
    });
    expect(variants()).toHaveLength(3);
    expect(variants().every((v) => typeof v.data.variantText === "string")).toBe(true);
  });

  it("approve / reject flip a variant's approval", () => {
    useGraphStore.getState().createVariationSet("master", {
      targetSlotIds: ["background"],
      slotInstructions: {},
      mode: "generate",
      count: 2,
      locales: [],
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
      targetSlotIds: ["background"],
      slotInstructions: {},
      mode: "generate",
      count: 3,
      locales: [],
      skillId: null,
    });
    expect(useGraphStore.getState().nodes.length).toBeGreaterThan(before);
    useGraphStore.getState().undo();
    expect(useGraphStore.getState().nodes.length).toBe(before);
  });

  it("markSetStale flags variants derived from a re-edited master", () => {
    useGraphStore.getState().createVariationSet("master", {
      targetSlotIds: ["background", "headline"],
      slotInstructions: {},
      mode: "generate",
      count: 2,
      locales: [],
      skillId: null,
    });
    expect(variants().every((v) => !v.data.stale)).toBe(true);
    useGraphStore.getState().markSetStale("master");
    expect(variants().every((v) => v.data.stale === true)).toBe(true);
  });

  it("reDeriveVariant clears stale and re-enters generating", () => {
    useGraphStore.getState().createVariationSet("master", {
      targetSlotIds: ["background"],
      slotInstructions: {},
      mode: "generate",
      count: 1,
      locales: [],
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
});
