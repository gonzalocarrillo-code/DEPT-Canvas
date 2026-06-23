import type { EffectInstance } from "./types";

export interface VignetteOverlay {
  darkness: number;
}

// Compose an ordered effect stack into a CSS filter string + any overlay effects
// (vignette) the mock renders as a separate element. Maps 1:1 to CE.SDK's effect
// stack at the seam (each instance -> createEffect/appendEffect).
export function composeEffects(effects: EffectInstance[] | undefined): {
  filter: string;
  vignette: VignetteOverlay | null;
} {
  const parts: string[] = [];
  let vignette: VignetteOverlay | null = null;
  for (const e of effects ?? []) {
    if (!e.enabled) continue;
    const p = e.params;
    switch (e.type) {
      case "adjust":
        parts.push(
          `brightness(${p.brightness ?? 1}) contrast(${p.contrast ?? 1}) saturate(${p.saturation ?? 1})`,
        );
        break;
      case "blur":
        parts.push(`blur(${p.amount ?? 0}px)`);
        break;
      case "glow":
        parts.push(`drop-shadow(0 0 ${p.size ?? 16}px ${e.color ?? "#6f66e8"})`);
        break;
      case "shadow":
        parts.push(
          `drop-shadow(${p.x ?? 0}px ${p.y ?? 8}px ${p.blur ?? 12}px rgba(0,0,0,0.55))`,
        );
        break;
      case "duotone":
        // Rough mock approximation; the real duotone runs as a CE.SDK effect.
        parts.push(`grayscale(1) sepia(${p.intensity ?? 0.7}) saturate(2.2)`);
        break;
      case "vignette":
        vignette = { darkness: p.darkness ?? 0.5 };
        break;
    }
  }
  return { filter: parts.join(" "), vignette };
}
