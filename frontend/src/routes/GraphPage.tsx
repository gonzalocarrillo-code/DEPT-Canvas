import { useParams, useNavigate } from "react-router";
import { Lock, PenLine } from "lucide-react";
import { IdeationGraph } from "@/graph/IdeationGraph";
import { useGraphStore } from "@/graph/store";
import { Button } from "@/ui/button";

export function GraphPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const pid = projectId ?? "demo";
  const pushed = useGraphStore((s) => Boolean(s.pushed[pid]));

  // Editor-first: the graph stays gated until the design is finished and pushed.
  if (!pushed) {
    return (
      <div className="grid h-full place-items-center px-8">
        <div className="max-w-md text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-xl border border-border bg-card text-muted-foreground">
            <Lock className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">Finish your design first</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The graph opens once you push a design. Build your scene in the editor — choose
            image or video, lock what stays fixed — then <span className="text-foreground">Push to graph</span> to
            branch variations from its layers.
          </p>
          <Button variant="primary" className="mt-5" onClick={() => navigate(`/project/${pid}/editor`)}>
            <PenLine className="size-4" /> Open the editor
          </Button>
        </div>
      </div>
    );
  }

  return <IdeationGraph projectId={pid} />;
}
