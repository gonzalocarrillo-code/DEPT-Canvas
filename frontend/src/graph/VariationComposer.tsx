import { useState } from "react";
import { Link } from "react-router";
import {
  Sparkles,
  Play,
  Lock,
  Image as ImageIcon,
  Type,
  Square,
  BookOpen,
  AlertTriangle,
  Film,
} from "lucide-react";
import { useGraphStore } from "./store";
import { useSkillsStore } from "@/skills/skills";
import { defaultLayerManifest } from "@/editor/scene";
import type { LayerManifestEntry, VariableLayer } from "./types";

const COST_PER_VARIANT = 0.04;
const MAX_TOTAL = 200; // cost/perf ceiling

interface LayerCfg {
  on: boolean;
  mode: "prompt" | "values";
  text: string;
  count: number;
}

const DEFAULT_CFG: LayerCfg = { on: false, mode: "prompt", text: "", count: 8 };

const kindIcon = { text: Type, image: ImageIcon, graphic: Square } as const;

export function VariationComposer({ masterId, onClose }: { masterId: string; onClose: () => void }) {
  const createVariationSet = useGraphStore((s) => s.createVariationSet);
  const master = useGraphStore((s) => s.nodes.find((n) => n.id === masterId));
  const allSkills = useSkillsStore((s) => s.skills);

  // The design's REAL layers (mirrored from the editor); fall back to the default
  // scene for a master that hasn't been opened/edited yet.
  const layers: LayerManifestEntry[] =
    (master?.data.layers as LayerManifestEntry[] | undefined) ?? defaultLayerManifest();
  const masterKind = master?.data.kind;

  const [cfg, setCfg] = useState<Record<string, LayerCfg>>({});
  const [outputKind, setOutputKind] = useState<"image" | "video">(
    masterKind === "video" || masterKind === "animate" ? "video" : "image",
  );
  const [skillId, setSkillId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const setLayer = (id: string, patch: Partial<LayerCfg>) =>
    setCfg((c) => ({
      ...c,
      [id]: { ...DEFAULT_CFG, ...c[id], ...patch },
    }));

  const countFor = (layer: LayerManifestEntry): number => {
    const c = cfg[layer.id];
    if (!c?.on) return 0;
    if (c.mode === "values") return c.text.split(",").map((v) => v.trim()).filter(Boolean).length;
    return Math.max(1, c.count || 0);
  };
  const total = layers.reduce((sum, l) => sum + (l.locked ? 0 : countFor(l)), 0);
  const cost = (total * COST_PER_VARIANT).toFixed(2);
  const etaS = Math.max(1, Math.round(total * 0.4));
  const overCeiling = total > MAX_TOTAL;

  const run = () => {
    const variableLayers: VariableLayer[] = layers
      .filter((l) => !l.locked && cfg[l.id]?.on)
      .map((l) => {
        const c = cfg[l.id]!;
        return {
          layerId: l.id,
          axis:
            c.mode === "values"
              ? { kind: "values", values: c.text.split(",").map((v) => v.trim()).filter(Boolean) }
              : { kind: "prompt", instruction: c.text, expandTo: Math.max(1, c.count || 0) },
        };
      });
    createVariationSet(masterId, { variableLayers, outputKind, skillId });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className="nodrag absolute left-0 top-full z-30 mt-1 max-h-[72vh] w-80 overflow-y-auto rounded-xl border border-border bg-popover p-3 shadow-2xl">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Vary this design</span>
          <div className="ml-auto inline-flex rounded-md border border-border p-0.5">
            {(["image", "video"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setOutputKind(k)}
                data-active={outputKind === k}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground data-[active=true]:bg-accent data-[active=true]:text-foreground"
              >
                {k === "video" ? <Film className="size-2.5" /> : <ImageIcon className="size-2.5" />}
                {k}
              </button>
            ))}
          </div>
        </div>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Pick the layers to vary with AI. Locked layers (and everything else) stay fixed — only
          the layers you choose change, generate-once / render-many.
        </p>

        <div className="grid gap-1.5">
          {layers.map((layer) => {
            const Icon = kindIcon[layer.kind];
            const c = cfg[layer.id];
            if (layer.locked) {
              return (
                <div
                  key={layer.id}
                  title="Locked in the editor — won't vary"
                  className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 opacity-50"
                >
                  <Lock className="size-3 shrink-0 text-lock" />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">{layer.name}</span>
                  <span className="text-[9px] uppercase text-lock">locked</span>
                </div>
              );
            }
            return (
              <div key={layer.id} className="rounded-lg border border-border">
                <button
                  onClick={() => setLayer(layer.id, { on: !c?.on })}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
                >
                  <span
                    data-on={c?.on}
                    className="grid size-4 shrink-0 place-items-center rounded border border-border data-[on=true]:border-primary data-[on=true]:bg-primary data-[on=true]:text-primary-foreground"
                  >
                    {c?.on && <span className="text-[9px]">✓</span>}
                  </span>
                  <Icon className="size-3 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
                    {layer.name}
                  </span>
                  {c?.on && <span className="font-mono text-[10px] text-primary">×{countFor(layer)}</span>}
                </button>
                {c?.on && (
                  <div className="grid gap-1.5 border-t border-border px-2 py-2">
                    <div className="inline-flex w-fit rounded border border-border p-0.5">
                      {(["prompt", "values"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setLayer(layer.id, { mode: m })}
                          data-active={(c.mode ?? "prompt") === m}
                          className="rounded px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground data-[active=true]:bg-accent data-[active=true]:text-foreground"
                        >
                          {m === "prompt" ? "Prompt" : "List"}
                        </button>
                      ))}
                    </div>
                    <input
                      value={c.text}
                      onChange={(e) => setLayer(layer.id, { text: e.target.value })}
                      placeholder={
                        c.mode === "values"
                          ? "EN, FR, DE, JP …"
                          : layer.kind === "text"
                            ? "e.g. any market · 8 seasonal moods"
                            : "e.g. 20 anime styles · children's toys"
                      }
                      className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary/60"
                    />
                    {c.mode === "prompt" && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">How many</span>
                        <input
                          type="number"
                          min={1}
                          max={MAX_TOTAL}
                          value={c.count}
                          onChange={(e) => setLayer(layer.id, { count: Number(e.target.value) })}
                          className="ml-auto w-16 rounded border border-border bg-background px-1.5 py-0.5 text-right font-mono text-[11px] text-foreground outline-none focus:border-primary/60"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* MD skill */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-meta uppercase">MD skill</p>
            <Link to="/skills" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
              <BookOpen className="size-2.5" /> Manage
            </Link>
          </div>
          <div className="flex flex-wrap gap-1">
            <SkillBtn active={!skillId} onClick={() => setSkillId(null)}>
              None
            </SkillBtn>
            {allSkills.map((sk) => (
              <SkillBtn key={sk.id} active={skillId === sk.id} onClick={() => setSkillId(sk.id)}>
                {sk.name}
              </SkillBtn>
            ))}
          </div>
        </div>

        {/* gate */}
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              <span className="font-mono text-foreground">{total}</span> {outputKind} variants
            </span>
            <span>~${cost} · ~{etaS}s</span>
          </div>
          {overCeiling && (
            <p className="mb-2 text-[10px] text-destructive">Over the {MAX_TOTAL} ceiling — reduce counts.</p>
          )}
          {confirming ? (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0 text-lock" />
              <span className="flex-1 text-[11px] text-muted-foreground">Generate {total} variants?</span>
              <button onClick={() => setConfirming(false)} className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent">
                Cancel
              </button>
              <button onClick={run} className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90">
                Confirm
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              disabled={total === 0 || overCeiling}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Play className="size-3.5" /> Generate {total || ""} variation{total === 1 ? "" : "s"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function SkillBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      data-active={active}
      className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent data-[active=true]:border-primary/50 data-[active=true]:bg-accent data-[active=true]:text-foreground"
    >
      {children}
    </button>
  );
}
