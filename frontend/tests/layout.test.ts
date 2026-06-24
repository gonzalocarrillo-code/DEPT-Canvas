import { describe, it, expect } from "vitest";
import { variationSlot, varCols, VAR_X0, COL_PITCH, MAX_COLS } from "@/graph/layout";

describe("graph layout — variation grid", () => {
  it("lays two variations side by side on one row", () => {
    const a = variationSlot(0, 2, 0);
    const b = variationSlot(1, 2, 0);
    expect(a).toEqual({ x: VAR_X0, y: 0 });
    expect(b).toEqual({ x: VAR_X0 + COL_PITCH, y: 0 }); // same row, next column
  });

  it("uses a wide, column-capped grid that never exceeds the item count", () => {
    expect(varCols(1)).toBe(1); // never more columns than variations
    expect(varCols(2)).toBe(2);
    expect(varCols(9)).toBe(5); // width-biased: ceil(sqrt(9*1.8))=5
    expect(varCols(24)).toBe(7); // ceil(sqrt(24*1.8))=7, under the cap
    expect(varCols(100)).toBe(MAX_COLS); // capped at 10
  });

  it("keeps a 24-fan-out within 5 columns and aligned to the column pitch", () => {
    const total = 24;
    const cols = varCols(total); // 5
    let maxX = -Infinity;
    for (let i = 0; i < total; i++) {
      const { x } = variationSlot(i, total);
      const offset = x - VAR_X0;
      expect(offset % COL_PITCH).toBe(0); // every column lands on the pitch
      expect(offset / COL_PITCH).toBeLessThan(cols); // never exceeds the column count
      maxX = Math.max(maxX, x);
    }
    expect(maxX).toBe(VAR_X0 + (cols - 1) * COL_PITCH); // widest column = 4th
  });

  it("centers the block vertically on the given centerY", () => {
    // total=2 → 1 row → block height 0 → both at centerY
    expect(variationSlot(0, 2, 500).y).toBe(500);
    // total=12 → cols 5, rows 3 → block spans rows, centered on centerY
    const top = variationSlot(0, 12, 0).y;
    const bottom = variationSlot(11, 12, 0).y;
    expect(top).toBeLessThan(0);
    expect(bottom).toBeGreaterThan(0);
  });
});
