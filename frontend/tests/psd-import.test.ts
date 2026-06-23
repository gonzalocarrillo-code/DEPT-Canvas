import { describe, it, expect } from "vitest";
import { writePsd, type Psd } from "ag-psd";
import { parsePsd } from "@/editor/psdImport";

function imgData(width: number, height: number) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

// Build a PSD in-memory: a styled text layer, two separate raster layers, and a
// group — round-tripped through ag-psd so no binary fixture or canvas is needed.
function buildFixture(): ArrayBuffer {
  const psd = {
    width: 200,
    height: 120,
    imageData: imgData(200, 120),
    children: [
      {
        name: "Headline",
        left: 20,
        top: 10,
        right: 180,
        bottom: 40,
        text: {
          text: "Hello",
          style: { font: { name: "Arial" }, fontSize: 24, fillColor: { r: 255, g: 0, b: 0 } },
          paragraphStyle: { justification: "center" },
        },
      },
      { name: "Photo A", left: 0, top: 50, right: 100, bottom: 110, imageData: imgData(100, 60) },
      {
        name: "Group",
        opened: true,
        children: [
          { name: "Photo B", left: 110, top: 50, right: 200, bottom: 110, imageData: imgData(90, 60) },
        ],
      },
    ],
  };
  return writePsd(psd as unknown as Psd);
}

describe("PSD import → editor layers", () => {
  const scene = parsePsd(buildFixture(), { skipPixels: true });

  it("reads the document size", () => {
    expect(scene.width).toBe(200);
    expect(scene.height).toBe(120);
  });

  it("keeps text as an EDITABLE text layer with font + color + align", () => {
    const text = scene.layers.find((l) => l.kind === "text");
    expect(text).toBeTruthy();
    expect(text!.text).toBe("Hello");
    expect(text!.fontFamily).toBe("Arial");
    expect(text!.color?.toLowerCase()).toBe("#ff0000");
    expect(text!.align).toBe("center");
    // font size stored as a fraction of width (24px / 200)
    expect(text!.fontSize).toBeCloseTo(0.12, 3);
  });

  it("separates each raster into its OWN image layer", () => {
    const images = scene.layers.filter((l) => l.kind === "image");
    expect(images).toHaveLength(2);
    expect(images.map((i) => i.name).sort()).toEqual(["Photo A", "Photo B"]);
  });

  it("flattens groups but preserves every layer in order", () => {
    expect(scene.layers).toHaveLength(3);
    expect(scene.layers.map((l) => l.name)).toEqual(["Headline", "Photo A", "Photo B"]);
  });

  it("normalizes coordinates to 0..1 of the document", () => {
    for (const l of scene.layers) {
      expect(l.x).toBeGreaterThanOrEqual(0);
      expect(l.x).toBeLessThanOrEqual(1);
      expect(l.w).toBeGreaterThan(0);
      expect(l.w).toBeLessThanOrEqual(1);
    }
    const photoA = scene.layers.find((l) => l.name === "Photo A")!;
    expect(photoA.x).toBeCloseTo(0, 3);
    expect(photoA.w).toBeCloseTo(0.5, 3); // 100 / 200
  });
});
