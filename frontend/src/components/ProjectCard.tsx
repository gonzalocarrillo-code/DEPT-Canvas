import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Layers, Copy } from "lucide-react";
import type { ProjectStatus, ProjectSummary } from "@/store/projectsStore";
import { cn } from "@/lib/utils";

const statusStyles: Record<ProjectStatus, string> = {
  draft: "border-border text-muted-foreground",
  "in-progress": "border-primary/40 text-primary",
  approved: "border-success/40 text-success",
};

const statusLabel: Record<ProjectStatus, string> = {
  draft: "draft",
  "in-progress": "in progress",
  approved: "approved",
};

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const navigate = useNavigate();
  return (
    <motion.button
      onClick={() => navigate(`/project/${project.id}/graph`)}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-primary/50"
    >
      <div
        className="relative h-28 w-full"
        style={{
          background: `radial-gradient(130% 130% at 0% 0%, hsl(${project.accent} 55% 24%), hsl(${project.accent} 45% 9%))`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />
        <span
          className={cn(
            "absolute right-2 top-2 rounded-full border bg-background/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide backdrop-blur-sm",
            statusStyles[project.status],
          )}
        >
          {statusLabel[project.status]}
        </span>
      </div>

      <div className="p-4">
        <p className="text-meta">{project.workspace.toUpperCase()}</p>
        <h3 className="mt-1 truncate text-sm font-semibold tracking-tight text-foreground">
          {project.name}
        </h3>

        <div className="mt-3 flex items-center gap-3 text-meta">
          <span className="inline-flex items-center gap-1">
            <Layers className="size-3" /> {project.sceneCount} scenes
          </span>
          <span className="inline-flex items-center gap-1">
            <Copy className="size-3" /> {project.variationCount}
          </span>
          <span className="ml-auto normal-case">{project.updatedLabel}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          {project.formats.map((f) => (
            <span
              key={f}
              className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </motion.button>
  );
}
