import { useEffect, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
} from "@xyflow/react";
import { useShallow } from "zustand/react/shallow";
import { Download, Play, Loader2, CheckCheck } from "lucide-react";
import { useGraphStore } from "./store";
import { useGraphShortcuts } from "./useGraphShortcuts";
import { nodeTypes } from "./nodes";

function GenerateAllButton() {
  const generateAll = useGraphStore((s) => s.generateAll);
  const generating = useGraphStore((s) => s.nodes.some((n) => n.data.status === "generating"));
  const hasVariations = useGraphStore((s) => s.nodes.some((n) => n.data.kind === "variation"));
  return (
    <button
      onClick={generateAll}
      disabled={generating || !hasVariations}
      title="Re-render every variation from the current design"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent disabled:opacity-60"
    >
      {generating ? <Loader2 className="size-3.5 animate-spin text-primary" /> : <Play className="size-3.5 text-primary" />}
      {generating ? "Rendering…" : "Render all"}
    </button>
  );
}

function ApproveAllButton() {
  const approveAll = useGraphStore((s) => s.approveAll);
  const ready = useGraphStore((s) => s.nodes.some((n) => n.data.kind === "variation" && n.data.status === "done" && n.data.approval !== "approved"));
  return (
    <button
      onClick={approveAll}
      disabled={!ready}
      title="Approve every ready variation"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent disabled:opacity-40"
    >
      <CheckCheck className="size-3.5 text-success" /> Approve all
    </button>
  );
}

function ExportApprovedButton() {
  const nodes = useGraphStore((s) => s.nodes);
  const approved = nodes.filter((n) => n.data.kind === "variation" && n.data.approval === "approved");
  const exportAll = () => {
    const manifest = {
      count: approved.length,
      variations: approved.map((v) => ({ id: v.id, title: v.data.title, outputKind: v.data.outputKind, changes: v.data.changes })),
      note: "generate-once / render-many: each approved variation renders to all sizes server-side",
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "approved-variations.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      onClick={exportAll}
      disabled={approved.length === 0}
      title="Export all approved variations"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent disabled:opacity-40"
    >
      <Download className="size-3.5" /> Export approved
      {approved.length > 0 && <span className="font-mono text-primary">{approved.length}</span>}
    </button>
  );
}

function Flow({ projectId }: { projectId: string }) {
  const { fitView } = useReactFlow();
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useGraphStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
      onConnect: s.onConnect,
    })),
  );
  const loadProject = useGraphStore((s) => s.loadProject);
  useGraphShortcuts();
  const prevCount = useRef(0); // last node count we acted on
  const ready = useRef(false); // false until the first populated fit; reset on project switch
  const moving = useRef(false); // user is actively panning/zooming
  const programmatic = useRef(false); // guards our own fitView from tripping onMoveStart

  // Reset the camera state when switching projects so the new graph fits fresh.
  useEffect(() => {
    prevCount.current = 0;
    ready.current = false;
    loadProject(projectId);
  }, [projectId, loadProject]);

  // Animated auto-fit: fit on first populated paint, and zoom out with an animation
  // whenever the node count strictly GROWS (push, fan-out, paste). Never fit on
  // shrink or on data-only updates (status flips) — those don't change extents.
  useEffect(() => {
    const n = nodes.length;
    if (n === 0) {
      prevCount.current = 0;
      return;
    }
    if (n <= prevCount.current) {
      prevCount.current = n;
      return;
    }
    const first = !ready.current;
    prevCount.current = n;
    ready.current = true;
    if (!first && moving.current) return; // don't fight a user mid-pan during a fan-out
    // fitView reads mounted node bounds — wait a tick on growth so new nodes measure.
    const id = window.setTimeout(
      () => {
        if (!first && moving.current) return; // respect an active user pan
        programmatic.current = true;
        // Animate when visible; when the tab is hidden the browser pauses rAF tweens,
        // so fit INSTANTLY (duration 0) — correct framing the moment the user returns.
        const duration = document.hidden ? 0 : first ? 300 : 520;
        void fitView({ padding: 0.22, duration, maxZoom: 0.95, minZoom: 0.3 }).finally(() => {
          window.setTimeout(() => {
            programmatic.current = false;
          }, 80);
        });
      },
      first ? 0 : 90,
    );
    return () => window.clearTimeout(id);
  }, [nodes.length, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onMoveStart={() => {
        if (!programmatic.current) moving.current = true;
      }}
      onMoveEnd={() => {
        moving.current = false;
      }}
      nodeTypes={nodeTypes}
      snapToGrid
      snapGrid={[20, 20]}
      minZoom={0.3}
      maxZoom={1.5}
      deleteKeyCode={["Backspace", "Delete"]}
      onBeforeDelete={async ({ nodes: delNodes, edges: delEdges }) => {
        // The design root and brand-locked layers can't be deleted; snapshot first.
        const allowed = delNodes.filter((n) => n.data?.kind !== "design" && !n.data?.locked);
        if (!allowed.length && !delEdges.length) return false;
        useGraphStore.getState().pushHistory();
        return { nodes: allowed, edges: delEdges };
      }}
      defaultEdgeOptions={{ type: "smoothstep" }}
      proOptions={{ hideAttribution: true }}
    >
      <Panel position="top-right">
        <div className="flex items-center gap-2">
          <GenerateAllButton />
          <ApproveAllButton />
          <ExportApprovedButton />
        </div>
      </Panel>
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-grid-dot)" />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeColor="#6f66e8" maskColor="rgba(11,11,16,0.78)" />
    </ReactFlow>
  );
}

export function IdeationGraph({ projectId }: { projectId: string }) {
  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <Flow projectId={projectId} />
      </ReactFlowProvider>
    </div>
  );
}
