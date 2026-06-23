import { useNavigate } from "react-router";
import { useQueryState } from "nuqs";
import { Plus, Search, FolderOpen } from "lucide-react";
import { Button } from "@/ui/button";
import { ProjectCard } from "@/components/ProjectCard";
import { useProjectsStore } from "@/store/projectsStore";

export function ProjectsHome() {
  const navigate = useNavigate();
  const projects = useProjectsStore((s) => s.projects);
  const [q, setQ] = useQueryState("q", { defaultValue: "" });

  const query = q.trim().toLowerCase();
  const filtered = query
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.workspace.toLowerCase().includes(query),
      )
    : projects;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-8 py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-meta">DEPT CANVAS · WORKSPACE</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {projects.length} project{projects.length === 1 ? "" : "s"} across your
              workspaces.
            </p>
          </div>
          <Button variant="primary" onClick={() => navigate("/new")}>
            <Plus /> New project
          </Button>
        </header>

        <div className="mt-6 flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => void setQ(e.target.value || null)}
            placeholder="Search projects and workspaces…"
            className="h-full w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <span className="text-meta whitespace-nowrap">
              {filtered.length} match{filtered.length === 1 ? "" : "es"}
            </span>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-16 grid place-items-center text-center">
            <FolderOpen className="size-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No projects match “{q}”.</p>
            <p className="text-meta mt-1">TRY A DIFFERENT SEARCH OR START A NEW PROJECT</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/new")}>
              <Plus /> New project
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
