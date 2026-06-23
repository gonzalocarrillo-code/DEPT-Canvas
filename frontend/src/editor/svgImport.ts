import type { ImportedScene } from "./psdImport";
import type { Layer, ShapeType, TextAlign } from "./types";

// SVG import — the realistic editable on-ramp for Illustrator artwork (export
// .ai → SVG, which preserves layers/elements). Each element becomes its OWN
// editor layer: <text> → editable text, <image> → image, rect/circle/ellipse/
// line → shape, and arbitrary vectors (<path>/<polygon>/…) are kept as their own
// layer by inlining that element into a standalone SVG image (appearance
// preserved). Groups are flattened in order, so all layers are maintained.

function makeId(): string {
  try {
    return `svg-${crypto.randomUUID().slice(0, 8)}`;
  } catch {
    return `svg-${Math.floor(Math.random() * 1e9).toString(36)}`;
  }
}

function num(v: string | null | undefined, fallback = 0): number {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? n : fallback;
}

function attr(el: Element, name: string): string | null {
  return el.getAttribute(name);
}

function fillOf(el: Element): string | undefined {
  const f = attr(el, "fill") ?? styleProp(el, "fill");
  if (!f || f === "none") return undefined;
  return f;
}

function styleProp(el: Element, prop: string): string | undefined {
  const style = attr(el, "style");
  if (!style) return undefined;
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(style);
  return m ? m[1].trim() : undefined;
}

function nameOf(el: Element, tag: string): string {
  return (
    attr(el, "id") ||
    attr(el, "inkscape:label") ||
    attr(el, "aria-label") ||
    tag
  );
}

const SHAPE_TAGS: Record<string, ShapeType> = {
  rect: "rect",
  circle: "ellipse",
  ellipse: "ellipse",
  line: "line",
};
const RASTER_TAGS = new Set(["path", "polygon", "polyline"]);
const SKIP_TAGS = new Set(["defs", "title", "desc", "metadata", "style", "clippath", "lineargradient", "radialgradient", "filter", "symbol", "marker"]);

export function parseSvg(svgText: string): ImportedScene {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() === "parsererror" || root.querySelector("parsererror")) {
    return { width: 1, height: 1, layers: [], warnings: ["Could not parse the SVG."] };
  }

  let W = 1;
  let H = 1;
  const vb = root.getAttribute("viewBox");
  if (vb) {
    const p = vb.split(/[\s,]+/).map(Number);
    W = p[2] || 1;
    H = p[3] || 1;
  } else {
    W = num(root.getAttribute("width"), 1);
    H = num(root.getAttribute("height"), 1);
  }

  const layers: Layer[] = [];
  const warnings = new Set<string>();

  const bbox = (el: Element): { x: number; y: number; w: number; h: number } => {
    const g = el as unknown as { getBBox?: () => { x: number; y: number; width: number; height: number } };
    try {
      if (typeof g.getBBox === "function") {
        const b = g.getBBox();
        if (b.width > 0 || b.height > 0) return { x: b.x / W, y: b.y / H, w: b.width / W, h: b.height / H };
      }
    } catch {
      // getBBox needs layout (browser only); fall back to the full canvas
    }
    return { x: 0, y: 0, w: 1, h: 1 };
  };

  const rasterize = (el: Element): string => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${el.outerHTML}</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  };

  const visit = (parent: Element) => {
    for (const el of Array.from(parent.children)) {
      const tag = el.tagName.toLowerCase();
      if (tag === "g") {
        visit(el); // flatten groups, preserve order
        continue;
      }
      if (SKIP_TAGS.has(tag)) continue;

      const common = {
        id: makeId(),
        name: nameOf(el, tag),
        rotation: 0,
        opacity: num(attr(el, "opacity") ?? styleProp(el, "opacity"), 1),
        visible: (attr(el, "display") ?? styleProp(el, "display")) !== "none",
        locked: false,
      };

      if (tag === "text") {
        const fs = num(attr(el, "font-size") ?? styleProp(el, "font-size"), 0.05 * W);
        const anchor = attr(el, "text-anchor") ?? styleProp(el, "text-anchor");
        const align: TextAlign = anchor === "middle" ? "center" : anchor === "end" ? "right" : "left";
        const x = num(attr(el, "x")) / W;
        const y = num(attr(el, "y")) / H;
        layers.push({
          ...common,
          kind: "text",
          text: el.textContent?.trim() ?? "",
          fontFamily: attr(el, "font-family") ?? styleProp(el, "font-family") ?? "Inter",
          fontSize: fs / W,
          fontWeight: /bold|[6-9]00/.test(attr(el, "font-weight") ?? styleProp(el, "font-weight") ?? "") ? 700 : 400,
          color: fillOf(el) ?? "#ffffff",
          align,
          lineHeight: 1.2,
          letterSpacing: 0,
          // anchor y is the baseline; nudge the box up to roughly contain the glyph
          x,
          y: Math.max(0, y - fs / H),
          w: Math.max(0.2, Math.min(0.9, 1 - x)),
          h: Math.max((fs / H) * 1.4, 0.05),
        });
      } else if (tag === "image") {
        const src = attr(el, "href") ?? attr(el, "xlink:href") ?? undefined;
        layers.push({
          ...common,
          kind: "image",
          hue: 230,
          x: num(attr(el, "x")) / W,
          y: num(attr(el, "y")) / H,
          w: Math.max(0, num(attr(el, "width"))) / W || 1,
          h: Math.max(0, num(attr(el, "height"))) / H || 1,
          ...(src ? { src } : {}),
        });
      } else if (SHAPE_TAGS[tag]) {
        let x = 0;
        let y = 0;
        let w = 0;
        let h = 0;
        if (tag === "rect") {
          x = num(attr(el, "x"));
          y = num(attr(el, "y"));
          w = num(attr(el, "width"));
          h = num(attr(el, "height"));
        } else if (tag === "circle") {
          const r = num(attr(el, "r"));
          x = num(attr(el, "cx")) - r;
          y = num(attr(el, "cy")) - r;
          w = h = 2 * r;
        } else if (tag === "ellipse") {
          const rx = num(attr(el, "rx"));
          const ry = num(attr(el, "ry"));
          x = num(attr(el, "cx")) - rx;
          y = num(attr(el, "cy")) - ry;
          w = 2 * rx;
          h = 2 * ry;
        } else {
          // line
          const x1 = num(attr(el, "x1"));
          const y1 = num(attr(el, "y1"));
          const x2 = num(attr(el, "x2"));
          const y2 = num(attr(el, "y2"));
          x = Math.min(x1, x2);
          y = Math.min(y1, y2);
          w = Math.abs(x2 - x1) || 0.001 * W;
          h = Math.abs(y2 - y1) || 0.04 * H;
        }
        layers.push({
          ...common,
          kind: "shape",
          shapeType: SHAPE_TAGS[tag],
          x: x / W,
          y: y / H,
          w: w / W,
          h: h / H,
          fill: fillOf(el) ?? "#6f66e8",
          radius: tag === "rect" ? num(attr(el, "rx")) : 0,
          strokeColor: attr(el, "stroke") ?? styleProp(el, "stroke") ?? "#ffffff",
          strokeWidth: num(attr(el, "stroke-width") ?? styleProp(el, "stroke-width"), 0),
        });
      } else if (RASTER_TAGS.has(tag)) {
        // Arbitrary vector — keep it as its own layer by inlining to an SVG image.
        const b = bbox(el);
        layers.push({ ...common, kind: "image", hue: 265, src: rasterize(el), ...b });
        warnings.add("Complex vector paths were kept as image layers (appearance preserved).");
      }
    }
  };

  visit(root);
  if (layers.length === 0) warnings.add("No drawable elements found in the SVG.");
  return { width: W, height: H, layers, warnings: [...warnings] };
}
