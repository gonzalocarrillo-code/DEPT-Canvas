import { NavLink, useParams } from "react-router";
import { LayoutGrid, Plus, Workflow, Film, BookOpen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
    isActive && "bg-accent text-primary",
  );

export function IconRail() {
  const { projectId } = useParams();
  const inProject = Boolean(projectId);

  return (
    <nav className="flex w-rail shrink-0 flex-col items-center gap-1 border-r border-border bg-card py-3">
      <NavLink to="/" end title="Projects" className={linkClass}>
        <LayoutGrid className="size-[18px]" />
      </NavLink>
      <NavLink to="/new" title="New project" className={linkClass}>
        <Plus className="size-[18px]" />
      </NavLink>

      {inProject && (
        <>
          <div className="my-1 h-px w-6 bg-border" />
          <NavLink
            to={`/project/${projectId}/graph`}
            title="Ideation graph"
            className={linkClass}
          >
            <Workflow className="size-[18px]" />
          </NavLink>
          <NavLink
            to={`/project/${projectId}/editor`}
            title="Editor"
            className={linkClass}
          >
            <Film className="size-[18px]" />
          </NavLink>
        </>
      )}

      <div className="mt-auto flex flex-col items-center gap-1">
        <NavLink to="/skills" title="MD skills" className={linkClass}>
          <BookOpen className="size-[18px]" />
        </NavLink>
        <button
          title="Settings"
          className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Settings className="size-[18px]" />
        </button>
      </div>
    </nav>
  );
}
