import { describe, it, expect } from "vitest";
import { parseSvg } from "@/editor/svgImport";

// Illustrator → SVG on-ramp: every element is maintained as its own layer.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
  <defs><linearGradient id="g"/></defs>
  <text id="Headline" x="40" y="60" font-size="32" font-family="Arial" fill="#ff0000" text-anchor="middle">Hello</text>
  <image id="Photo" href="data:image/png;base64,AAAA" x="0" y="100" width="200" height="100"/>
  <rect id="Box" x="220" y="110" width="160" height="80" fill="#00ff00" rx="8"/>
  <g id="Layer 2">
    <rect id="Inner" x="240" y="20" width="100" height="40" fill="#0000ff"/>
  </g>
</svg>`;

describe("SVG import → editor layers (maintains all layers)", () => {
  const scene = parseSvg(SVG);

  it("reads the viewBox as document size", () => {
    expect(scene.width).toBe(400);
    expect(scene.height).toBe(200);
  });

  it("keeps text as an editable text layer with font + color + align", () => {
    const t = scene.layers.find((l) => l.kind === "text");
    expect(t?.text).toBe("Hello");
    expect(t?.fontFamily).toBe("Arial");
    expect(t?.color?.toLowerCase()).toBe("#ff0000");
    expect(t?.align).toBe("center");
  });

  it("maps image, rects, and group children — flattened, in order, skipping defs", () => {
    expect(scene.layers.map((l) => l.name)).toEqual(["Headline", "Photo", "Box", "Inner"]);
    const image = scene.layers.find((l) => l.name === "Photo")!;
    expect(image.kind).toBe("image");
    expect(image.src).toContain("base64");
    const box = scene.layers.find((l) => l.name === "Box")!;
    expect(box.kind).toBe("shape");
    expect(box.shapeType).toBe("rect");
    expect(box.fill?.toLowerCase()).toBe("#00ff00");
  });

  it("normalizes coordinates to 0..1 of the viewBox", () => {
    const box = scene.layers.find((l) => l.name === "Box")!;
    expect(box.x).toBeCloseTo(0.55, 3); // 220 / 400
    expect(box.w).toBeCloseTo(0.4, 3); // 160 / 400
    const image = scene.layers.find((l) => l.name === "Photo")!;
    expect(image.y).toBeCloseTo(0.5, 3); // 100 / 200
  });
});
