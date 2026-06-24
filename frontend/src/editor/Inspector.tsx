import { useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Sparkles,
  Lock,
  Replace,
  Crop,
  Eraser,
  Wand2,
  Diamond,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  BringToFront,
  SendToBack,
  ArrowUp,
  ArrowDown,
  Plus,
} from "lucide-react";
import { useEditorStore } from "./editorStore";
import {
  ANIMATABLE_PROPS,
  BLEND_MODES,
  EFFECT_CATALOG,
  type AnimatableProp,
  type Layer,
  type LayerKeyframes,
  type TextAlign,
} from "./types";
import { MOTION_PRESETS } from "./motionPresets";
import { valueAt } from "./animation";
import { SpeedGraph } from "./SpeedGraph";
import { Button } from "@/ui/button";
import { cn } from "@/lib/utils";

const inputCls =
  "h-7 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary/60 disabled:opacity-50";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-border px-3 py-3">
      <p className="text-meta mb-2 uppercase">{title}</p>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1">{children}</div>
    </div>
  );
}

export function Inspector() {
  const { layers, selectedId, mode } = useEditorStore(
    useShallow((s) => ({ layers: s.layers, selectedId: s.selectedId, mode: s.mode })),
  );
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const toggleLock = useEditorStore((s) => s.toggleLock);
  const reorderLayer = useEditorStore((s) => s.reorderLayer);
  const keyframes = useEditorStore((s) => s.keyframes);
  const playhead = useEditorStore((s) => s.playhead);
  const setKeyframe = useEditorStore((s) => s.setKeyframe);
  const applyPreset = useEditorStore((s) => s.applyPreset);
  const clearKeyframes = useEditorStore((s) => s.clearKeyframes);
  const selectedKeyframe = useEditorStore((s) => s.selectedKeyframe);
  const setKeyframeEase = useEditorStore((s) => s.setKeyframeEase);
  const deleteSelectedKeyframe = useEditorStore((s) => s.deleteSelectedKeyframe);

  const layer = layers.find((l) => l.id === selectedId) ?? null;

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-card">
      {!layer ? (
        <div className="grid flex-1 place-items-center px-6 text-center">
          <p className="text-xs text-muted-foreground">
            Select a layer to edit its text, image, position and animation.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{layer.name}</p>
              <p className="text-meta capitalize">{layer.kind} layer</p>
            </div>
            <button
              onClick={() => toggleLock(layer.id)}
              title={layer.locked ? "Unlock layer" : "Lock layer"}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                layer.locked
                  ? "border-lock/40 text-lock"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Lock className="size-3" /> {layer.locked ? "Locked" : "Lock"}
            </button>
          </div>

          {layer.locked && (
            <div className="border-b border-border bg-lock/10 px-3 py-2 text-[11px] text-lock">
              Brand-locked. Position, fill and content are frozen — the server
              re-validates on save.
            </div>
          )}

          <fieldset disabled={layer.locked} className="contents">
            <TransformSection layer={layer} onChange={(p) => updateLayer(layer.id, p)} />
            <ArrangeSection onReorder={(dir) => reorderLayer(layer.id, dir)} />
            {layer.kind === "text" && (
              <TextSection layer={layer} onChange={(p) => updateLayer(layer.id, p)} />
            )}
            {layer.kind === "image" && (
              <ImageSection layer={layer} onChange={(p) => updateLayer(layer.id, p)} />
            )}
            {layer.kind === "shape" && (
              <ShapeSection layer={layer} onChange={(p) => updateLayer(layer.id, p)} />
            )}
            <EffectsSection layer={layer} onChange={(p) => updateLayer(layer.id, p)} />
          </fieldset>

          {mode === "animate" && (
            <KeyframeSection
              layer={layer}
              kf={keyframes[layer.id]}
              playhead={playhead}
              selectedKeyframe={selectedKeyframe}
              onSetKeyframe={(prop, value) => setKeyframe(layer.id, prop, playhead, value)}
              onApplyPreset={(presetId) => applyPreset(layer.id, presetId)}
              onClear={() => clearKeyframes(layer.id)}
              onSetEase={(prop, t, e) => setKeyframeEase(layer.id, prop, t, e)}
              onDeleteKf={deleteSelectedKeyframe}
            />
          )}

          <AiSection locked={layer.locked} kind={layer.kind} />
        </>
      )}
    </aside>
  );
}

function TransformSection({ layer, onChange }: { layer: Layer; onChange: (p: Partial<Layer>) => void }) {
  const pct = (v: number) => Math.round(v * 100);
  return (
    <Section title="Transform">
      <div className="grid grid-cols-2 gap-2">
        {(["x", "y", "w", "h"] as const).map((k) => (
          <Row key={k} label={k.toUpperCase()}>
            <input
              type="number"
              className={cn(inputCls, "w-14 text-right")}
              value={pct(layer[k])}
              onChange={(e) => onChange({ [k]: Number(e.target.value) / 100 })}
            />
          </Row>
        ))}
      </div>
      <Row label="Rotation">
        <input
          type="range"
          min={-180}
          max={180}
          value={layer.rotation}
          onChange={(e) => onChange({ rotation: Number(e.target.value) })}
          className="w-32 accent-[var(--color-primary)]"
        />
        <span className="w-8 text-right font-mono text-[11px] text-muted-foreground">{layer.rotation}°</span>
      </Row>
      <Row label="Opacity">
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(layer.opacity * 100)}
          onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
          className="w-32 accent-[var(--color-primary)]"
        />
        <span className="w-8 text-right font-mono text-[11px] text-muted-foreground">
          {Math.round(layer.opacity * 100)}
        </span>
      </Row>
    </Section>
  );
}

function TextSection({ layer, onChange }: { layer: Layer; onChange: (p: Partial<Layer>) => void }) {
  const aligns: { v: TextAlign; icon: typeof AlignLeft }[] = [
    { v: "left", icon: AlignLeft },
    { v: "center", icon: AlignCenter },
    { v: "right", icon: AlignRight },
  ];
  return (
    <Section title="Text">
      <textarea
        className={cn(inputCls, "h-16 resize-none py-1.5")}
        value={layer.text ?? ""}
        onChange={(e) => onChange({ text: e.target.value })}
      />
      <Row label="Size">
        <input
          type="range"
          min={1}
          max={20}
          step={0.5}
          value={(layer.fontSize ?? 0.05) * 100}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) / 100 })}
          className="w-28 accent-[var(--color-primary)]"
        />
      </Row>
      <Row label="Weight">
        <select
          className={cn(inputCls, "w-24")}
          value={layer.fontWeight ?? 400}
          onChange={(e) => onChange({ fontWeight: Number(e.target.value) })}
        >
          {[400, 500, 600, 700, 800].map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Color">
        <input
          type="color"
          className="h-7 w-9 rounded border border-border bg-background"
          value={layer.color ?? "#ffffff"}
          onChange={(e) => onChange({ color: e.target.value })}
        />
      </Row>
      <Row label="Align">
        <div className="flex items-center gap-0.5">
          {aligns.map(({ v, icon: Icon }) => (
            <button
              key={v}
              onClick={() => onChange({ align: v })}
              data-active={(layer.align ?? "left") === v}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent data-[active=true]:bg-accent data-[active=true]:text-foreground"
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
      </Row>
    </Section>
  );
}

function ImageSection({ layer, onChange }: { layer: Layer; onChange: (p: Partial<Layer>) => void }) {
  return (
    <Section title="Image">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm">
          <Replace /> Replace
        </Button>
        <Button variant="outline" size="sm">
          <Crop /> Crop
        </Button>
      </div>
      <Row label="Tint">
        <input
          type="range"
          min={0}
          max={360}
          value={layer.hue ?? 265}
          onChange={(e) => onChange({ hue: Number(e.target.value) })}
          className="w-32 accent-[var(--color-primary)]"
        />
      </Row>
      <Button variant="outline" size="sm" className="w-full justify-start">
        <Eraser /> Remove background
      </Button>
    </Section>
  );
}

function ShapeSection({ layer, onChange }: { layer: Layer; onChange: (p: Partial<Layer>) => void }) {
  return (
    <Section title="Shape">
      {layer.text !== undefined && (
        <Row label="Label">
          <input
            className={cn(inputCls, "w-36")}
            value={layer.text ?? ""}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </Row>
      )}
      <Row label="Fill">
        <input
          type="color"
          className="h-7 w-9 rounded border border-border bg-background"
          value={layer.fill ?? "#6f66e8"}
          onChange={(e) => onChange({ fill: e.target.value })}
        />
      </Row>
      <Row label="Radius">
        <input
          type="range"
          min={0}
          max={48}
          value={layer.radius ?? 8}
          onChange={(e) => onChange({ radius: Number(e.target.value) })}
          className="w-32 accent-[var(--color-primary)]"
        />
      </Row>
      <Row label="Stroke">
        <input
          type="color"
          className="h-7 w-9 rounded border border-border bg-background"
          value={layer.strokeColor ?? "#ffffff"}
          onChange={(e) => onChange({ strokeColor: e.target.value })}
        />
        <input
          type="range"
          min={0}
          max={20}
          value={layer.strokeWidth ?? 0}
          onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
          className="w-20 accent-[var(--color-primary)]"
        />
      </Row>
    </Section>
  );
}

function ArrangeSection({
  onReorder,
}: {
  onReorder: (dir: "front" | "back" | "forward" | "backward") => void;
}) {
  const btns: {
    dir: "front" | "back" | "forward" | "backward";
    label: string;
    icon: typeof ArrowUp;
  }[] = [
    { dir: "front", label: "To front", icon: BringToFront },
    { dir: "forward", label: "Forward", icon: ArrowUp },
    { dir: "backward", label: "Backward", icon: ArrowDown },
    { dir: "back", label: "To back", icon: SendToBack },
  ];
  return (
    <Section title="Arrange">
      <div className="grid grid-cols-2 gap-1.5">
        {btns.map(({ dir, label, icon: Icon }) => (
          <button
            key={dir}
            onClick={() => onReorder(dir)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
          >
            <Icon className="size-3.5 text-muted-foreground" /> {label}
          </button>
        ))}
      </div>
    </Section>
  );
}

function EffectsSection({ layer, onChange }: { layer: Layer; onChange: (p: Partial<Layer>) => void }) {
  const addEffect = useEditorStore((s) => s.addEffect);
  const removeEffect = useEditorStore((s) => s.removeEffect);
  const updateEffectParam = useEditorStore((s) => s.updateEffectParam);
  const updateEffectColor = useEditorStore((s) => s.updateEffectColor);
  const toggleEffect = useEditorStore((s) => s.toggleEffect);
  const [addOpen, setAddOpen] = useState(false);
  const effects = layer.effects ?? [];

  return (
    <Section title="Effects">
      {effects.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No effects yet — add one below.</p>
      )}
      {effects.map((fx) => {
        const def = EFFECT_CATALOG.find((d) => d.type === fx.type);
        if (!def) return null;
        return (
          <div key={fx.id} className="grid gap-1.5 rounded-md border border-border p-2">
            <div className="flex items-center justify-between">
              <button
                onClick={() => toggleEffect(layer.id, fx.id)}
                className="flex items-center gap-1.5 text-xs font-medium text-foreground"
                title={fx.enabled ? "Disable" : "Enable"}
              >
                <span className={cn("size-2 rounded-full", fx.enabled ? "bg-success" : "bg-muted-foreground/40")} />
                {def.label}
              </button>
              <button
                onClick={() => removeEffect(layer.id, fx.id)}
                title="Remove effect"
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            {fx.enabled &&
              def.params.map((p) => (
                <Row key={p.key} label={p.label}>
                  <input
                    type="range"
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={fx.params[p.key] ?? p.default}
                    onChange={(e) => updateEffectParam(layer.id, fx.id, p.key, Number(e.target.value))}
                    className="w-28 accent-[var(--color-primary)]"
                  />
                </Row>
              ))}
            {fx.enabled && def.color && (
              <Row label="Color">
                <input
                  type="color"
                  className="h-7 w-9 rounded border border-border bg-background"
                  value={fx.color ?? "#6f66e8"}
                  onChange={(e) => updateEffectColor(layer.id, fx.id, "color", e.target.value)}
                />
              </Row>
            )}
            {fx.enabled && def.color2 && (
              <Row label="Color 2">
                <input
                  type="color"
                  className="h-7 w-9 rounded border border-border bg-background"
                  value={fx.color2 ?? "#0b0b10"}
                  onChange={(e) => updateEffectColor(layer.id, fx.id, "color2", e.target.value)}
                />
              </Row>
            )}
          </div>
        );
      })}

      <div className="relative">
        <button
          onClick={() => setAddOpen((o) => !o)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-3.5" /> Add effect
        </button>
        {addOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setAddOpen(false)} />
            <div className="absolute bottom-full left-0 z-20 mb-1 w-full rounded-lg border border-border bg-popover p-1 shadow-xl">
              {EFFECT_CATALOG.map((d) => (
                <button
                  key={d.type}
                  onClick={() => {
                    addEffect(layer.id, d.type);
                    setAddOpen(false);
                  }}
                  className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <Row label="Blend">
        <select
          className={cn(inputCls, "w-32")}
          value={layer.blendMode ?? "normal"}
          onChange={(e) => onChange({ blendMode: e.target.value })}
        >
          {BLEND_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Motion blur">
        <input
          type="checkbox"
          checked={Boolean(layer.motionBlur)}
          onChange={(e) => onChange({ motionBlur: e.target.checked })}
          className="size-3.5 accent-[var(--color-primary)]"
        />
      </Row>
      {layer.motionBlur && (
        <Row label="Blur amount">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={layer.motionBlurAmount ?? 0.4}
              onChange={(e) => onChange({ motionBlurAmount: Number(e.target.value) })}
              className="w-24 accent-[var(--color-primary)]"
            />
            <span className="w-8 text-right font-mono text-[11px] text-muted-foreground">
              {Math.round((layer.motionBlurAmount ?? 0.4) * 100)}
            </span>
          </div>
        </Row>
      )}
    </Section>
  );
}

function KeyframeSection({
  layer,
  kf,
  playhead,
  selectedKeyframe,
  onSetKeyframe,
  onApplyPreset,
  onClear,
  onSetEase,
  onDeleteKf,
}: {
  layer: Layer;
  kf: LayerKeyframes | undefined;
  playhead: number;
  selectedKeyframe: { prop: AnimatableProp; t: number } | null;
  onSetKeyframe: (prop: AnimatableProp, value: number) => void;
  onApplyPreset: (presetId: string) => void;
  onClear: () => void;
  onSetEase: (prop: AnimatableProp, t: number, ease: string) => void;
  onDeleteKf: () => void;
}) {
  const selEase = selectedKeyframe
    ? (kf?.[selectedKeyframe.prop] ?? []).find((k) => Math.abs(k.t - selectedKeyframe.t) < 0.06)?.ease ?? "EaseOut"
    : null;
  return (
    <Section title="Animate · keyframes">
      <Row label="Preset">
        <select
          className={cn(inputCls, "w-40")}
          value=""
          disabled={layer.locked}
          onChange={(e) => {
            if (e.target.value) onApplyPreset(e.target.value);
          }}
        >
          <option value="">Apply preset…</option>
          {MOTION_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Row>

      {ANIMATABLE_PROPS.map(({ prop, label, fallback, min, max, step }) => {
        const track = kf?.[prop];
        const val = valueAt(track, playhead, fallback);
        const count = track?.length ?? 0;
        return (
          <Row key={prop} label={label}>
            <input
              type="number"
              step={step}
              min={min}
              max={max}
              disabled={layer.locked}
              value={Number(val.toFixed(2))}
              onChange={(e) => onSetKeyframe(prop, Number(e.target.value))}
              className={cn(inputCls, "w-16 text-right")}
            />
            <button
              title="Set keyframe at playhead"
              disabled={layer.locked}
              onClick={() => onSetKeyframe(prop, val)}
              className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              <Diamond className={cn("size-3.5", count > 0 && "fill-primary text-primary")} />
            </button>
            <span className="w-4 text-center font-mono text-[10px] text-primary">
              {count || ""}
            </span>
          </Row>
        );
      })}

      {selectedKeyframe && (
        <div className="grid gap-2 rounded-md border border-border p-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium capitalize text-foreground">
              Speed · {selectedKeyframe.prop} @ {selectedKeyframe.t.toFixed(2)}s
            </p>
            <button
              onClick={onDeleteKf}
              title="Delete keyframe (⌫)"
              className="text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
          <SpeedGraph
            ease={selEase ?? "EaseOut"}
            onChange={(e) => onSetEase(selectedKeyframe.prop, selectedKeyframe.t, e)}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="text-[11px] leading-tight text-muted-foreground">
          Move the playhead, change a value to set a keyframe.
        </p>
        <button
          onClick={onClear}
          disabled={layer.locked}
          className="shrink-0 text-[11px] text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
        >
          Clear
        </button>
      </div>
    </Section>
  );
}

function AiSection({ locked, kind }: { locked: boolean; kind: Layer["kind"] }) {
  const actions =
    kind === "text"
      ? ["Rewrite shorter", "Translate", "On-brand tone"]
      : ["Variations", "Replace background", "Upscale"];
  return (
    <div className="mt-auto border-t border-border px-3 py-3">
      <p className="text-meta mb-2 flex items-center gap-1.5 uppercase">
        <Sparkles className="size-3.5 text-primary" /> Contextual AI
      </p>
      <textarea
        disabled={locked}
        placeholder={locked ? "Locked layer — AI disabled" : "Describe an edit for this layer…"}
        className={cn(inputCls, "h-14 resize-none py-1.5")}
      />
      <Button variant="primary" size="sm" disabled={locked} className="mt-2 w-full">
        <Wand2 /> Generate edit
      </Button>
      <div className="mt-2 flex flex-wrap gap-1">
        {actions.map((a) => (
          <button
            key={a}
            disabled={locked}
            className={cn(
              "rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              locked && "cursor-not-allowed opacity-50",
            )}
          >
            {a}
          </button>
        ))}
      </div>
    </div>
  );
}
