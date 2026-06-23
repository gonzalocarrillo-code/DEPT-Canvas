import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router";
import { Plus, Search, Workflow, Sparkles, BookOpen } from "lucide-react";
import { useProjectsStore } from "@/store/projectsStore";

/** Global ⌘K / Ctrl+K command palette — also a project finder. */
export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const projects = useProjectsStore((s) => s.projects);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command menu"
      overlayClassName="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      contentClassName="fixed left-1/2 top-[18%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Sparkles className="size-4 text-primary" />
        <Command.Input
          placeholder="Search projects, actions…"
          className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      <Command.List className="max-h-[50vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
          No results found.
        </Command.Empty>
        <Command.Group heading="Create">
          <Command.Item value="new project from a brief ai" onSelect={() => go("/new")}>
            <Sparkles /> New project from a brief
          </Command.Item>
          <Command.Item value="new project from scratch blank" onSelect={() => go("/new")}>
            <Plus /> New project from scratch
          </Command.Item>
        </Command.Group>
        <Command.Group heading="Projects">
          <Command.Item value="browse all projects finder" onSelect={() => go("/")}>
            <Search /> Browse all projects
          </Command.Item>
          {projects.slice(0, 6).map((p) => (
            <Command.Item
              key={p.id}
              value={`open ${p.name} ${p.workspace}`}
              onSelect={() => go(`/project/${p.id}/graph`)}
            >
              <Workflow /> {p.name}
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Automation">
          <Command.Item value="md skills library transcreation meta" onSelect={() => go("/skills")}>
            <BookOpen /> MD skills library
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
