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
  const didFit = useRef(false);

  useEffect(() => {
    didFit.current = false;
    loadProject(projectId);
  }, [projectId, loadProject]);

  useEffect(() => {
    if (!didFit.current && nodes.length > 0) {
      didFit.current = true;
      window.setTimeout(() => fitView({ padding: 0.3, maxZoom: 0.95, duration: 300 }), 0);
    }
  }, [nodes.length, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
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
