import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useNavigate, useParams } from "react-router";
import {
  FileText,
  Image as ImageIcon,
  Type,
  Film,
  Languages,
  Scaling,
  Play,
  ImagePlus,
  Lock,
  RefreshCw,
  Download,
  Plus,
  Check,
  Clock,
  Loader2,
  AlertTriangle,
  Circle,
  PenLine,
  Sparkles,
  Boxes,
  X,
} from "lucide-react";
import type { CanvasNodeData, NodeKind, NodeStatus } from "../types";
import { kindInfo } from "../types";
import { useGraphStore } from "../store";
import { TransformMenu } from "../TransformMenu";
import { VariationComposer } from "../VariationComposer";
import { MASTER_SLOTS } from "@/batch/batchStore";
import { useSkillsStore } from "@/skills/skills";
import { cn } from "@/lib/utils";

const kindIcon: Record<NodeKind, typeof FileText> = {
  brief: FileText,
  image: ImageIcon,
  copy: Type,
  video: Film,
  transcreate: Languages,
  resize: Scaling,
  animate: Play,
  "picture-idea": ImagePlus,
  "variation-set": Boxes,
  variant: ImageIcon,
};

const statusInfo: Record<NodeStatus, { icon: typeof Check; cls: string; label: string }> = {
  idle: { icon: Circle, cls: "text-muted-foreground", label: "Idle" },
  queued: { icon: Clock, cls: "text-muted-foreground", label: "Queued" },
  generating: { icon: Loader2, cls: "text-primary animate-spin", label: "Generating" },
  done: { icon: Check, cls: "text-success", label: "Ready" },
  error: { icon: AlertTriangle, cls: "text-destructive", label: "Error" },
};

function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function NodeCardImpl({ id, data: raw, selected }: NodeProps) {
  const data = raw as CanvasNodeData;
  if (data.kind === "variant") return <VariantNode id={id} data={data} selected={selected} />;
  if (data.kind === "variation-set") return <VariationSetNode id={id} data={data} selected={selected} />;
  return <GenericNode id={id} data={data} selected={selected} />;
}

// ── Generic ideation/asset node (brief, image, copy, …) ──────────────────
function GenericNode({ id, data, selected }: { id: string; data: CanvasNodeData; selected?: boolean }) {
  const updateNodeData = useGraphStore((s) => s.updateNodeData);
  const addChild = useGraphStore((s) => s.addChild);
  const navigate = useNavigate();
  const { projectId } = useParams();
  const pid = projectId ?? "demo";
  const [menuOpen, setMenuOpen] = useState(false);
  const [varyOpen, setVaryOpen] = useState(false);
  const skills = useSkillsStore((s) => s.skills);

  const Icon = kindIcon[data.kind];
  const status = statusInfo[data.status];
  const StatusIcon = status.icon;
  const hue = data.hue ?? kindInfo[data.kind].hue;
  const locked = Boolean(data.locked);
  const isGenerating = data.status === "generating";
  // Every generation process carries a prompt + an optional MD skill.
  const hasSkill = data.kind !== "brief";
  // The master + any finished visual asset can fan out variations.
  const canVary =
    !locked && data.status === "done" && (data.kind === "image" || data.kind === "video");

  const regenerate = () => {
    if (locked) return;
    updateNodeData(id, { status: "generating" });
    window.setTimeout(() => updateNodeData(id, { status: "done" }), 1400);
  };
  const spawn = (kind: NodeKind) => {
    addChild(id, kind);
    setMenuOpen(false);
  };

  const showThumbnail = data.status === "done" && data.kind !== "brief";
  const displayCount = data.count ?? 0;

  return (
    <div
      className={cn(
        "relative w-60 rounded-xl border bg-card shadow-sm",
        selected ? "border-primary/70 ring-2 ring-primary/30" : "border-border",
        locked && "border-lock/50",
      )}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      {isGenerating && (
        <div className="absolute inset-0 z-20 grid place-items-center rounded-xl bg-background/65 backdrop-blur-[1px]">
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Loader2 className="size-4 animate-spin" /> Generating…
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 px-3 pt-3">
        <span
          className="grid size-6 shrink-0 place-items-center rounded-md"
          style={{ background: `hsl(${hue} 50% 22%)`, color: `hsl(${hue} 75% 80%)` }}
        >
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{data.title}</span>
        {locked ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded border border-lock/40 px-1 py-0.5 text-[10px] font-medium text-lock">
            <Lock className="size-2.5" /> Locked
          </span>
        ) : (
          <StatusIcon className={cn("size-3.5 shrink-0", status.cls)} />
        )}
      </div>

      <div className="px-3 py-2">
        {showThumbnail ? (
          <div
            className="relative h-24 w-full overflow-hidden rounded-md"
            style={{ background: `radial-gradient(130% 130% at 0% 0%, hsl(${hue} 55% 26%), hsl(${hue} 45% 10%))` }}
          >
            <div
              className="absolute inset-0"
              style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)", backgroundSize: "14px 14px" }}
            />
          </div>
        ) : (
          <textarea
            className="nodrag h-16 w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
            placeholder="Describe what to generate…"
            value={data.prompt ?? ""}
            onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
          />
        )}
        {hasSkill && (
          <label className="mt-2 flex items-center gap-1.5">
            <Sparkles className="size-3 shrink-0 text-primary" />
            <select
              value={data.skillId ?? ""}
              onChange={(e) => updateNodeData(id, { skillId: e.target.value || null })}
              title="MD skill — scopes the AI for this process"
              className="nodrag min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-1 text-[11px] text-foreground outline-none focus:border-primary/60"
            >
              <option value="">No skill</option>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-2 px-3 pb-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5">
          <span className="size-1.5 rounded-full" style={{ background: `hsl(${hue} 60% 62%)` }} />
          {data.model ?? kindInfo[data.kind].defaultModel}
        </span>
        {data.mode && <span className="capitalize">{data.mode}</span>}
        {displayCount > 0 && <span className="ml-auto font-mono">×{displayCount}</span>}
      </div>

      <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
        <button
          onClick={regenerate}
          disabled={locked}
          title={locked ? "Brand-locked — regeneration disabled" : "Regenerate"}
          className={cn(
            "nodrag grid size-7 place-items-center rounded-md text-muted-foreground transition-colors",
            locked ? "cursor-not-allowed opacity-40" : "hover:bg-accent hover:text-foreground",
          )}
        >
          <RefreshCw className="size-3.5" />
        </button>
        <button
          onClick={() => navigate(`/project/${pid}/editor/${id}`)}
          title="Open in editor"
          className="nodrag grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <PenLine className="size-3.5" />
        </button>
        {canVary && (
          <div className="relative">
            <button
              onClick={() => setVaryOpen((o) => !o)}
              title="Generate variations"
              className="nodrag inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-accent"
            >
              <Sparkles className="size-3.5" /> Vary
            </button>
            {varyOpen && <VariationComposer masterId={id} onClose={() => setVaryOpen(false)} />}
          </div>
        )}
        <div className="relative ml-auto">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            title="Transform"
            className="nodrag inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Plus className="size-3.5" /> Transform
          </button>
          {menuOpen && <TransformMenu onSelect={spawn} onClose={() => setMenuOpen(false)} />}
        </div>
      </div>
    </div>
  );
}

// ── Variant node (one produced scene branched off a set) ─────────────────
function VariantNode({ id, data, selected }: { id: string; data: CanvasNodeData; selected?: boolean }) {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const pid = projectId ?? "demo";
  const approveVariant = useGraphStore((s) => s.approveVariant);
  const rejectVariant = useGraphStore((s) => s.rejectVariant);
  const reDeriveVariant = useGraphStore((s) => s.reDeriveVariant);

  const hue = data.hue ?? 200;
  const busy = data.status === "generating" || data.status === "queued";
  const approved = data.approval === "approved";
  const rejected = data.approval === "rejected";
  const isText = Boolean(data.variantText);

  return (
    <div
      className={cn(
        "relative w-52 overflow-hidden rounded-xl border bg-card shadow-sm transition-opacity",
        approved ? "border-success/60" : selected ? "border-primary/70 ring-2 ring-primary/30" : "border-border",
        rejected && "opacity-45",
      )}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      <div
        className="relative grid h-24 place-items-center px-3 text-center"
        style={{
          background: isText
            ? "radial-gradient(130% 130% at 0% 0%, hsl(232 30% 22%), hsl(232 28% 9%))"
            : `radial-gradient(130% 130% at 0% 0%, hsl(${hue} 55% 28%), hsl(${hue} 45% 10%))`,
        }}
      >
        {data.imageUrl && (
          <img src={data.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div
          className="absolute inset-0 opacity-60"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)", backgroundSize: "13px 13px" }}
        />
        {isText && (
          <span className="relative z-10 line-clamp-3 text-xs font-semibold leading-tight text-white">
            {data.variantText}
          </span>
        )}
        <span className="absolute left-1.5 top-1.5 rounded bg-background/60 px-1 py-0.5 font-mono text-[9px] text-foreground backdrop-blur-sm">
          {data.delta}
        </span>
        <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded bg-background/50 px-1 py-0.5 text-[8px] text-muted-foreground backdrop-blur-sm">
          <Lock className="size-2 text-lock" /> logo
        </span>
        {busy && (
          <span className="absolute inset-0 z-20 grid place-items-center bg-background/40 backdrop-blur-[1px]">
            <Loader2 className="size-4 animate-spin text-primary" />
          </span>
        )}
        {approved && (
          <span className="absolute right-1.5 top-1.5 z-20 grid size-4 place-items-center rounded-full bg-success text-white">
            <Check className="size-2.5" />
          </span>
        )}
        {data.stale && (
          <span className="absolute left-1.5 bottom-1.5 z-20 rounded bg-lock/80 px-1 py-0.5 text-[8px] font-medium text-lock-foreground">
            stale
          </span>
        )}
      </div>

      <div className="flex items-center gap-0.5 border-t border-border px-1.5 py-1">
        <button
          onClick={() => navigate(`/project/${pid}/editor/${id}`)}
          title="Open in editor"
          className="nodrag grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <PenLine className="size-3" />
        </button>
        <button
          onClick={() => downloadJSON(`${data.delta ?? id}.json`, { variant: id, ...data })}
          disabled={!approved}
          title={approved ? "Export this variant" : "Approve to export"}
          className="nodrag grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
        >
          <Download className="size-3" />
        </button>
        {data.stale && !busy && (
          <button
            onClick={() => reDeriveVariant(id)}
            title="Re-derive from the updated master"
            className="nodrag grid size-6 place-items-center rounded text-lock hover:bg-accent"
          >
            <RefreshCw className="size-3" />
          </button>
        )}
        {!busy && (
          <div className="ml-auto flex items-center gap-0.5">
            <button
              onClick={() => approveVariant(id)}
              title="Approve"
              className={cn(
                "nodrag grid size-6 place-items-center rounded hover:bg-accent",
                approved ? "text-success" : "text-muted-foreground hover:text-success",
              )}
            >
              <Check className="size-3.5" />
            </button>
            <button
              onClick={() => rejectVariant(id)}
              title="Reject"
              className={cn(
                "nodrag grid size-6 place-items-center rounded hover:bg-accent",
                rejected ? "text-destructive" : "text-muted-foreground hover:text-destructive",
              )}
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Variation-set node (the multi-slot job) ──────────────────────────────
function VariationSetNode({ id, data, selected }: { id: string; data: CanvasNodeData; selected?: boolean }) {
  const approveAllInSet = useGraphStore((s) => s.approveAllInSet);
  const allNodes = useGraphStore((s) => s.nodes);
  const variants = allNodes.filter((n) => n.data.kind === "variant" && n.data.setId === id);

  const done = variants.filter((v) => v.data.status === "done").length;
  const approved = variants.filter((v) => v.data.approval === "approved");
  const hue = data.hue ?? 175;
  const slotNames = (data.targetSlotIds ?? [])
    .map((sid) => MASTER_SLOTS.find((s) => s.id === sid)?.name ?? sid)
    .join(" · ");

  const exportApproved = () =>
    downloadJSON(`variations-${id}.json`, {
      set: id,
      slots: data.targetSlotIds,
      mode: data.variationMode,
      skillId: data.skillId,
      approved: approved.map((v) => ({ id: v.id, delta: v.data.delta, slot: v.data.slotId })),
      note: "generate-once / render-many: each approved scene renders to all sizes at export",
    });

  return (
    <div
      className={cn(
        "relative w-56 rounded-xl border bg-card shadow-sm",
        selected ? "border-primary/70 ring-2 ring-primary/30" : "border-border",
      )}
      style={{ borderColor: selected ? undefined : `hsl(${hue} 40% 35% / 0.5)` }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      <div className="flex items-center gap-2 px-3 pt-3">
        <span className="grid size-6 shrink-0 place-items-center rounded-md" style={{ background: `hsl(${hue} 50% 22%)`, color: `hsl(${hue} 75% 80%)` }}>
          <Boxes className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">Variations</span>
        <span className="font-mono text-[10px] text-muted-foreground">{variants.length}</span>
      </div>

      <div className="px-3 py-2">
        <p className="truncate text-[11px] text-muted-foreground" title={slotNames}>
          {slotNames || "—"}
        </p>
        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="rounded border border-border px-1.5 py-0.5 capitalize">{data.variationMode}</span>
          {data.skillId && <span className="rounded border border-primary/40 px-1.5 py-0.5 text-primary">skill</span>}
          <span className="ml-auto text-success">{approved.length}/{variants.length} approved</span>
        </div>
      </div>

      <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
        <button
          onClick={() => approveAllInSet(id)}
          disabled={done === 0}
          title="Approve all ready variants"
          className="nodrag inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-success disabled:opacity-40"
        >
          <Check className="size-3.5" /> Approve all
        </button>
        <button
          onClick={exportApproved}
          disabled={approved.length === 0}
          title="Export approved variants"
          className="nodrag ml-auto inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-40"
        >
          <Download className="size-3.5" /> Export
        </button>
      </div>
    </div>
  );
}

export const NodeCard = memo(NodeCardImpl);
