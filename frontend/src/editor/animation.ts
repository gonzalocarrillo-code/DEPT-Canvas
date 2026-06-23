import type { CSSProperties } from "react";
import type { Keyframe, LayerKeyframes } from "./types";

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** Evaluate a CSS-style cubic-bezier(x1,y1,x2,y2) at progress x (0..1). */
export function cubicBezierAt(x1: number, y1: number, x2: number, y2: number, x: number): number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  let t = x;
  for (let i = 0; i < 6; i++) {
    const xErr = sampleX(t) - x;
    const d = dX(t);
    if (Math.abs(xErr) < 1e-4 || d === 0) break;
    t -= xErr / d;
  }
  return sampleY(clamp01(t));
}

function parseBezier(name: string): [number, number, number, number] | null {
  if (!name.startsWith("cubic-bezier(")) return null;
  const nums = name.slice(13, -1).split(",").map((n) => Number(n.trim()));
  return nums.length === 4 && nums.every((n) => !Number.isNaN(n))
    ? [nums[0], nums[1], nums[2], nums[3]]
    : null;
}

/** Easing by name OR cubic-bezier(...) string. Exported for the speed-graph curve. */
export function ease(name: string, p: number): number {
  const bz = parseBezier(name);
  if (bz) return cubicBezierAt(bz[0], bz[1], bz[2], bz[3], p);
  switch (name) {
    case "Linear":
      return p;
    case "EaseIn":
    case "EaseInQuad":
      return p * p;
    case "EaseInCubic":
      return p * p * p;
    case "EaseOut":
    case "EaseOutQuad":
      return 1 - (1 - p) * (1 - p);
    case "EaseOutCubic":
      return 1 - Math.pow(1 - p, 3);
    case "EaseInOut":
    case "EaseInOutQuad":
    case "EaseInOutCubic":
      return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    case "EaseOutBack": {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    }
    case "EaseInBack": {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return c3 * p * p * p - c1 * p * p;
    }
    case "Spring":
    case "EaseOutElastic": {
      if (p === 0 || p === 1) return p;
      const c4 = (2 * Math.PI) / 3;
      return Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * c4) + 1;
    }
    default:
      return 1 - (1 - p) * (1 - p);
  }
}

/** Interpolated value of a keyframe track at time `t` (holds at the ends). */
export function valueAt(kfs: Keyframe[] | undefined, t: number, fallback: number): number {
  if (!kfs || kfs.length === 0) return fallback;
  const s = [...kfs].sort((a, b) => a.t - b.t);
  if (t <= s[0].t) return s[0].value;
  const last = s[s.length - 1];
  if (t >= last.t) return last.value;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i];
    const b = s[i + 1];
    if (t >= a.t && t <= b.t) {
      const p = clamp01((t - a.t) / (b.t - a.t || 1));
      return a.value + (b.value - a.value) * ease(b.ease, p);
    }
  }
  return fallback;
}

/** Transform/opacity for a layer at time `t` from its keyframe tracks. */
export function animatedStyle(kf: LayerKeyframes | undefined, t: number): CSSProperties {
  if (!kf) return {};
  const x = valueAt(kf.x, t, 0);
  const y = valueAt(kf.y, t, 0);
  const scale = valueAt(kf.scale, t, 1);
  const rot = valueAt(kf.rotation, t, 0);
  const op = valueAt(kf.opacity, t, 1);
  return {
    transform: `translate(${x}%, ${y}%) scale(${scale}) rotate(${rot}deg)`,
    opacity: op,
  };
}

/** Normalized motion speed at time t (for velocity-based motion blur). */
export function motionSpeed(kf: LayerKeyframes | undefined, t: number): number {
  if (!kf) return 0;
  const dt = 0.03;
  const dx = (valueAt(kf.x, t + dt, 0) - valueAt(kf.x, t, 0)) / dt;
  const dy = (valueAt(kf.y, t + dt, 0) - valueAt(kf.y, t, 0)) / dt;
  const ds = ((valueAt(kf.scale, t + dt, 1) - valueAt(kf.scale, t, 1)) / dt) * 100;
  return Math.sqrt(dx * dx + dy * dy + ds * ds) / 100;
}

export function hasKeyframes(kf: LayerKeyframes | undefined): boolean {
  return Boolean(kf) && Object.values(kf as object).some((arr) => Array.isArray(arr) && arr.length > 0);
}
