import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, Loader2, AlertTriangle, Wand2, Check } from "lucide-react";
import { Button } from "@/ui/button";
import { getAiStatus, requestPlan } from "@/api/ai";
import { useProjectsStore } from "@/store/projectsStore";
import { useGraphStore } from "@/graph/store";

interface PlanShape {
  master: { title: string; prompt: string };
  nodes: { kind: string; title: string; prompt: string }[];
  rationale?: string;
  estimatedCostUsd?: number;
}

const STARTER: PlanShape = {
  master: { title: "Master keyframe", prompt: "Hero visual for the campaign." },
  nodes: [
    { kind: "copy", title: "Headline + variants", prompt: "Generate 3 on-brand headline options." },
    { kind: "transcreate", title: "Transcreate ES / FR / DE", prompt: "Localize the headline for ES, FR, DE." },
    { kind: "resize", title: "Resize 9:16 / 1:1 / 16:9", prompt: "Reframe the master for each placement." },
    { kind: "animate", title: "Animate intro", prompt: "Add a tasteful in/out animation." },
  ],
};

export function BriefComposer() {
  const navigate = useNavigate();
  const createProject = useProjectsStore((s) => s.createProject);
  const buildFromPlan = useGraphStore((s) => s.buildFromPlan);
  const [brief, setBrief] = useState("");

  const status = useQuery({
    queryKey: ["ai-status"],
    queryFn: getAiStatus,
    retry: false,
    staleTime: 60_000,
  });
  const planM = useMutation({ mutationFn: () => requestPlan(brief) });

  const configured = status.data?.configured ?? false;
  const plan = planM.data;

  const approve = (p: PlanShape) => {
    const project = createProject({ name: brief.slice(0, 48) || "New campaign", entry: "brief" });
    buildFromPlan(project.id, p);
    navigate(`/project/${project.id}/graph`);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-12">
        <button
          onClick={() => navigate("/new")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </button>

        <div className="mt-4 flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Start from a brief</h1>
            <p className="text-sm text-muted-foreground">
              The planner drafts a node workflow you approve before anything runs.
            </p>
          </div>
        </div>

        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={5}
          placeholder="e.g. Fall/Winter launch for Aurora Apparel — bold and optimistic, headline “New season, new you.”, hero on-model shot, EN/ES/FR, 1:1 + 9:16 + 16:9, short intro animation."
          className="mt-6 w-full resize-none rounded-lg border border-border bg-card px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none focus:border-primary/60"
        />

        {status.isFetched && !configured && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-lock" />
            <span>
              AI planner not connected. Add{" "}
              <code className="font-mono text-foreground">OPENAI_API_KEY</code> to{" "}
              <code className="font-mono text-foreground">frontend/.env.local</code> and
              restart the dev server — or use a starter workflow below.
            </span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            disabled={!brief.trim() || planM.isPending || !configured}
            onClick={() => planM.mutate()}
          >
            {planM.isPending ? <Loader2 className="animate-spin" /> : <Wand2 />} Draft plan
          </Button>
          {!configured && (
            <Button variant="outline" onClick={() => approve(STARTER)}>
              Use a starter workflow
            </Button>
          )}
        </div>

        {planM.error && (
          <p className="mt-3 text-xs text-destructive">
            {(planM.error as Error).message}
          </p>
        )}

        {plan && (
          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <p className="text-meta uppercase">Proposed workflow</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">
              {plan.master.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{plan.master.prompt}</p>
            {plan.rationale && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">
                {plan.rationale}
              </p>
            )}
            <ul className="mt-3 grid gap-1.5">
              {plan.nodes.map((n, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
                >
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] capitalize text-muted-foreground">
                    {n.kind}
                  </span>
                  <span className="flex-1 truncate text-foreground">{n.title}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Est. cost{" "}
                <span className="font-mono text-foreground">
                  ${plan.estimatedCostUsd?.toFixed(2) ?? "—"}
                </span>{" "}
                · {plan.nodes.length + 1} nodes
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => planM.reset()}>
                  Discard
                </Button>
                <Button variant="primary" onClick={() => approve(plan)}>
                  <Check /> Approve &amp; build graph
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
