import { readPsd, type Layer as PsdLayer } from "ag-psd";
import type { Layer, TextAlign } from "./types";

// Client-side PSD import (license-free). Maps a Photoshop file into the editor's
// Layer model: text layers stay EDITABLE text (font/size/color preserved), each
// raster layer becomes its OWN image layer, groups are flattened (order kept),
// and all geometry is normalized to 0..1 of the document so it scales to any
// format. The authoritative production import is server-side via CE.SDK's
// @imgly/psd-importer; this is the instant, no-license path the editor consumes.

export interface ImportedScene {
  width: number;
  height: number;
  layers: Layer[];
  warnings: string[];
}

function makeId(): string {
  try {
    return `psd-${crypto.randomUUID().slice(0, 8)}`;
  } catch {
    return `psd-${Math.floor(Math.random() * 1e9).toString(36)}`;
  }
}

function toHex(color: unknown): string | undefined {
  const c = color as { r?: number; g?: number; b?: number } | undefined;
  if (!c || typeof c.r !== "number") return undefined;
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(c.r)}${h(c.g ?? 0)}${h(c.b ?? 0)}`;
}

function alignOf(node: PsdLayer): TextAlign {
  const j = node.text?.paragraphStyle?.justification;
  if (j === "center") return "center";
  if (j === "right") return "right";
  return "left";
}

function toDataUrl(canvas: unknown): string | undefined {
  const c = canvas as { toDataURL?: (t?: string) => string } | undefined;
  try {
    return c && typeof c.toDataURL === "function" ? c.toDataURL("image/png") : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parse a .psd into an editable scene.
 * @param opts.skipPixels - skip raster decode (used in headless tests with no canvas).
 */
export function parsePsd(buffer: ArrayBuffer, opts: { skipPixels?: boolean } = {}): ImportedScene {
  const psd = readPsd(buffer, {
    skipLayerImageData: opts.skipPixels ?? false,
    skipCompositeImageData: true,
    skipThumbnail: true,
    useImageData: false,
  });
  const W = psd.width || 1;
  const H = psd.height || 1;
  const layers: Layer[] = [];
  const warnings = new Set<string>();

  const visit = (nodes: PsdLayer[] | undefined) => {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.children) {
        visit(node.children); // flatten groups, preserve order
        continue;
      }
      const left = node.left ?? 0;
      const top = node.top ?? 0;
      const right = node.right ?? left;
      const bottom = node.bottom ?? top;
      const x = left / W;
      const y = top / H;
      let w = Math.max(0, right - left) / W;
      let h = Math.max(0, bottom - top) / H;

      if (node.text) {
        const style = node.text.style ?? {};
        const px = typeof style.fontSize === "number" ? style.fontSize : 0.05 * W;
        // Text layer bounds come from rendered glyphs; if a PSD reports degenerate
        // bounds, give the editable text a sensible visible box instead of 0×0.
        if (w <= 0.002) w = Math.max(0.2, Math.min(0.85, 1 - x));
        if (h <= 0.002) h = Math.max((px / W) * 1.6, 0.06);
      }

      const common = {
        id: makeId(),
        name: node.name ?? "Layer",
        x,
        y,
        w,
        h,
        rotation: 0,
        opacity: (node.opacity ?? 255) / 255,
        visible: !node.hidden,
        locked: false,
      };

      if (node.text) {
        const style = node.text.style ?? {};
        const px = typeof style.fontSize === "number" ? style.fontSize : 0.05 * W;
        if (node.text.styleRuns && node.text.styleRuns.length > 1) {
          warnings.add("Mixed text styles in a layer were collapsed to the dominant run.");
        }
        layers.push({
          ...common,
          kind: "text",
          text: node.text.text ?? "",
          fontFamily: style.font?.name ?? "Inter",
          fontSize: px / W, // editor stores font size as a fraction of width (cqw)
          fontWeight: style.fauxBold || /bold/i.test(style.font?.name ?? "") ? 700 : 400,
          color: toHex(style.fillColor) ?? "#ffffff",
          align: alignOf(node),
          lineHeight: 1.15,
          letterSpacing: 0,
        });
      } else {
        const src = node.canvas ? toDataUrl(node.canvas) : undefined;
        layers.push({ ...common, kind: "image", hue: 230, ...(src ? { src } : {}) });
      }
    }
  };

  visit(psd.children);
  if (layers.length === 0) warnings.add("No layers found in the PSD.");
  return { width: W, height: H, layers, warnings: [...warnings] };
}
