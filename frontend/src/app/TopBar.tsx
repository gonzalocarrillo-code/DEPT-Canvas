import { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { Hexagon, Share2, Moon, Sun, ChevronRight } from "lucide-react";
import { Button } from "@/ui/button";
import { Kbd } from "@/ui/kbd";
import { useProjectsStore } from "@/store/projectsStore";
import { useAuthStore } from "@/auth/authStore";
import { useEditorStore } from "@/editor/editorStore";
import { toggleTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type SurfaceMode = "graph" | "editor";

export function TopBar() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const location = useLocation();
  const project = useProjectsStore((s) =>
    projectId ? s.projects.find((p) => p.id === projectId) : undefined,
  );
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : true,
  );
  const authUser = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const sceneTitle = useEditorStore((s) => s.sceneTitle);
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = authUser
    ? authUser.name.split(" ").map((w) => w[0]).join("").slice(0, 2)
    : "?";
  const inProject = Boolean(projectId);
  const projectName = project?.name ?? "Untitled project";
  const surface: SurfaceMode = location.pathname.includes("/editor")
    ? "editor"
    : "graph";

  return (
    <header className="flex h-topbar shrink-0 items-center justify-between border-b border-border bg-card px-3">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-foreground"
        >
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <Hexagon className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            DEPT Canvas
          </span>
        </button>
        {inProject && (
          <nav className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <ChevronRight className="size-3.5 shrink-0" />
            <span className={cn("truncate", surface === "editor" ? "" : "text-foreground/90")}>
              {projectName}
            </span>
            {surface === "editor" && (
              <>
                <ChevronRight className="size-3.5 shrink-0" />
                <span className="truncate text-foreground/90">{sceneTitle}</span>
              </>
            )}
          </nav>
        )}
      </div>

      {inProject && (
        <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
          {(["graph", "editor"] as const).map((m) => (
            <button
              key={m}
              onClick={() => navigate(`/project/${projectId}/${m}`)}
              data-active={surface === m}
              className="rounded-md px-3 py-1 text-xs font-medium capitalize text-muted-foreground transition-colors data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
            >
              {m}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
        {inProject && (
          <Button variant="ghost" size="sm">
            <Share2 /> Share
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setIsDark(toggleTheme() === "dark")}
        >
          {isDark ? <Sun /> : <Moon />}
        </Button>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="grid size-7 place-items-center rounded-full border border-border bg-muted text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {initials}
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-40 mt-1 w-52 rounded-lg border border-border bg-popover p-1 shadow-xl">
                <div className="px-2 py-1.5">
                  <p className="truncate text-xs font-medium text-foreground">{authUser?.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{authUser?.email}</p>
                </div>
                <div className="my-1 border-t border-border" />
                <button
                  onClick={() => { setMenuOpen(false); navigate("/account"); }}
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
                >
                  Profile
                </button>
                {authUser?.role === "tenant_admin" && (
                  <button
                    onClick={() => { setMenuOpen(false); navigate("/admin"); }}
                    className="w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
                  >
                    Team &amp; access
                  </button>
                )}
                <div className="my-1 border-t border-border" />
                <button
                  onClick={() => { setMenuOpen(false); signOut(); navigate("/login", { replace: true }); }}
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
