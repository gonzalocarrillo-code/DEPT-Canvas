import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useShallow } from "zustand/react/shallow";
import {
  Play,
  Check,
  X,
  RotateCcw,
  Download,
  AlertTriangle,
  Loader2,
  Image as ImageIcon,
  Type,
  Lock,
  Languages,
  Sparkles,
  Wand2,
  BookOpen,
  Minus,
  Plus,
  Ratio,
} from "lucide-react";
import { Button } from "@/ui/button";
import { cn } from "@/lib/utils";
import { useSkillsStore } from "@/skills/skills";
import {
  LOCALE_OPTIONS,
  useBatchStore,
  type AssetSlot,
  type Variant,
  type VariantStatus,
} from "./batchStore";

const COST_PER_VARIANT = 0.04;

const statusStyle: Record<VariantStatus, string> = {
  queued: "text-muted-foreground",
  rendering: "text-primary",
  done: "text-foreground",
  approved: "text-success",
  rejected: "text-destructive",
};

export function VariationStudio() {
  const { projectId } = useParams();
  const {
    slots,
    targetSlotId,
    mode,
    instructions,
    count,
    locales,
    skillId,
    keepAspect,
    variants,
    generated,
  } = useBatchStore(
    useShallow((s) => ({
      slots: s.slots,
      targetSlotId: s.targetSlotId,
      mode: s.mode,
      instructions: s.instructions,
      count: s.count,
      locales: s.locales,
      skillId: s.skillId,
      keepAspect: s.keepAspect,
      variants: s.variants,
      generated: s.generated,
    })),
  );
  const load = useBatchStore((s) => s.load);
  const setTarget = useBatchStore((s) => s.setTarget);
  const setMode = useBatchStore((s) => s.setMode);
  const setInstructions = useBatchStore((s) => s.setInstructions);
  const setCount = useBatchStore((s) => s.setCount);
  const toggleLocale = useBatchStore((s) => s.toggleLocale);
  const setSkill = useBatchStore((s) => s.setSkill);
  const setKeepAspect = useBatchStore((s) => s.setKeepAspect);
  const generate = useBatchStore((s) => s.generate);
  const reset = useBatchStore((s) => s.reset);

  const allSkills = useSkillsStore((s) => s.skills);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    load(projectId ?? "demo");
  }, [projectId, load]);

  const slot = slots.find((s) => s.id === targetSlotId) ?? slots[0];
  const planned = mode === "transcreate" ? locales.length : count;
  const cost = (planned * COST_PER_VARIANT).toFixed(2);
  const etaS = Math.max(1, Math.round(planned * 0.7));
  const activeSkill = allSkills.find((s) => s.id === skillId);
  // transcreation only applies to copy; image slots are generate-only
  const canTranscreate = slot.type === "text";

  if (generated) {
    return <ReviewGrid variants={variants} slot={slot} onNew={reset} />;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-8 py-10">
        <p className="text-meta">SCALE · ASSET VARIATIONS</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Variation studio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One master, one asset swapped many ways. Pick an asset, describe the variations,
          and the AI renders each independently — the logo, layout and locked brand props
          stay fixed.
        </p>

        {/* Step 1 — target asset */}
        <Section step="1" title="Asset to vary">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {slots.map((s) => (
              <SlotChip
                key={s.id}
                slot={s}
                active={s.id === targetSlotId}
                onClick={() => !s.locked && setTarget(s.id)}
              />
            ))}
          </div>
        </Section>

        {/* Step 2 — how to vary it */}
        <Section step="2" title="How to vary it">
          <div className="flex gap-2">
            <ModeTab
              active={mode === "generate"}
              icon={slot.type === "image" ? ImageIcon : Wand2}
              label={slot.type === "image" ? "Generate images" : "Generate copy"}
              onClick={() => setMode("generate")}
            />
            <ModeTab
              active={mode === "transcreate"}
              icon={Languages}
              label="Transcreate"
              disabled={!canTranscreate}
              hint={!canTranscreate ? "Copy only" : undefined}
              onClick={() => canTranscreate && setMode("transcreate")}
            />
          </div>

          {mode === "generate" ? (
            <>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={
                  slot.type === "image"
                    ? "e.g. children's toys · penguin in different animated styles · 20 ways to show anime"
                    : "e.g. punchier, summer energy · benefit-led · one-word hooks"
                }
                className="mt-3 h-20 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
              />
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs text-muted-foreground">How many variations</span>
                <Stepper value={count} onChange={setCount} />
              </div>
            </>
          ) : (
            <div className="mt-3">
              <p className="text-meta mb-2 uppercase">Locales</p>
              <div className="flex flex-wrap gap-2">
                {LOCALE_OPTIONS.map((l) => (
                  <button
                    key={l}
                    onClick={() => toggleLocale(l)}
                    data-active={locales.includes(l)}
                    className="rounded-md border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent data-[active=true]:border-primary/50 data-[active=true]:bg-accent data-[active=true]:text-foreground"
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Step 3 — MD skill + options */}
        <Section step="3" title="Apply a skill (optional)">
          <p className="-mt-1 mb-3 text-xs text-muted-foreground">
            MD skills scope the AI for this asset only — e.g. Meta&apos;s ad specs for transcreation.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <SkillButton active={!skillId} onClick={() => setSkill(null)}>
              None
            </SkillButton>
            {allSkills.map((sk) => (
              <SkillButton key={sk.id} active={skillId === sk.id} onClick={() => setSkill(sk.id)}>
                {sk.name}
              </SkillButton>
            ))}
            <Link
              to="/skills"
              className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <BookOpen className="size-3.5" /> Manage skills
            </Link>
          </div>
          {activeSkill && (
            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{activeSkill.channel}</span> ·{" "}
              {activeSkill.summary}
            </div>
          )}

          <button
            onClick={() => setKeepAspect(!keepAspect)}
            className="mt-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <span
              data-on={keepAspect}
              className="relative h-5 w-9 rounded-full bg-muted transition-colors data-[on=true]:bg-primary"
            >
              <span
                data-on={keepAspect}
                className="absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform data-[on=true]:translate-x-4"
              />
            </span>
            <Ratio className="size-3.5" /> Maintain aspect ratio
            <span className="text-xs text-muted-foreground">(default)</span>
          </button>
        </Section>

        {/* Cost / count gate */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-6">
            <Stat label="Variations" value={String(planned)} />
            <Stat label="Est. cost" value={`$${cost}`} />
            <Stat label="Est. time" value={`~${etaS}s`} />
          </div>
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="size-3.5 text-lock" />
                Generate {planned} {slot.name.toLowerCase()} variation{planned === 1 ? "" : "s"} for ${cost}?
              </span>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  generate();
                  setConfirming(false);
                }}
              >
                Confirm &amp; run
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              disabled={planned === 0}
              onClick={() => setConfirming(true)}
            >
              <Play /> Generate {planned} variation{planned === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Review grid ───────────────────────────────────────────────────────────
function ReviewGrid({
  variants,
  slot,
  onNew,
}: {
  variants: Variant[];
  slot: AssetSlot;
  onNew: () => void;
}) {
  const approved = variants.filter((v) => v.status === "approved").length;
  const resolved = variants.filter((v) => v.status === "approved" || v.status === "rejected").length;
  const allApproved = variants.length > 0 && approved === variants.length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-8 py-10">
        <p className="text-meta">SCALE · PRE-RENDER &amp; APPROVE</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {variants.length} variations of {slot.name.toLowerCase()}
        </h1>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="text-success">{approved} approved</span> · {resolved}/{variants.length} reviewed
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onNew}>
              <RotateCcw /> New job
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!allApproved}
              title={allApproved ? "Export all approved variations" : "Approve every variation first"}
            >
              <Download /> Export all
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {variants.map((v) => (
            <VariantCard key={v.id} variant={v} slot={slot} />
          ))}
        </div>
      </div>
    </div>
  );
}

function VariantCard({ variant, slot }: { variant: Variant; slot: AssetSlot }) {
  const approve = useBatchStore((s) => s.approve);
  const reject = useBatchStore((s) => s.reject);
  const editVariant = useBatchStore((s) => s.editVariant);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(variant.prompt);

  const isImage = slot.type === "image";
  const busy = variant.status === "queued" || variant.status === "rendering";
  const canAct = variant.status === "done" || variant.status === "approved" || variant.status === "rejected";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card transition-colors",
        variant.status === "approved" ? "border-success/50" : "border-border",
      )}
    >
      {/* pre-render: the master with only this asset swapped */}
      <div
        className="relative grid h-28 place-items-center px-3 text-center"
        style={{
          background: isImage
            ? `radial-gradient(130% 130% at 0% 0%, hsl(${variant.hue} 55% 28%), hsl(${variant.hue} 45% 10%))`
            : "radial-gradient(130% 130% at 0% 0%, hsl(232 30% 22%), hsl(232 28% 9%))",
        }}
      >
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)",
            backgroundSize: "14px 14px",
          }}
        />
        {!isImage && (
          <span className="relative z-10 line-clamp-3 text-sm font-semibold leading-tight text-white">
            {variant.text}
          </span>
        )}
        <span className="absolute left-2 top-2 rounded bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground backdrop-blur-sm">
          {variant.label}
        </span>
        {/* locked logo stays on every variant */}
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-background/50 px-1 py-0.5 text-[9px] text-muted-foreground backdrop-blur-sm">
          <Lock className="size-2.5 text-lock" /> logo
        </span>
        {busy && (
          <span className="absolute inset-0 z-20 grid place-items-center bg-background/40 backdrop-blur-[1px]">
            <Loader2 className="size-4 animate-spin text-primary" />
          </span>
        )}
        {variant.status === "approved" && (
          <span className="absolute right-2 top-2 z-20 grid size-5 place-items-center rounded-full bg-success text-white">
            <Check className="size-3" />
          </span>
        )}
      </div>

      {editing ? (
        <div className="border-t border-border p-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tell the AI what to change…"
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary/60"
          />
          <div className="mt-1.5 flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                editVariant(variant.id, draft);
                setEditing(false);
              }}
            >
              <Sparkles /> Re-run
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-2.5 py-2">
          <span className={cn("flex items-center gap-1 text-[11px] capitalize", statusStyle[variant.status])}>
            {variant.status === "rendering" && <Loader2 className="size-3 animate-spin" />}
            {variant.status}
          </span>
          {canAct && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => {
                  setDraft(variant.prompt);
                  setEditing(true);
                }}
                title="Edit with AI"
                className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-primary"
              >
                <Sparkles className="size-3.5" />
              </button>
              <button
                onClick={() => approve(variant.id)}
                title="Approve"
                className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-success"
              >
                <Check className="size-3.5" />
              </button>
              <button
                onClick={() => reject(variant.id)}
                title="Reject"
                className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── bits ────────────────────────────────────────────────────────────────
function Section({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-5 place-items-center rounded-full border border-border font-mono text-[11px] text-muted-foreground">
          {step}
        </span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SlotChip({ slot, active, onClick }: { slot: AssetSlot; active: boolean; onClick: () => void }) {
  const Icon = slot.type === "image" ? ImageIcon : Type;
  return (
    <button
      onClick={onClick}
      disabled={slot.locked}
      data-active={active}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-left transition-colors",
        slot.locked
          ? "cursor-not-allowed opacity-50"
          : "hover:bg-accent data-[active=true]:border-primary/60 data-[active=true]:bg-accent",
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
        {slot.locked ? <Lock className="size-3.5 text-lock" /> : <Icon className="size-3.5" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-foreground">{slot.name}</span>
        <span className="block truncate text-[10px] text-muted-foreground">{slot.hint}</span>
      </span>
    </button>
  );
}

function ModeTab({
  active,
  icon: Icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  active: boolean;
  icon: typeof ImageIcon;
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-active={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "hover:bg-accent data-[active=true]:border-primary/60 data-[active=true]:bg-accent data-[active=true]:text-foreground",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className="size-4" /> {label}
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </button>
  );
}

function SkillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      data-active={active}
      className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent data-[active=true]:border-primary/50 data-[active=true]:bg-accent data-[active=true]:text-foreground"
    >
      {children}
    </button>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex items-center rounded-md border border-border">
      <button
        onClick={() => onChange(value - 1)}
        className="grid size-7 place-items-center text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="w-9 text-center font-mono text-sm text-foreground">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        className="grid size-7 place-items-center text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-meta uppercase">{label}</p>
      <p className="font-mono text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
