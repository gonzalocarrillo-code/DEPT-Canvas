import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useNavigate, useParams } from "react-router";
import {
  Image as ImageIcon,
  Type,
  Square,
  Film,
  Layers,
  Lock,
  PenLine,
  Plus,
  Sparkles,
  Check,
  CheckCheck,
  X,
  Download,
  RefreshCw,
  Loader2,
  Play,
} from "lucide-react";
import type { CanvasNodeData, LayerKindTag } from "../types";
import { kindInfo } from "../types";
import { useGraphStore, splitValues } from "../store";
import { cn } from "@/lib/utils";

const layerIcon: Record<LayerKindTag, typeof Type> = {
  text: Type,
  image: ImageIcon,
  graphic: Square,
};

const changePlaceholder: Record<LayerKindTag, string> = {
  text: "e.g. translate to Chinese · punchier hook",
  image: "e.g. swap to a Chinese flag backdrop",
  graphic: "e.g. recolor to brand red · rounder corners",
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
  if (data.kind === "design") return <DesignNode id={id} data={data} selected={selected} />;
  if (data.kind === "layer") return <LayerNode id={id} data={data} selected={selected} />;
  return <VariationNode id={id} data={data} selected={selected} />;
}

// ── Design (the master scene pushed from the editor) ─────────────────────
function DesignNode({ id, data, selected }: { id: string; data: CanvasNodeData; selected?: boolean }) {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const pid = projectId ?? "demo";
  const addVariation = useGraphStore((s) => s.addVariation);
  const approveAll = useGraphStore((s) => s.approveAll);
  // Select the stable nodes reference and derive in the body — a selector that
  // returns a new array each render breaks useSyncExternalStore (React #185).
  const allNodes = useGraphStore((s) => s.nodes);
  const variations = allNodes.filter((n) => n.data.kind === "variation");
  const approved = variations.filter((v) => v.data.approval === "approved");
  const hue = data.hue ?? kindInfo.design.hue;
  const isVideo = data.outputKind === "video";
  const layerCount = data.layers?.length ?? 0;
  // How many variations the next "+ Variation" will fan out: the longest value list
  // across unlocked layers that carry a change (values zip by index).
  const contributing = allNodes.filter((n) => n.data.kind === "layer" && !n.data.locked && splitValues(n.data.change as string).length > 0);
  const fanout = contributing.length ? Math.min(24, Math.max(...contributing.map((n) => splitValues(n.data.change as string).length))) : 0;

  const exportApproved = () =>
    downloadJSON(`design-${pid}-approved.json`, {
      design: data.title,
      outputKind: data.outputKind,
      approved: approved.map((v) => ({ id: v.id, title: v.data.title, changes: v.data.changes })),
      note: "generate-once / render-many: each approved variation renders to all sizes at export",
    });

  return (
    <div
      className={cn(
        "relative w-60 rounded-xl border bg-card shadow-sm",
        selected ? "border-primary/70 ring-2 ring-primary/30" : "border-border",
      )}
      style={{ borderColor: selected ? undefined : `hsl(${hue} 45% 38% / 0.6)` }}
    >
      <Handle type="source" position={Position.Right} />
      <div className="flex items-center gap-2 px-3 pt-3">
        <span className="grid size-6 shrink-0 place-items-center rounded-md" style={{ background: `hsl(${hue} 50% 22%)`, color: `hsl(${hue} 75% 82%)` }}>
          <Layers className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{data.title}</span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">
          {isVideo ? <Film className="size-2.5" /> : <ImageIcon className="size-2.5" />}
          {data.outputKind ?? "image"}
        </span>
      </div>

      <div
        className="relative mx-3 mt-2 h-20 overflow-hidden rounded-md"
        style={{ background: `radial-gradient(130% 130% at 0% 0%, hsl(${hue} 55% 26%), hsl(${hue} 45% 10%))` }}
      >
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)", backgroundSize: "14px 14px" }} />
        <span className="absolute bottom-1.5 left-1.5 rounded bg-background/55 px-1 py-0.5 text-[9px] text-muted-foreground backdrop-blur-sm">
          master · single source of truth
        </span>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground">
        <span className="font-mono">{layerCount} layers</span>
        <span className="ml-auto font-mono text-success">{approved.length}/{variations.length} approved</span>
      </div>

      <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
        <button
          onClick={() => navigate(`/project/${pid}/editor/design`)}
          title="Edit the design"
          className="nodrag grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <PenLine className="size-3.5" />
        </button>
        <button
          onClick={() => addVariation(id)}
          title="Fan out variations — each layer's lines zip into aligned variations"
          className="nodrag inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-3.5" /> {fanout > 1 ? `${fanout} variations` : "Variation"}
        </button>
        <button
          onClick={approveAll}
          disabled={variations.every((v) => v.data.status !== "done")}
          title="Approve all ready variations"
          className="nodrag ml-auto grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-success disabled:opacity-40"
        >
          <CheckCheck className="size-3.5" />
        </button>
        <button
          onClick={exportApproved}
          disabled={approved.length === 0}
          title="Export approved variations"
          className="nodrag grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <Download className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Layer (one per layer of the design; authors a change, feeds variations) ──
function LayerNode({ id, data, selected }: { id: string; data: CanvasNodeData; selected?: boolean }) {
  const updateNodeData = useGraphStore((s) => s.updateNodeData);
  const composeVariation = useGraphStore((s) => s.composeVariation);
  const edges = useGraphStore((s) => s.edges);
  const navigate = useNavigate();
  const { projectId } = useParams();
  const pid = projectId ?? "demo";
  const locked = Boolean(data.locked);
  const kind = (data.layerKind as LayerKindTag) ?? "image";
  const Icon = layerIcon[kind];
  const hue = locked ? 38 : kindInfo.layer.hue;
  const valueCount = splitValues(data.change as string).length;

  // Re-render every variation this layer feeds when its change is committed.
  const recomposeConnected = () => {
    edges.filter((e) => e.source === id).forEach((e) => composeVariation(e.target));
  };

  return (
    <div
      className={cn(
        "relative w-56 rounded-xl border bg-card shadow-sm",
        locked && "border-lock/50",
        !locked && selected ? "border-primary/70 ring-2 ring-primary/30" : "border-border",
      )}
    >
      <Handle type="target" position={Position.Left} />
      {!locked && <Handle type="source" position={Position.Right} />}

      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span className="grid size-6 shrink-0 place-items-center rounded-md" style={{ background: `hsl(${hue} 45% 20%)`, color: `hsl(${hue} 70% 80%)` }}>
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{data.layerName ?? data.title}</span>
        {locked ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded border border-lock/40 px-1 py-0.5 text-[10px] font-medium text-lock">
            <Lock className="size-2.5" /> Locked
          </span>
        ) : valueCount > 1 ? (
          <span className="shrink-0 rounded border border-primary/50 px-1 py-0.5 font-mono text-[10px] text-primary" title={`${valueCount} values → ${valueCount} variations`}>×{valueCount}</span>
        ) : (
          <span className="shrink-0 rounded border border-border px-1 py-0.5 text-[9px] uppercase text-muted-foreground">{kind}</span>
        )}
      </div>

      <div className="px-3 py-2">
        {locked ? (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Locked in the editor — stays fixed in every variation.
          </p>
        ) : (
          <>
            <textarea
              value={(data.change as string) ?? ""}
              onChange={(e) => updateNodeData(id, { change: e.target.value })}
              onBlur={recomposeConnected}
              placeholder={changePlaceholder[kind]}
              className="nodrag h-12 w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-[11px] leading-snug text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
            />
            <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Sparkles className="size-2.5 text-primary" />
              <span>{valueCount > 1 ? `${valueCount} lines → ${valueCount} variations` : "One line per variation"}</span>
              <button
                onClick={() => navigate(`/project/${pid}/editor/design`)}
                title="Edit this layer in the editor"
                className="nodrag ml-auto grid size-5 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <PenLine className="size-3" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Variation (the composed pre-render of all connected layer changes) ────
function VariationNode({ id, data, selected }: { id: string; data: CanvasNodeData; selected?: boolean }) {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const pid = projectId ?? "demo";
  const approveVariant = useGraphStore((s) => s.approveVariant);
  const rejectVariant = useGraphStore((s) => s.rejectVariant);
  const composeVariation = useGraphStore((s) => s.composeVariation);

  const hue = data.hue ?? 175;
  const busy = data.status === "generating" || data.status === "queued";
  const approved = data.approval === "approved";
  const rejected = data.approval === "rejected";
  const isVideo = data.outputKind === "video";
  const changes = data.changes ?? [];

  return (
    <div
      className={cn(
        "relative w-56 overflow-hidden rounded-xl border bg-card shadow-sm transition-opacity",
        approved ? "border-success/60" : selected ? "border-primary/70 ring-2 ring-primary/30" : "border-border",
        rejected && "opacity-45",
      )}
    >
      <Handle type="target" position={Position.Left} />

      <div
        className="relative grid h-24 place-items-center"
        style={{ background: `radial-gradient(130% 130% at 0% 0%, hsl(${hue} 55% 28%), hsl(${hue} 45% 10%))` }}
      >
        {data.imageUrl && <img src={data.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)", backgroundSize: "13px 13px" }} />
        {isVideo && !busy && (
          <span className="relative z-10 grid size-8 place-items-center rounded-full bg-background/55 text-foreground backdrop-blur-sm">
            <Play className="size-3.5" />
          </span>
        )}
        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-background/60 px-1 py-0.5 text-[8px] text-muted-foreground backdrop-blur-sm">
          {isVideo ? <Film className="size-2" /> : <ImageIcon className="size-2" />} {data.outputKind ?? "image"}
        </span>
        {busy && (
          <span className="absolute inset-0 z-20 grid place-items-center bg-background/45 backdrop-blur-[1px]">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
              <Loader2 className="size-4 animate-spin" /> Pre-rendering…
            </span>
          </span>
        )}
        {approved && (
          <span className="absolute right-1.5 top-1.5 z-20 grid size-4 place-items-center rounded-full bg-success text-white">
            <Check className="size-2.5" />
          </span>
        )}
        {data.stale && !busy && (
          <span className="absolute bottom-1.5 left-1.5 z-20 rounded bg-lock/80 px-1 py-0.5 text-[8px] font-medium text-lock-foreground">stale</span>
        )}
      </div>

      <div className="px-2.5 py-2">
        <p className="truncate text-[11px] font-medium text-foreground" title={data.title}>{data.title}</p>
        <div className="mt-1 grid gap-0.5">
          {changes.length ? (
            changes.map((c) => (
              <div key={c.layerId} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="shrink-0 rounded bg-secondary px-1 py-0.5 text-[8px] uppercase">{c.layerName}</span>
                <span className="truncate" title={c.change}>{c.change}</span>
              </div>
            ))
          ) : (
            <p className="text-[10px] text-muted-foreground">Connect a layer with a change →</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 border-t border-border px-1.5 py-1">
        <button
          onClick={() => navigate(`/project/${pid}/editor/${id}`)}
          title="Open this variation in the editor"
          className="nodrag grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <PenLine className="size-3" />
        </button>
        <button
          onClick={() => downloadJSON(`${data.title || id}.json`, { variation: id, ...data })}
          disabled={!approved}
          title={approved ? "Export this variation" : "Approve to export"}
          className="nodrag grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
        >
          <Download className="size-3" />
        </button>
        {data.stale && !busy && (
          <button
            onClick={() => composeVariation(id)}
            title="Re-render from the updated design"
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
              className={cn("nodrag grid size-6 place-items-center rounded hover:bg-accent", approved ? "text-success" : "text-muted-foreground hover:text-success")}
            >
              <Check className="size-3.5" />
            </button>
            <button
              onClick={() => rejectVariant(id)}
              title="Reject"
              className={cn("nodrag grid size-6 place-items-center rounded hover:bg-accent", rejected ? "text-destructive" : "text-muted-foreground hover:text-destructive")}
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export const NodeCard = memo(NodeCardImpl);
