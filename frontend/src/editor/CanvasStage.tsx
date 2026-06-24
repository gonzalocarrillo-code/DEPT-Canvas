import { useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { Lock } from "lucide-react";
import { useEditorStore } from "./editorStore";
import { FORMATS, type Layer, type LayerKeyframes, type ShapeType } from "./types";
import { useCesdkEditor } from "./useCesdkEditor";
import { animatedStyle, motionSpeed } from "./animation";
import { composeEffects } from "./effects";
import { cn } from "@/lib/utils";

const clamp = (v: number) => Math.max(-0.2, Math.min(1.2, v));
const SNAP = 0.012; // normalized snap threshold (~1.2% of the artboard)

function ShapeSvg({
  type,
  fill,
  stroke,
  strokeWidth,
}: {
  type: ShapeType;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}) {
  const sw = strokeWidth ?? 0;
  const common = {
    fill: fill ?? "#6f66e8",
    stroke: sw ? stroke ?? "#fff" : "none",
    strokeWidth: sw,
    vectorEffect: "non-scaling-stroke" as const,
  };
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
      {type === "ellipse" && <ellipse cx="50" cy="50" rx="49" ry="49" {...common} />}
      {type === "triangle" && <polygon points="50,3 97,97 3,97" {...common} />}
      {type === "diamond" && <polygon points="50,3 97,50 50,97 3,50" {...common} />}
      {type === "pentagon" && <polygon points="50,3 97,39 79,97 21,97 3,39" {...common} />}
      {type === "star" && (
        <polygon points="50,3 61,38 98,38 68,60 79,97 50,75 21,97 32,60 2,38 39,38" {...common} />
      )}
      {type === "arrow" && (
        <polygon points="2,38 60,38 60,18 98,50 60,82 60,62 2,62" {...common} />
      )}
      {type === "line" && (
        <line x1="2" y1="50" x2="98" y2="50" stroke={stroke ?? fill ?? "#fff"} strokeWidth={sw || 4} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

/** Nearest snap of any anchor to any target within SNAP, or null. */
function bestSnap(
  anchors: number[],
  targets: number[],
): { off: number; guide: number } | null {
  let best: { off: number; guide: number } | null = null;
  for (const a of anchors) {
    for (const t of targets) {
      const d = Math.abs(a - t);
      if (d < SNAP && (best === null || d < Math.abs(best.off))) {
        best = { off: t - a, guide: t };
      }
    }
  }
  return best;
}

function LayerView({
  layer,
  selected,
  animate,
  playing,
  kf,
  playhead,
  editing,
  onPointerDown,
  onStartEdit,
  onText,
  onEndEdit,
}: {
  layer: Layer;
  selected: boolean;
  animate: boolean;
  playing: boolean;
  kf: LayerKeyframes | undefined;
  playhead: number;
  editing: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onStartEdit: () => void;
  onText: (t: string) => void;
  onEndEdit: () => void;
}) {
  const anim = animate ? animatedStyle(kf, playhead) : {};
  // Editable in both design AND video modes — only block while the animation plays
  // (so a drag doesn't fight the keyframed transform) or when the layer is locked.
  const draggable = !layer.locked && !playing;
  const hue = layer.hue ?? 265;

  const composed = composeEffects(layer.effects);
  const filters: string[] = composed.filter ? [composed.filter] : [];
  if (animate && playing && layer.motionBlur) {
    const sp = motionSpeed(kf, playhead);
    const amt = layer.motionBlurAmount ?? 0.4; // calmer default; editable in the inspector
    const px = Math.min(sp * 22 * amt, 8);
    if (px > 0.4) filters.push(`blur(${px.toFixed(1)}px)`);
  }

  const box: CSSProperties = {
    position: "absolute",
    left: `${layer.x * 100}%`,
    top: `${layer.y * 100}%`,
    width: `${layer.w * 100}%`,
    height: `${layer.h * 100}%`,
    transform: `rotate(${layer.rotation}deg) ${anim.transform ?? ""}`,
    opacity: layer.opacity * (typeof anim.opacity === "number" ? anim.opacity : 1),
    cursor: draggable ? "move" : "pointer",
    touchAction: "none",
    filter: filters.length ? filters.join(" ") : undefined,
    mixBlendMode:
      layer.blendMode && layer.blendMode !== "normal"
        ? (layer.blendMode as CSSProperties["mixBlendMode"])
        : undefined,
  };

  return (
    <div
      style={box}
      onPointerDown={onPointerDown}
      onDoubleClick={layer.kind === "text" && !layer.locked && !playing ? onStartEdit : undefined}
      className={cn(
        selected && !playing && "outline outline-2 outline-offset-2 outline-primary",
      )}
    >
      {layer.kind === "image" &&
        (layer.src ? (
          <img src={layer.src} alt={layer.name} className="h-full w-full object-fill" draggable={false} />
        ) : (
          <div
            className="h-full w-full overflow-hidden"
            style={{ background: `radial-gradient(130% 130% at 0% 0%, hsl(${hue} 55% 30%), hsl(${hue} 45% 12%))` }}
          >
            <div
              className="h-full w-full"
              style={{
                backgroundImage: "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)",
                backgroundSize: "18px 18px",
              }}
            />
          </div>
        ))}
      {layer.kind === "shape" && (
        <div className="relative h-full w-full">
          {!layer.shapeType || layer.shapeType === "rect" ? (
            <div
              className="h-full w-full"
              style={{
                background: layer.fill,
                borderRadius: layer.radius,
                border: layer.strokeWidth ? `${layer.strokeWidth}px solid ${layer.strokeColor ?? "#fff"}` : undefined,
              }}
            />
          ) : (
            <ShapeSvg type={layer.shapeType} fill={layer.fill} stroke={layer.strokeColor} strokeWidth={layer.strokeWidth} />
          )}
          {layer.text && (
            <span
              className="absolute inset-0 flex items-center justify-center"
              style={{ color: layer.color, fontSize: `${(layer.fontSize ?? 0.03) * 100}cqw`, fontWeight: layer.fontWeight }}
            >
              {layer.text}
            </span>
          )}
        </div>
      )}
      {layer.kind === "text" &&
        (editing ? (
          <textarea
            autoFocus
            value={layer.text ?? ""}
            onChange={(e) => onText(e.target.value)}
            onBlur={onEndEdit}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onEndEdit();
              }
              e.stopPropagation();
            }}
            className="h-full w-full resize-none border-0 bg-transparent p-0 outline-none ring-1 ring-primary/60"
            style={{
              color: layer.color,
              fontSize: `${(layer.fontSize ?? 0.05) * 100}cqw`,
              fontWeight: layer.fontWeight,
              textAlign: layer.align,
              lineHeight: layer.lineHeight,
              letterSpacing: `${layer.letterSpacing ?? 0}em`,
              fontFamily: layer.fontFamily,
              caretColor: layer.color,
            }}
          />
        ) : (
          <div
            style={{
              color: layer.color,
              fontSize: `${(layer.fontSize ?? 0.05) * 100}cqw`,
              fontWeight: layer.fontWeight,
              textAlign: layer.align,
              lineHeight: layer.lineHeight,
              letterSpacing: `${layer.letterSpacing ?? 0}em`,
              fontFamily: layer.fontFamily,
              whiteSpace: "pre-line",
            }}
          >
            {layer.text}
          </div>
        ))}
      {composed.vignette && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 50%, transparent 45%, rgba(0,0,0,${composed.vignette.darkness}) 100%)`,
          }}
        />
      )}
      {selected && !playing && layer.locked && (
        <span className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-lock text-lock-foreground">
          <Lock className="size-2.5" />
        </span>
      )}
    </div>
  );
}

export function CanvasStage() {
  const { layers, format, selectedId, mode, playing, playhead, keyframes } = useEditorStore(
    useShallow((s) => ({
      layers: s.layers,
      format: s.format,
      selectedId: s.selectedId,
      mode: s.mode,
      playing: s.playing,
      playhead: s.playhead,
      keyframes: s.keyframes,
    })),
  );
  const select = useEditorStore((s) => s.select);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const endInteraction = useEditorStore((s) => s.endInteraction);
  const { containerRef, status } = useCesdkEditor();
  const artRef = useRef<HTMLDivElement>(null);
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const [editingId, setEditingId] = useState<string | null>(null);

  const fmt = FORMATS[format];
  const ratio = fmt.w / fmt.h;
  const ready = status === "ready";
  const animate = mode === "animate";

  const startDrag = (layer: Layer, e: ReactPointerEvent<HTMLDivElement>) => {
    select(layer.id);
    if (editingId && editingId !== layer.id) setEditingId(null);
    if (playing || layer.locked || editingId === layer.id) return;
    const art = artRef.current;
    if (!art) return;
    const rect = art.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const baseX = layer.x;
    const baseY = layer.y;
    const others = layers.filter((l) => l.id !== layer.id && l.visible);
    const targetsX = [0, 0.5, 1, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
    const targetsY = [0, 0.5, 1, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];

    const move = (ev: globalThis.PointerEvent) => {
      let px = clamp(baseX + (ev.clientX - startX) / rect.width);
      let py = clamp(baseY + (ev.clientY - startY) / rect.height);
      const gx: number[] = [];
      const gy: number[] = [];

      // Smart snap: align the dragged layer's left/center/right (and top/mid/bottom)
      // to the artboard and any sibling's edges + centers.
      const sx = bestSnap([px, px + layer.w / 2, px + layer.w], targetsX);
      if (sx) {
        px += sx.off;
        gx.push(sx.guide);
      }
      const sy = bestSnap([py, py + layer.h / 2, py + layer.h], targetsY);
      if (sy) {
        py += sy.off;
        gy.push(sy.guide);
      }

      setGuides({ x: gx, y: gy });
      updateLayer(layer.id, { x: px, y: py });
    };
    const up = () => {
      setGuides({ x: [], y: [] });
      endInteraction();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="editor-stage relative grid h-full w-full place-items-center overflow-hidden bg-[#0a0a0f]">
      <div ref={containerRef} className={cn("absolute inset-0", ready ? "block" : "hidden")} />
      {!ready && (
        <div
          ref={artRef}
          className="editor-artboard relative overflow-hidden bg-black shadow-2xl ring-1 ring-white/5"
          style={{ width: `min(88cqw, calc(${ratio} * 88cqh))`, aspectRatio: `${fmt.w} / ${fmt.h}` }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              select(null);
              setEditingId(null);
            }
          }}
        >
          {layers
            .filter((l) => l.visible)
            .map((l) => (
              <LayerView
                key={l.id}
                layer={l}
                selected={l.id === selectedId}
                animate={animate}
                playing={playing}
                kf={keyframes[l.id]}
                playhead={playhead}
                editing={editingId === l.id}
                onPointerDown={(e) => startDrag(l, e)}
                onStartEdit={() => {
                  select(l.id);
                  setEditingId(l.id);
                }}
                onText={(t) => updateLayer(l.id, { text: t })}
                onEndEdit={() => {
                  setEditingId(null);
                  endInteraction();
                }}
              />
            ))}

          {/* Smart alignment guides (Canva-style) */}
          {guides.x.map((gx, i) => (
            <div
              key={`gx-${i}`}
              className="pointer-events-none absolute bottom-0 top-0 z-50 w-px"
              style={{ left: `${gx * 100}%`, background: "#ff3d8b" }}
            />
          ))}
          {guides.y.map((gy, i) => (
            <div
              key={`gy-${i}`}
              className="pointer-events-none absolute left-0 right-0 z-50 h-px"
              style={{ top: `${gy * 100}%`, background: "#ff3d8b" }}
            />
          ))}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-border bg-card/80 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur-sm">
        {ready
          ? "CE.SDK engine · live"
          : status === "loading"
            ? "Loading CE.SDK engine…"
            : animate
              ? playing
                ? "Playing — pause to edit · keyframes in the timeline"
                : "Paused — drag to move · double-click text · play to preview the animation"
              : "Drag to move · double-click text to edit · ⌘Z undo"}
      </div>
    </div>
  );
}
