import { useShallow } from "zustand/react/shallow";
import { Type, Image as ImageIcon, Square, Eye, EyeOff, Lock, Trash2 } from "lucide-react";
import { useEditorStore } from "./editorStore";
import type { LayerKind } from "./types";
import { cn } from "@/lib/utils";

const kindIcon: Record<LayerKind, typeof Type> = {
  text: Type,
  image: ImageIcon,
  shape: Square,
};

export function LayersPanel() {
  const { layers, selectedId } = useEditorStore(
    useShallow((s) => ({ layers: s.layers, selectedId: s.selectedId })),
  );
  const select = useEditorStore((s) => s.select);
  const toggleVisible = useEditorStore((s) => s.toggleVisible);
  const toggleLock = useEditorStore((s) => s.toggleLock);
  const deleteLayer = useEditorStore((s) => s.deleteLayer);

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
      <div className="px-3 py-2.5 text-xs font-semibold text-foreground">Layers</div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {[...layers].reverse().map((l) => {
          const Icon = kindIcon[l.kind];
          return (
            <div
              key={l.id}
              onClick={() => select(l.id)}
              className={cn(
                "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs",
                selectedId === l.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{l.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLock(l.id);
                }}
                title={l.locked ? "Unlock" : "Lock"}
                className={cn(
                  "shrink-0 transition-opacity hover:text-foreground",
                  l.locked
                    ? "text-lock"
                    : "text-muted-foreground opacity-0 group-hover:opacity-100",
                )}
              >
                <Lock className="size-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVisible(l.id);
                }}
                className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                title={l.visible ? "Hide" : "Show"}
              >
                {l.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteLayer(l.id);
                }}
                className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                title="Delete layer"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
