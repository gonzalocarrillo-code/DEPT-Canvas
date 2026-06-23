import { Languages, Scaling, Play, ImagePlus, Copy } from "lucide-react";
import type { NodeKind } from "./types";

const items: {
  kind: NodeKind;
  label: string;
  hint: string;
  icon: typeof Copy;
}[] = [
  { kind: "transcreate", label: "Transcreate", hint: "T", icon: Languages },
  { kind: "resize", label: "Resize", hint: "R", icon: Scaling },
  { kind: "animate", label: "Animate", hint: "A", icon: Play },
  { kind: "picture-idea", label: "New picture idea", hint: "N", icon: ImagePlus },
  { kind: "copy", label: "Copy variants", hint: "C", icon: Copy },
];

export function TransformMenu({
  onSelect,
  onClose,
}: {
  onSelect: (kind: NodeKind) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-border bg-popover p-1 shadow-xl">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.kind}
              onClick={() => onSelect(it.kind)}
              className="nodrag flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
            >
              <Icon className="size-3.5 text-muted-foreground" />
              <span className="flex-1">{it.label}</span>
              <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
                {it.hint}
              </kbd>
            </button>
          );
        })}
      </div>
    </>
  );
}
