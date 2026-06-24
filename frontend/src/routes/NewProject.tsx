import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, Sparkles, Plus, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectsStore } from "@/store/projectsStore";

export function NewProject() {
  const navigate = useNavigate();
  const createProject = useProjectsStore((s) => s.createProject);

  const startScratch = () => {
    const project = createProject({ entry: "scratch" });
    navigate(`/project/${project.id}/editor`);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-8 py-12">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Projects
        </button>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Start a new project
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Begin from a brief and let the agent draft a graph, or start from a blank
          canvas — AI is available throughout.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <EntryCard
            accent
            kicker="AI-ASSISTED"
            icon={<Sparkles className="size-5" />}
            title="Start from a brief"
            body="Describe the campaign. The planner drafts a master idea plus suggested variations as a node graph for you to approve."
            onClick={() => navigate("/new/brief")}
          />
          <EntryCard
            kicker="MANUAL"
            icon={<Plus className="size-5" />}
            title="Start from scratch"
            body="Open the editor and design your scene — image or video, lock what's fixed — then push it to the graph to branch AI variations."
            onClick={startScratch}
          />
        </div>
      </div>
    </div>
  );
}

function EntryCard({
  kicker,
  icon,
  title,
  body,
  onClick,
  accent = false,
}: {
  kicker: string;
  icon: ReactNode;
  title: string;
  body: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/50",
        accent && "ring-1 ring-primary/20",
      )}
    >
      <div
        className={cn(
          "grid size-10 place-items-center rounded-lg",
          accent
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-foreground",
        )}
      >
        {icon}
      </div>
      <p className="text-meta mt-4">{kicker}</p>
      <h2 className="mt-1 flex items-center gap-1.5 text-base font-semibold tracking-tight">
        {title}
        <ArrowRight className="size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </motion.button>
  );
}
