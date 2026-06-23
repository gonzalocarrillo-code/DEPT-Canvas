import type { LayerKeyframes } from "./types";

// The motion preset bank — keyframe templates the inspector applies and the AI
// references when authoring workflows. Each preset lays down real keyframes
// (position / scale / rotation / opacity over time).
export interface MotionPreset {
  id: string;
  label: string;
  group: "Entrance" | "Emphasis" | "Move" | "Loop" | "Exit";
  build: (duration: number) => LayerKeyframes;
}

export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: "fade-in",
    label: "Fade in",
    group: "Entrance",
    build: () => ({ opacity: [{ t: 0, value: 0, ease: "EaseOut" }, { t: 0.5, value: 1, ease: "EaseOut" }] }),
  },
  {
    id: "slide-left",
    label: "Slide in ←",
    group: "Entrance",
    build: () => ({
      x: [{ t: 0, value: -60, ease: "EaseOutBack" }, { t: 0.6, value: 0, ease: "EaseOutBack" }],
      opacity: [{ t: 0, value: 0, ease: "EaseOut" }, { t: 0.35, value: 1, ease: "EaseOut" }],
    }),
  },
  {
    id: "rise-up",
    label: "Rise up",
    group: "Entrance",
    build: () => ({
      y: [{ t: 0, value: 45, ease: "EaseOut" }, { t: 0.6, value: 0, ease: "EaseOut" }],
      opacity: [{ t: 0, value: 0, ease: "EaseOut" }, { t: 0.35, value: 1, ease: "EaseOut" }],
    }),
  },
  {
    id: "zoom-in",
    label: "Zoom in",
    group: "Entrance",
    build: () => ({
      scale: [{ t: 0, value: 0.6, ease: "EaseOutBack" }, { t: 0.6, value: 1, ease: "EaseOutBack" }],
      opacity: [{ t: 0, value: 0, ease: "EaseOut" }, { t: 0.35, value: 1, ease: "EaseOut" }],
    }),
  },
  {
    id: "pop-in",
    label: "Pop in",
    group: "Entrance",
    build: () => ({
      scale: [
        { t: 0, value: 0.5, ease: "EaseOutBack" },
        { t: 0.45, value: 1.06, ease: "EaseOut" },
        { t: 0.6, value: 1, ease: "EaseOut" },
      ],
      opacity: [{ t: 0, value: 0, ease: "EaseOut" }, { t: 0.3, value: 1, ease: "EaseOut" }],
    }),
  },
  {
    id: "get-bigger",
    label: "Get bigger",
    group: "Emphasis",
    build: (d) => ({ scale: [{ t: 0, value: 1, ease: "EaseInOut" }, { t: d, value: 1.18, ease: "EaseInOut" }] }),
  },
  {
    id: "pulse",
    label: "Pulse",
    group: "Loop",
    build: (d) => ({
      scale: [
        { t: 0, value: 1, ease: "EaseInOut" },
        { t: d / 2, value: 1.07, ease: "EaseInOut" },
        { t: d, value: 1, ease: "EaseInOut" },
      ],
    }),
  },
  {
    id: "spin",
    label: "Spin",
    group: "Emphasis",
    build: (d) => ({ rotation: [{ t: 0, value: 0, ease: "Linear" }, { t: d, value: 360, ease: "Linear" }] }),
  },
  {
    id: "drift-right",
    label: "Drift right",
    group: "Move",
    build: (d) => ({ x: [{ t: 0, value: 0, ease: "Linear" }, { t: d, value: 22, ease: "Linear" }] }),
  },
  {
    id: "ken-burns",
    label: "Ken Burns",
    group: "Move",
    build: (d) => ({
      scale: [{ t: 0, value: 1, ease: "EaseInOut" }, { t: d, value: 1.2, ease: "EaseInOut" }],
      x: [{ t: 0, value: 0, ease: "EaseInOut" }, { t: d, value: -8, ease: "EaseInOut" }],
    }),
  },
  {
    id: "fade-out",
    label: "Fade out",
    group: "Exit",
    build: (d) => ({ opacity: [{ t: Math.max(0, d - 0.6), value: 1, ease: "EaseIn" }, { t: d, value: 0, ease: "EaseIn" }] }),
  },
];

export const MOTION_PRESET_IDS = MOTION_PRESETS.map((p) => p.id);

export function buildPreset(id: string, duration: number): LayerKeyframes | null {
  return MOTION_PRESETS.find((p) => p.id === id)?.build(duration) ?? null;
}
