import { useState } from "react";
import { Link } from "react-router";
import {
  Sparkles,
  Play,
  Lock,
  Languages,
  Image as ImageIcon,
  Type,
  Minus,
  Plus,
  BookOpen,
  AlertTriangle,
} from "lucide-react";
import { useGraphStore } from "./store";
import { useSkillsStore } from "@/skills/skills";
import { MASTER_SLOTS, LOCALE_OPTIONS } from "@/batch/batchStore";
import { cn } from "@/lib/utils";

const COST_PER_VARIANT = 0.04;
const MAX_SLOTS = 3;

export function VariationComposer({ masterId, onClose }: { masterId: string; onClose: () => void }) {
  const createVariationSet = useGraphStore((s) => s.createVariationSet);
  const allSkills = useSkillsStore((s) => s.skills);

  const [selected, setSelected] = useState<string[]>([]);
  const [instructions, setInstructions] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"generate" | "transcreate">("generate");
  const [locales, setLocales] = useState<string[]>(["EN", "ES", "FR", "DE"]);
  const [count, setCount] = useState(4);
  const [skillId, setSkillId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const selectedSlots = selected
    .map((id) => MASTER_SLOTS.find((s) => s.id === id))
    .filter(Boolean) as (typeof MASTER_SLOTS)[number][];
  const hasText = selectedSlots.some((s) => s.type === "text");
  const effMode = hasText ? mode : "generate";

  const total = selectedSlots.reduce(
    (sum, s) => sum + (s.type === "text" && effMode === "transcreate" ? locales.length : count),
    0,
  );
  const cost = (total * COST_PER_VARIANT).toFixed(2);
  const etaS = Math.max(1, Math.round(total * 0.5));

  const toggleSlot = (id: string) => {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_SLOTS ? cur : [...cur, id],
    );
  };
  const toggleLocale = (l: string) =>
    setLocales((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

  const run = () => {
    createVariationSet(masterId, {
      targetSlotIds: selected,
      slotInstructions: instructions,
      mode: effMode,
      count,
      locales,
      skillId,
    });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className="nodrag absolute left-0 top-full z-30 mt-1 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-border bg-popover p-3 shadow-2xl">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Vary assets</span>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {selected.length}/{MAX_SLOTS}
          </span>
        </div>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Pick up to {MAX_SLOTS} assets to vary at once. The logo, layout and locked props stay
          fixed; each variant branches as its own node.
        </p>

        {/* slots */}
        <div className="grid grid-cols-2 gap-1.5">
          {MASTER_SLOTS.map((s) => {
            const Icon = s.type === "image" ? ImageIcon : Type;
            const active = selected.includes(s.id);
            const disabled = Boolean(s.locked) || (!active && selected.length >= MAX_SLOTS);
            return (
              <button
                key={s.id}
                onClick={() => !s.locked && toggleSlot(s.id)}
                disabled={disabled}
                data-active={active}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-left transition-colors",
                  disabled
                    ? "cursor-not-allowed opacity-40"
                    : "hover:bg-accent data-[active=true]:border-primary/60 data-[active=true]:bg-accent",
                )}
              >
                {s.locked ? (
                  <Lock className="size-3 shrink-0 text-lock" />
                ) : (
                  <Icon className="size-3 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 truncate text-[11px] font-medium text-foreground">{s.name}</span>
              </button>
            );
          })}
        </div>
        {selected.length >= MAX_SLOTS && (
          <p className="mt-1.5 text-[10px] text-muted-foreground">Up to {MAX_SLOTS} assets at once.</p>
        )}

        {/* per-slot instructions */}
        {selectedSlots.length > 0 && (
          <div className="mt-3 grid gap-2">
            {selectedSlots.map((s) => (
              <div key={s.id}>
                <p className="text-meta mb-1 uppercase">{s.name}</p>
                <input
                  value={instructions[s.id] ?? ""}
                  onChange={(e) => setInstructions((cur) => ({ ...cur, [s.id]: e.target.value }))}
                  placeholder={
                    s.type === "image"
                      ? "e.g. children's toys · 20 anime styles"
                      : "e.g. punchier · summer energy"
                  }
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
                />
              </div>
            ))}
          </div>
        )}

        {/* mode (only if a text slot is selected) */}
        {hasText && (
          <div className="mt-3 flex gap-1.5">
            <ModeBtn active={mode === "generate"} onClick={() => setMode("generate")}>
              Generate copy
            </ModeBtn>
            <ModeBtn active={mode === "transcreate"} onClick={() => setMode("transcreate")}>
              <Languages className="size-3" /> Transcreate
            </ModeBtn>
          </div>
        )}

        {/* count or locales */}
        {effMode === "transcreate" ? (
          <div className="mt-3">
            <p className="text-meta mb-1 uppercase">Locales</p>
            <div className="flex flex-wrap gap-1">
              {LOCALE_OPTIONS.map((l) => (
                <button
                  key={l}
                  onClick={() => toggleLocale(l)}
                  data-active={locales.includes(l)}
                  className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-accent data-[active=true]:border-primary/50 data-[active=true]:bg-accent data-[active=true]:text-foreground"
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        ) : (
          selectedSlots.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Variations per asset</span>
              <div className="ml-auto inline-flex items-center rounded-md border border-border">
                <button
                  onClick={() => setCount((c) => Math.max(1, c - 1))}
                  className="grid size-6 place-items-center text-muted-foreground hover:text-foreground"
                >
                  <Minus className="size-3" />
                </button>
                <span className="w-7 text-center font-mono text-xs text-foreground">{count}</span>
                <button
                  onClick={() => setCount((c) => Math.min(9, c + 1))}
                  className="grid size-6 place-items-center text-muted-foreground hover:text-foreground"
                >
                  <Plus className="size-3" />
                </button>
              </div>
            </div>
          )
        )}

        {/* skill */}
        {selectedSlots.length > 0 && (
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
        )}

        {/* gate */}
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              <span className="font-mono text-foreground">{total}</span> variants
            </span>
            <span>
              ~${cost} · ~{etaS}s
            </span>
          </div>
          {confirming ? (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0 text-lock" />
              <span className="flex-1 text-[11px] text-muted-foreground">Branch {total} variants?</span>
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
              disabled={total === 0}
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

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      data-active={active}
      className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent data-[active=true]:border-primary/60 data-[active=true]:bg-accent data-[active=true]:text-foreground"
    >
      {children}
    </button>
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
