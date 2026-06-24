// Single source of truth for graph layout math. Imported by seed.ts and store.ts so
// the demo seed and live fan-out stay identical. Pure math — no React, unit-testable.
//
// Reading order is left → right: design master → one node per layer → variations.
// Variations fan into a near-square GRID (not a tall column) so a 24-wide fan-out
// reads as a field that fits the viewport instead of an overflowing strip.

export const GRID = 20; // snapGrid unit; programmatic positions align to it where it matters
export const DESIGN_X = 0;
export const LAYER_X = 360; // design card is w-60 (240px) → ~120px clearance
export const VAR_X0 = 760; // first variation column; layer right edge ~584 → ~176px gutter for edge labels
export const COL_PITCH = 300; // variation column stride (224 card + 76 gutter)
export const VAR_ROW = 180; // variation row stride (~150 card + 30 gutter)
export const ROW = 132; // layer-column pitch (unchanged — only affects the layer band + design colY)
export const MAX_COLS = 6; // grid width cap
export const MAX_VARIATIONS = 24; // cost/perf ceiling on a single fan-out

/** Near-square column count for `total` variations, capped at MAX_COLS. */
export function varCols(total: number): number {
  return Math.max(1, Math.min(MAX_COLS, Math.ceil(Math.sqrt(Math.max(1, total)))));
}

/**
 * Position for one variation in the grid.
 * @param index  global 0-based index across the whole variation set (incl. pre-existing)
 * @param total  final variation count (drives the column count)
 * @param centerY  the y the block is vertically centered on (usually the layer-column midpoint)
 */
export function variationSlot(index: number, total: number, centerY = 0): { x: number; y: number } {
  const cols = varCols(total);
  const rows = Math.ceil(total / cols);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const blockH = (rows - 1) * VAR_ROW;
  return { x: VAR_X0 + col * COL_PITCH, y: centerY - blockH / 2 + row * VAR_ROW };
}

/** The layer-column midpoint — equals the design node's y (vertically centered on the band). */
export function layerCenterY(layerCount: number): number {
  return ((layerCount - 1) * ROW) / 2;
}

/** Position for layer `i` in the layer column. */
export function layoutLayer(i: number): { x: number; y: number } {
  return { x: LAYER_X, y: i * ROW };
}
