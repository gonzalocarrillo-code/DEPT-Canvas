export type EditorMode = "design" | "animate";
export type LayerKind = "text" | "image" | "shape";
export type TextAlign = "left" | "center" | "right";
export type ShapeType =
  | "rect"
  | "ellipse"
  | "line"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "star"
  | "arrow";

export type EffectType = "adjust" | "blur" | "glow" | "shadow" | "vignette" | "duotone";

export interface EffectInstance {
  id: string;
  type: EffectType;
  enabled: boolean;
  params: Record<string, number>;
  color?: string;
  color2?: string;
}

export interface Layer {
  id: string;
  name: string;
  kind: LayerKind;
  // Normalized 0..1 of the artboard (so layers scale across every format).
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  // text / shape label
  text?: string;
  fontFamily?: string;
  fontSize?: number; // fraction of artboard width (rendered via cqw)
  fontWeight?: number;
  color?: string;
  align?: TextAlign;
  lineHeight?: number;
  letterSpacing?: number; // em
  // image
  hue?: number;
  // shape
  fill?: string;
  radius?: number; // px
  shapeType?: ShapeType;
  strokeColor?: string;
  strokeWidth?: number; // px
  // effects
  blendMode?: string;
  motionBlur?: boolean;
  effects?: EffectInstance[];
}

export const SHAPE_LIBRARY: { type: ShapeType; label: string }[] = [
  { type: "rect", label: "Rectangle" },
  { type: "ellipse", label: "Ellipse" },
  { type: "line", label: "Line" },
  { type: "triangle", label: "Triangle" },
  { type: "diamond", label: "Diamond" },
  { type: "pentagon", label: "Pentagon" },
  { type: "star", label: "Star" },
  { type: "arrow", label: "Arrow" },
];

export interface EffectParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}
export interface EffectDef {
  type: EffectType;
  label: string;
  params: EffectParamDef[];
  color?: boolean;
  color2?: boolean;
}

// The effect catalog (subset of CE.SDK's 22 effect types — extend from
// EDITOR_FEATURES_ROADMAP.md). Each maps to a CE.SDK createEffect type at the seam.
export const EFFECT_CATALOG: EffectDef[] = [
  {
    type: "adjust",
    label: "Adjust color",
    params: [
      { key: "brightness", label: "Brightness", min: 0, max: 2, step: 0.05, default: 1 },
      { key: "contrast", label: "Contrast", min: 0, max: 2, step: 0.05, default: 1 },
      { key: "saturation", label: "Saturation", min: 0, max: 2, step: 0.05, default: 1 },
    ],
  },
  {
    type: "blur",
    label: "Blur",
    params: [{ key: "amount", label: "Amount", min: 0, max: 30, step: 1, default: 6 }],
  },
  {
    type: "glow",
    label: "Glow",
    params: [{ key: "size", label: "Size", min: 0, max: 40, step: 1, default: 16 }],
    color: true,
  },
  {
    type: "shadow",
    label: "Drop shadow",
    params: [
      { key: "x", label: "X", min: -40, max: 40, step: 1, default: 0 },
      { key: "y", label: "Y", min: -40, max: 40, step: 1, default: 8 },
      { key: "blur", label: "Blur", min: 0, max: 40, step: 1, default: 12 },
    ],
  },
  {
    type: "vignette",
    label: "Vignette",
    params: [{ key: "darkness", label: "Darkness", min: 0, max: 1, step: 0.05, default: 0.5 }],
  },
  {
    type: "duotone",
    label: "Duotone",
    params: [{ key: "intensity", label: "Intensity", min: 0, max: 1, step: 0.05, default: 0.7 }],
    color: true,
    color2: true,
  },
];

// CSS mix-blend-mode values (map 1:1 to CE.SDK blend modes).
export const BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
];

export const FORMATS = {
  "1:1": { label: "1:1", w: 1080, h: 1080 },
  "4:5": { label: "4:5", w: 1080, h: 1350 },
  "9:16": { label: "9:16", w: 1080, h: 1920 },
  "16:9": { label: "16:9", w: 1920, h: 1080 },
} as const;
export type FormatId = keyof typeof FORMATS;

export type AnimationSlot = "in" | "loop" | "out";
export interface PresetAnim {
  preset: string;
  durationS: number;
  easing: string;
}
export type AnimationSpec = Partial<Record<AnimationSlot, PresetAnim>>;

// NOTE: the Tier-1 preset + easing catalogs MUST be read live from the engine
// (findAllProperties / query_animatable) once CE.SDK is connected. These lists mirror
// the verified Phase-0 findings and serve only the pre-engine mock UI.
export const IN_PRESETS = ["slide", "fade", "zoom", "blur", "wipe", "pop", "spin", "grow"];
export const OUT_PRESETS = IN_PRESETS;
export const LOOP_PRESETS = ["breathing", "pulsing", "spin", "sway", "blur", "squeeze"];
// ── Keyframe (Tier-2 craft) animation model ─────────────────────────────────
export type AnimatableProp = "x" | "y" | "scale" | "rotation" | "opacity";

export interface Keyframe {
  t: number; // seconds
  value: number;
  ease: string;
}

export type LayerKeyframes = Partial<Record<AnimatableProp, Keyframe[]>>;

export interface AnimatablePropMeta {
  prop: AnimatableProp;
  label: string;
  fallback: number;
  min: number;
  max: number;
  step: number;
  unit: string;
}

export const ANIMATABLE_PROPS: AnimatablePropMeta[] = [
  { prop: "x", label: "Position X", fallback: 0, min: -100, max: 100, step: 1, unit: "%" },
  { prop: "y", label: "Position Y", fallback: 0, min: -100, max: 100, step: 1, unit: "%" },
  { prop: "scale", label: "Scale", fallback: 1, min: 0, max: 3, step: 0.05, unit: "×" },
  { prop: "rotation", label: "Rotation", fallback: 0, min: -360, max: 360, step: 1, unit: "°" },
  { prop: "opacity", label: "Opacity", fallback: 1, min: 0, max: 1, step: 0.05, unit: "" },
];

export const EASINGS = [
  "Linear",
  "EaseIn",
  "EaseOut",
  "EaseInOut",
  "EaseInQuad",
  "EaseOutQuad",
  "EaseInOutQuad",
  "EaseInCubic",
  "EaseOutCubic",
  "EaseInOutCubic",
  "EaseInBack",
  "EaseOutBack",
  "EaseInOutBack",
  "EaseInElastic",
  "EaseOutElastic",
  "Spring",
];
