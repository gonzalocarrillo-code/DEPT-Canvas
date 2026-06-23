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
} from "lucide-react";
import type { CanvasNodeData, NodeKind, NodeStatus } from "../types";
import { kindInfo } from "../types";
import { useGraphStore } from "../store";
import { TransformMenu } from "../TransformMenu";
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
};

const statusInfo: Record<
  NodeStatus,
  { icon: typeof Check; cls: string; label: string }
> = {
  idle: { icon: Circle, cls: "text-muted-foreground", label: "Idle" },
  queued: { icon: Clock, cls: "text-muted-foreground", label: "Queued" },
  generating: { icon: Loader2, cls: "text-primary animate-spin", label: "Generating" },
  done: { icon: Check, cls: "text-success", label: "Ready" },
  error: { icon: AlertTriangle, cls: "text-destructive", label: "Error" },
};

function NodeCardImpl({ id, data: raw, selected }: NodeProps) {
  const data = raw as CanvasNodeData;
  const updateNodeData = useGraphStore((s) => s.updateNodeData);
  const addChild = useGraphStore((s) => s.addChild);
  const navigate = useNavigate();
  const { projectId } = useParams();
  const pid = projectId ?? "demo";
  const [menuOpen, setMenuOpen] = useState(false);

  const Icon = kindIcon[data.kind];
  const status = statusInfo[data.status];
  const StatusIcon = status.icon;
  const hue = data.hue ?? kindInfo[data.kind].hue;
  const locked = Boolean(data.locked);

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

      <div className="flex items-center gap-2 px-3 pt-3">
        <span
          className="grid size-6 shrink-0 place-items-center rounded-md"
          style={{ background: `hsl(${hue} 50% 22%)`, color: `hsl(${hue} 75% 80%)` }}
        >
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
          {data.title}
        </span>
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
            style={{
              background: `radial-gradient(130% 130% at 0% 0%, hsl(${hue} 55% 26%), hsl(${hue} 45% 10%))`,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)",
                backgroundSize: "14px 14px",
              }}
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
      </div>

      <div className="flex items-center gap-2 px-3 pb-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5">
          <span
            className="size-1.5 rounded-full"
            style={{ background: `hsl(${hue} 60% 62%)` }}
          />
          {data.model ?? kindInfo[data.kind].defaultModel}
        </span>
        {data.mode && <span className="capitalize">{data.mode}</span>}
        {displayCount > 0 && (
          <span className="ml-auto font-mono">×{displayCount}</span>
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
        <button
          onClick={regenerate}
          disabled={locked}
          title={locked ? "Brand-locked — regeneration disabled" : "Regenerate"}
          className={cn(
            "nodrag grid size-7 place-items-center rounded-md text-muted-foreground transition-colors",
            locked
              ? "cursor-not-allowed opacity-40"
              : "hover:bg-accent hover:text-foreground",
          )}
        >
          <RefreshCw className="size-3.5" />
        </button>
        <button
          title="Download"
          className="nodrag grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Download className="size-3.5" />
        </button>
        <button
          onClick={() => navigate(`/project/${pid}/editor/${id}`)}
          title="Open in editor"
          className="nodrag grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <PenLine className="size-3.5" />
        </button>
        <div className="relative ml-auto">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            title="Transform"
            className="nodrag inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Plus className="size-3.5" /> Transform
          </button>
          {menuOpen && (
            <TransformMenu onSelect={spawn} onClose={() => setMenuOpen(false)} />
          )}
        </div>
      </div>
    </div>
  );
}

export const NodeCard = memo(NodeCardImpl);
