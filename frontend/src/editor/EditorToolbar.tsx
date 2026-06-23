import { useRef, useState, type ChangeEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { useNavigate, useParams } from "react-router";
import { Undo2, Redo2, Download, Plus, Type, Image as ImageIcon, Shapes, ChevronRight, Boxes, Save, Check, Loader2, FileUp } from "lucide-react";
import { Button } from "@/ui/button";
import { useEditorStore } from "./editorStore";
import { useGraphStore } from "@/graph/store";
import { saveScene } from "@/api/ai";
import { parsePsd } from "./psdImport";
import { parseSvg } from "./svgImport";
import { FORMATS, SHAPE_LIBRARY, type EditorMode, type FormatId, type LayerKind } from "./types";

const baseItems: { kind: LayerKind; label: string; icon: typeof Type }[] = [
  { kind: "text", label: "Text", icon: Type },
  { kind: "image", label: "Image", icon: ImageIcon },
];

export function EditorToolbar() {
  const { mode, format, canUndo, canRedo } = useEditorStore(
    useShallow((s) => ({
      mode: s.mode,
      format: s.format,
      canUndo: s.past.length > 0,
      canRedo: s.future.length > 0,
    })),
  );
  const setMode = useEditorStore((s) => s.setMode);
  const setFormat = useEditorStore((s) => s.setFormat);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const markSaved = useEditorStore((s) => s.markSaved);
  const markSetStale = useGraphStore((s) => s.markSetStale);
  const importScene = useEditorStore((s) => s.importScene);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    setImportMsg("Importing…");
    try {
      const isSvg = /\.svg$/i.test(file.name) || file.type.includes("svg");
      const scene = isSvg ? parseSvg(await file.text()) : parsePsd(await file.arrayBuffer());
      if (!scene.layers.length) {
        setImportMsg(scene.warnings[0] ?? "No layers found");
      } else {
        importScene(scene);
        setImportMsg(
          `Imported ${scene.layers.length} layers${scene.warnings.length ? ` · ${scene.warnings[0]}` : ""}`,
        );
      }
    } catch {
      setImportMsg("Couldn't read that file");
    }
    window.setTimeout(() => setImportMsg(null), 4000);
  };

  const onSave = async () => {
    const s = useEditorStore.getState();
    if (!s.sceneId) return;
    setSaveState("saving");
    try {
      // Locks are enforced server-side (scene-mcp set_properties). On success,
      // flag dependent variants stale so they can be re-derived from the master.
      await saveScene(s.sceneId, {
        projectId,
        layers: s.layers,
        keyframes: s.keyframes,
        locked: s.sceneLocked,
      });
      markSaved();
      markSetStale(s.sceneId);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1500);
    } catch {
      setSaveState("error");
      window.setTimeout(() => setSaveState("idle"), 2500);
    }
  };
  const navigate = useNavigate();
  const { projectId } = useParams();
  const addLayer = useEditorStore((s) => s.addLayer);
  const addShape = useEditorStore((s) => s.addShape);
  const [addOpen, setAddOpen] = useState(false);
  const [shapesOpen, setShapesOpen] = useState(false);

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Button variant="secondary" size="sm" onClick={() => setAddOpen((o) => !o)}>
            <Plus /> Add
          </Button>
          {addOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAddOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-lg border border-border bg-popover p-1 shadow-xl">
                {baseItems.map((it) => {
                  const Icon = it.icon;
                  return (
                    <button
                      key={it.kind}
                      onClick={() => {
                        addLayer(it.kind);
                        setAddOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
                    >
                      <Icon className="size-3.5 text-muted-foreground" /> {it.label}
                    </button>
                  );
                })}
                <div
                  className="relative"
                  onMouseEnter={() => setShapesOpen(true)}
                  onMouseLeave={() => setShapesOpen(false)}
                >
                  <button
                    data-active={shapesOpen}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent data-[active=true]:bg-accent"
                  >
                    <span className="flex items-center gap-2">
                      <Shapes className="size-3.5 text-muted-foreground" /> Shapes
                    </span>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </button>
                  {shapesOpen && (
                    <div className="absolute left-full top-0 z-30 ml-1 max-h-80 w-40 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-xl">
                      {SHAPE_LIBRARY.map((s) => (
                        <button
                          key={s.type}
                          onClick={() => {
                            addShape(s.type);
                            setAddOpen(false);
                            setShapesOpen(false);
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
                        >
                          <span className="size-3.5 rounded-[3px] bg-muted-foreground/40" /> {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="my-1 border-t border-border" />
                <button
                  onClick={() => {
                    fileRef.current?.click();
                    setAddOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
                >
                  <FileUp className="size-3.5 text-muted-foreground" /> Import PSD / SVG…
                </button>
              </div>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".psd,.svg,image/svg+xml,image/vnd.adobe.photoshop"
            onChange={onImportFile}
            className="hidden"
          />
        </div>

        {importMsg && <span className="text-xs text-muted-foreground">{importMsg}</span>}

        <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
          {(["design", "animate"] as EditorMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              data-active={mode === m}
              className="rounded-md px-3 py-1 text-xs font-medium capitalize text-muted-foreground transition-colors data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {(Object.keys(FORMATS) as FormatId[]).map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            data-active={format === f}
            className="rounded-md border border-transparent px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent data-[active=true]:border-primary/50 data-[active=true]:bg-accent data-[active=true]:text-foreground"
          >
            {FORMATS[f].label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent"
          title="Undo (⌘Z)"
        >
          <Undo2 className="size-4" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent"
          title="Redo (⌘⇧Z)"
        >
          <Redo2 className="size-4" />
        </button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button
          variant="secondary"
          size="sm"
          onClick={onSave}
          disabled={saveState === "saving"}
          title="Save edits (locks enforced server-side)"
        >
          {saveState === "saving" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : saveState === "saved" ? (
            <Check className="size-3.5 text-success" />
          ) : (
            <Save className="size-3.5" />
          )}
          {saveState === "saved" ? "Saved" : saveState === "error" ? "Retry" : "Save"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/project/${projectId ?? "demo"}/graph`)}
          title="Fan out variations on the graph"
        >
          <Boxes className="size-3.5" /> Variations
        </Button>
        <Button variant="primary" size="sm">
          <Download className="size-3.5" /> Export
        </Button>
      </div>
    </div>
  );
}
