import { useEffect, useRef, useState } from "react";
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
import { Plus } from "lucide-react";
import { useGraphStore } from "./store";
import { useGraphShortcuts } from "./useGraphShortcuts";
import { nodeTypes } from "./nodes";
import { kindInfo, type NodeKind } from "./types";

const ADD_KINDS: NodeKind[] = [
  "brief",
  "image",
  "copy",
  "video",
  "transcreate",
  "resize",
  "animate",
  "picture-idea",
];

function AddNodeMenu() {
  const addNode = useGraphStore((s) => s.addNode);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
      >
        <Plus className="size-3.5" /> Add node
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-lg border border-border bg-popover p-1 shadow-xl">
            {ADD_KINDS.map((kind) => (
              <button
                key={kind}
                onClick={() => {
                  addNode(kind);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: `hsl(${kindInfo[kind].hue} 60% 62%)` }}
                />
                {kindInfo[kind].label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
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
      window.setTimeout(
        () => fitView({ padding: 0.35, maxZoom: 0.95, duration: 300 }),
        0,
      );
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
        // Brand-locked nodes can't be deleted; snapshot first so delete is undoable.
        const allowed = delNodes.filter((n) => !n.data?.locked);
        if (!allowed.length && !delEdges.length) return false;
        useGraphStore.getState().pushHistory();
        return { nodes: allowed, edges: delEdges };
      }}
      defaultEdgeOptions={{ type: "smoothstep" }}
      proOptions={{ hideAttribution: true }}
    >
      <Panel position="top-left">
        <AddNodeMenu />
      </Panel>
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="var(--color-grid-dot)"
      />
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
