import { create } from "zustand";
import type {
  AnimatableProp,
  EditorMode,
  EffectInstance,
  EffectType,
  FormatId,
  Layer,
  LayerKeyframes,
  LayerKind,
  ShapeType,
} from "./types";
import { EFFECT_CATALOG } from "./types";
import { sampleScene } from "./scene";
import { buildPreset } from "./motionPresets";

function makeId(): string {
  try {
    return crypto.randomUUID().slice(0, 6);
  } catch {
    return Math.floor(Math.random() * 1e6).toString(36);
  }
}

const EPS = 0.06;
const clamp01ish = (v: number) => Math.max(-0.2, Math.min(1.2, v));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

interface Clipboard {
  layer: Layer;
  keyframes: LayerKeyframes;
}
interface SelectedKeyframe {
  prop: AnimatableProp;
  t: number;
}
interface SceneSnapshot {
  layers: Layer[];
  keyframes: Record<string, LayerKeyframes>;
}
export interface SceneSeed {
  title?: string;
  locked?: boolean;
  mode?: EditorMode;
}

interface EditorState {
  projectId: string | null;
  sceneId: string | null;
  sceneTitle: string;
  sceneLocked: boolean;
  sceneCache: Record<string, SceneSnapshot>;
  mode: EditorMode;
  format: FormatId;
  layers: Layer[];
  keyframes: Record<string, LayerKeyframes>;
  selectedId: string | null;
  selectedKeyframe: SelectedKeyframe | null;
  playhead: number;
  durationS: number;
  playing: boolean;
  clipboard: Clipboard | null;
  kfClipboard: { prop: AnimatableProp; value: number; ease: string } | null;
  lastCopied: "layer" | "keyframe" | null;
  load: (sceneId: string, seed?: SceneSeed) => void;
  setMode: (mode: EditorMode) => void;
  setFormat: (format: FormatId) => void;
  select: (id: string | null) => void;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  toggleVisible: (id: string) => void;
  toggleLock: (id: string) => void;
  addLayer: (kind: LayerKind) => void;
  addShape: (shapeType: ShapeType) => void;
  reorderLayer: (id: string, dir: "front" | "back" | "forward" | "backward") => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  copyLayer: (id: string) => void;
  cutLayer: (id: string) => void;
  pasteLayer: () => void;
  setPlayhead: (seconds: number) => void;
  setPlaying: (playing: boolean) => void;
  setKeyframe: (id: string, prop: AnimatableProp, t: number, value: number) => void;
  removeKeyframe: (id: string, prop: AnimatableProp, t: number) => void;
  moveKeyframe: (id: string, prop: AnimatableProp, fromT: number, toT: number) => void;
  setKeyframeEase: (id: string, prop: AnimatableProp, t: number, ease: string) => void;
  selectKeyframe: (kf: SelectedKeyframe | null) => void;
  deleteSelectedKeyframe: () => void;
  copyKeyframe: () => void;
  pasteKeyframe: () => void;
  applyPreset: (id: string, presetId: string) => void;
  clearKeyframes: (id: string) => void;
  addEffect: (id: string, type: EffectType) => void;
  removeEffect: (id: string, fxId: string) => void;
  updateEffectParam: (id: string, fxId: string, key: string, value: number) => void;
  updateEffectColor: (id: string, fxId: string, which: "color" | "color2", color: string) => void;
  toggleEffect: (id: string, fxId: string) => void;
}

function mapEffects(
  layers: Layer[],
  id: string,
  fn: (effects: EffectInstance[]) => EffectInstance[],
): Layer[] {
  return layers.map((l) => (l.id === id ? { ...l, effects: fn(l.effects ?? []) } : l));
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  projectId: null,
  sceneId: null,
  sceneTitle: "Untitled scene",
  sceneLocked: false,
  sceneCache: {},
  mode: "design",
  format: "1:1",
  layers: [],
  keyframes: {},
  selectedId: null,
  selectedKeyframe: null,
  playhead: 0,
  durationS: 5,
  playing: false,
  clipboard: null,
  kfClipboard: null,
  lastCopied: null,
  load: (sceneId, seed) => {
    const s = get();
    if (s.sceneId === sceneId) {
      if (seed) set({ sceneTitle: seed.title ?? s.sceneTitle, sceneLocked: seed.locked ?? s.sceneLocked });
      return;
    }
    // cache the outgoing scene's edits so switching back restores them
    const cache = { ...s.sceneCache };
    if (s.sceneId) cache[s.sceneId] = { layers: s.layers, keyframes: s.keyframes };
    const locked = Boolean(seed?.locked);
    const cached = cache[sceneId];
    if (cached) {
      set({
        sceneId,
        sceneCache: cache,
        layers: cached.layers,
        keyframes: cached.keyframes,
        selectedId: cached.layers[0]?.id ?? null,
        selectedKeyframe: null,
        playhead: 0,
        playing: false,
        sceneTitle: seed?.title ?? s.sceneTitle,
        sceneLocked: locked,
        mode: seed?.mode ?? s.mode,
      });
    } else {
      const layers = locked ? sampleScene().map((l) => ({ ...l, locked: true })) : sampleScene();
      set({
        sceneId,
        sceneCache: cache,
        layers,
        keyframes: { headline: buildPreset("rise-up", 5) ?? {} },
        selectedId: "headline",
        selectedKeyframe: null,
        playhead: 0,
        playing: false,
        sceneTitle: seed?.title ?? "Untitled scene",
        sceneLocked: locked,
        mode: seed?.mode ?? "design",
      });
    }
  },
  setMode: (mode) => set({ mode }),
  setFormat: (format) => set({ format }),
  select: (selectedId) => set({ selectedId, selectedKeyframe: null }),
  updateLayer: (id, patch) =>
    set({ layers: get().layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }),
  toggleVisible: (id) =>
    set({ layers: get().layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)) }),
  toggleLock: (id) =>
    set({ layers: get().layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)) }),
  addLayer: (kind) => {
    const id = `${kind}-${makeId()}`;
    const common = { id, x: 0.3, y: 0.4, w: 0.4, h: 0.18, rotation: 0, opacity: 1, visible: true, locked: false };
    let layer: Layer;
    if (kind === "text") {
      layer = { ...common, kind: "text", name: "New text", text: "Add your text", fontFamily: "Inter", fontSize: 0.06, fontWeight: 600, color: "#ffffff", align: "left", lineHeight: 1.1, letterSpacing: 0 };
    } else if (kind === "image") {
      layer = { ...common, kind: "image", name: "Image", hue: 265 };
    } else {
      layer = { ...common, kind: "shape", name: "Shape", fill: "#6f66e8", radius: 12 };
    }
    set({ layers: [...get().layers, layer], selectedId: id, selectedKeyframe: null });
  },
  addShape: (shapeType) => {
    const id = `shape-${makeId()}`;
    const labels: Record<ShapeType, string> = {
      rect: "Rectangle",
      ellipse: "Ellipse",
      line: "Line",
      triangle: "Triangle",
      diamond: "Diamond",
      pentagon: "Pentagon",
      star: "Star",
      arrow: "Arrow",
    };
    const layer: Layer = {
      id,
      kind: "shape",
      name: labels[shapeType],
      x: 0.32,
      y: 0.34,
      w: 0.36,
      h: shapeType === "line" ? 0.02 : 0.26,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      fill: "#6f66e8",
      radius: shapeType === "rect" ? 12 : 0,
      shapeType,
      strokeColor: "#ffffff",
      strokeWidth: shapeType === "line" ? 4 : 0,
    };
    set({ layers: [...get().layers, layer], selectedId: id, selectedKeyframe: null });
  },
  reorderLayer: (id, dir) =>
    set((s) => {
      const i = s.layers.findIndex((l) => l.id === id);
      if (i < 0) return {};
      const arr = [...s.layers];
      const [item] = arr.splice(i, 1);
      let j = i;
      if (dir === "front") j = arr.length;
      else if (dir === "back") j = 0;
      else if (dir === "forward") j = Math.min(arr.length, i + 1);
      else j = Math.max(0, i - 1);
      arr.splice(j, 0, item);
      return { layers: arr };
    }),
  deleteLayer: (id) =>
    set((s) => {
      const kf = { ...s.keyframes };
      delete kf[id];
      return {
        layers: s.layers.filter((l) => l.id !== id),
        keyframes: kf,
        selectedId: s.selectedId === id ? null : s.selectedId,
        selectedKeyframe: s.selectedId === id ? null : s.selectedKeyframe,
      };
    }),
  duplicateLayer: (id) => {
    const l = get().layers.find((x) => x.id === id);
    if (!l) return;
    const nid = `${l.kind}-${makeId()}`;
    const layer: Layer = { ...l, id: nid, name: `${l.name} copy`, x: clamp01ish(l.x + 0.03), y: clamp01ish(l.y + 0.03) };
    const srcKf = get().keyframes[id];
    set((s) => ({
      layers: [...s.layers, layer],
      keyframes: srcKf ? { ...s.keyframes, [nid]: clone(srcKf) } : s.keyframes,
      selectedId: nid,
      selectedKeyframe: null,
    }));
  },
  copyLayer: (id) => {
    const l = get().layers.find((x) => x.id === id);
    if (!l) return;
    set({ clipboard: { layer: clone(l), keyframes: clone(get().keyframes[id] ?? {}) }, lastCopied: "layer" });
  },
  cutLayer: (id) => {
    get().copyLayer(id);
    get().deleteLayer(id);
  },
  pasteLayer: () => {
    const c = get().clipboard;
    if (!c) return;
    const nid = `${c.layer.kind}-${makeId()}`;
    const layer: Layer = { ...c.layer, id: nid, name: `${c.layer.name} copy`, x: clamp01ish(c.layer.x + 0.03), y: clamp01ish(c.layer.y + 0.03) };
    set((s) => ({
      layers: [...s.layers, layer],
      keyframes: Object.keys(c.keyframes).length ? { ...s.keyframes, [nid]: clone(c.keyframes) } : s.keyframes,
      selectedId: nid,
      selectedKeyframe: null,
    }));
  },
  setPlayhead: (playhead) => set({ playhead }),
  setPlaying: (playing) => set({ playing }),
  setKeyframe: (id, prop, t, value) =>
    set((s) => {
      const lk: LayerKeyframes = { ...(s.keyframes[id] ?? {}) };
      const arr = [...(lk[prop] ?? [])];
      const idx = arr.findIndex((k) => Math.abs(k.t - t) < EPS);
      if (idx >= 0) arr[idx] = { ...arr[idx], value };
      else arr.push({ t: Math.round(t * 100) / 100, value, ease: "EaseOut" });
      arr.sort((a, b) => a.t - b.t);
      lk[prop] = arr;
      return { keyframes: { ...s.keyframes, [id]: lk } };
    }),
  removeKeyframe: (id, prop, t) =>
    set((s) => {
      const lk: LayerKeyframes = { ...(s.keyframes[id] ?? {}) };
      const arr = (lk[prop] ?? []).filter((k) => Math.abs(k.t - t) >= EPS);
      if (arr.length) lk[prop] = arr;
      else delete lk[prop];
      return { keyframes: { ...s.keyframes, [id]: lk } };
    }),
  moveKeyframe: (id, prop, fromT, toT) =>
    set((s) => {
      const lk: LayerKeyframes = { ...(s.keyframes[id] ?? {}) };
      const arr = (lk[prop] ?? []).map((k) => (Math.abs(k.t - fromT) < EPS ? { ...k, t: toT } : k));
      arr.sort((a, b) => a.t - b.t);
      lk[prop] = arr;
      const sk = s.selectedKeyframe;
      return {
        keyframes: { ...s.keyframes, [id]: lk },
        selectedKeyframe: sk && sk.prop === prop && Math.abs(sk.t - fromT) < EPS ? { prop, t: toT } : sk,
      };
    }),
  setKeyframeEase: (id, prop, t, ease) =>
    set((s) => {
      const lk: LayerKeyframes = { ...(s.keyframes[id] ?? {}) };
      lk[prop] = (lk[prop] ?? []).map((k) => (Math.abs(k.t - t) < EPS ? { ...k, ease } : k));
      return { keyframes: { ...s.keyframes, [id]: lk } };
    }),
  selectKeyframe: (selectedKeyframe) => set({ selectedKeyframe }),
  deleteSelectedKeyframe: () => {
    const { selectedId, selectedKeyframe } = get();
    if (!selectedId || !selectedKeyframe) return;
    get().removeKeyframe(selectedId, selectedKeyframe.prop, selectedKeyframe.t);
    set({ selectedKeyframe: null });
  },
  copyKeyframe: () => {
    const { selectedId, selectedKeyframe, keyframes } = get();
    if (!selectedId || !selectedKeyframe) return;
    const k = (keyframes[selectedId]?.[selectedKeyframe.prop] ?? []).find(
      (x) => Math.abs(x.t - selectedKeyframe.t) < EPS,
    );
    if (k) set({ kfClipboard: { prop: selectedKeyframe.prop, value: k.value, ease: k.ease }, lastCopied: "keyframe" });
  },
  pasteKeyframe: () => {
    const { kfClipboard, selectedId, playhead } = get();
    if (!kfClipboard || !selectedId) return;
    set((s) => {
      const lk: LayerKeyframes = { ...(s.keyframes[selectedId] ?? {}) };
      const arr = [...(lk[kfClipboard.prop] ?? [])];
      const i = arr.findIndex((k) => Math.abs(k.t - playhead) < EPS);
      const entry = { t: Math.round(playhead * 100) / 100, value: kfClipboard.value, ease: kfClipboard.ease };
      if (i >= 0) arr[i] = entry;
      else arr.push(entry);
      arr.sort((a, b) => a.t - b.t);
      lk[kfClipboard.prop] = arr;
      return { keyframes: { ...s.keyframes, [selectedId]: lk }, selectedKeyframe: { prop: kfClipboard.prop, t: entry.t } };
    });
  },
  applyPreset: (id, presetId) => {
    const kf = buildPreset(presetId, get().durationS);
    if (!kf) return;
    set((s) => ({ keyframes: { ...s.keyframes, [id]: kf } }));
  },
  clearKeyframes: (id) =>
    set((s) => {
      const next = { ...s.keyframes };
      delete next[id];
      return { keyframes: next, selectedKeyframe: null };
    }),
  addEffect: (id, type) => {
    const def = EFFECT_CATALOG.find((d) => d.type === type);
    if (!def) return;
    const params: Record<string, number> = {};
    def.params.forEach((p) => (params[p.key] = p.default));
    const eff: EffectInstance = {
      id: `fx-${makeId()}`,
      type,
      enabled: true,
      params,
      ...(def.color ? { color: "#6f66e8" } : {}),
      ...(def.color2 ? { color2: "#0b0b10" } : {}),
    };
    set((s) => ({ layers: mapEffects(s.layers, id, (fx) => [...fx, eff]) }));
  },
  removeEffect: (id, fxId) =>
    set((s) => ({ layers: mapEffects(s.layers, id, (fx) => fx.filter((e) => e.id !== fxId)) })),
  updateEffectParam: (id, fxId, key, value) =>
    set((s) => ({
      layers: mapEffects(s.layers, id, (fx) =>
        fx.map((e) => (e.id === fxId ? { ...e, params: { ...e.params, [key]: value } } : e)),
      ),
    })),
  updateEffectColor: (id, fxId, which, color) =>
    set((s) => ({
      layers: mapEffects(s.layers, id, (fx) =>
        fx.map((e) => (e.id === fxId ? { ...e, [which]: color } : e)),
      ),
    })),
  toggleEffect: (id, fxId) =>
    set((s) => ({
      layers: mapEffects(s.layers, id, (fx) =>
        fx.map((e) => (e.id === fxId ? { ...e, enabled: !e.enabled } : e)),
      ),
    })),
}));
