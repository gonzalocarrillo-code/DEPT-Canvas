import { useEffect } from "react";
import { useParams } from "react-router";
import { Lock } from "lucide-react";
import { useEditorStore } from "./editorStore";
import { useGraphStore } from "@/graph/store";
import { EditorToolbar } from "./EditorToolbar";
import { LayersPanel } from "./LayersPanel";
import { CanvasStage } from "./CanvasStage";
import { Inspector } from "./Inspector";
import { TimelinePanel } from "./TimelinePanel";
import { useEditorShortcuts } from "./useEditorShortcuts";

export function EditorScreen() {
  const { projectId, sceneId } = useParams();
  const load = useEditorStore((s) => s.load);
  const mode = useEditorStore((s) => s.mode);
  const sceneLocked = useEditorStore((s) => s.sceneLocked);
  const loadGraph = useGraphStore((s) => s.loadProject);
  const node = useGraphStore((s) =>
    sceneId ? s.nodes.find((n) => n.id === sceneId) : undefined,
  );
  useEditorShortcuts();

  // Keep the graph loaded so a scene opened directly still resolves its node.
  useEffect(() => {
    if (projectId) loadGraph(projectId);
  }, [projectId, loadGraph]);

  // Leaving the editor with unsaved master edits flags dependent variants stale.
  useEffect(
    () => () => {
      const s = useEditorStore.getState();
      if (s.dirty && s.sceneId) useGraphStore.getState().markSetStale(s.sceneId);
    },
    [],
  );

  // Connect to the graph: the editor edits the scene behind the opened node.
  useEffect(() => {
    const id = sceneId ?? "scene";
    load(
      id,
      node
        ? {
            title: node.data.title,
            locked: Boolean(node.data.locked),
            mode: node.data.kind === "animate" ? "animate" : "design",
          }
        : { title: "Scene" },
    );
  }, [sceneId, node, load]);

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar />
      {sceneLocked && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-lock/10 px-3 py-1.5 text-[11px] text-lock">
          <Lock className="size-3.5 shrink-0" />
          Brand-locked scene (locked on the graph) — locked layers can't be edited; the
          server re-validates on save.
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <LayersPanel />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <CanvasStage />
          </div>
          {mode === "animate" && <TimelinePanel />}
        </div>
        <Inspector />
      </div>
    </div>
  );
}
