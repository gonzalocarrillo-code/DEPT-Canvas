import { useState } from "react";
import { BookOpen, Hash, FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSkillsStore, type Skill } from "./skills";

// Renders the skill's Markdown body with light formatting — enough to read the
// instruction pack without pulling a full Markdown lib.
function MarkdownBody({ body }: { body: string }) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
      {body.split("\n").map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} className="h-1" />;
        if (t.startsWith("# "))
          return (
            <h3 key={i} className="pt-1 text-base font-semibold text-foreground">
              {t.slice(2)}
            </h3>
          );
        if (t.startsWith("## "))
          return (
            <h4 key={i} className="pt-1 text-sm font-semibold text-foreground">
              {t.slice(3)}
            </h4>
          );
        if (t.startsWith("- "))
          return (
            <p key={i} className="flex gap-2 pl-1">
              <span className="text-primary">·</span>
              <span dangerouslySetInnerHTML={{ __html: inline(t.slice(2)) }} />
            </p>
          );
        return <p key={i} dangerouslySetInnerHTML={{ __html: inline(t) }} />;
      })}
    </div>
  );
}

// **bold** → <strong>; everything else escaped.
function inline(s: string): string {
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>');
}

export function SkillsLibrary() {
  const skills = useSkillsStore((s) => s.skills);
  const [activeId, setActiveId] = useState<string>(skills[0]?.id ?? "");
  const active: Skill | undefined = skills.find((s) => s.id === activeId);

  return (
    <div className="h-full overflow-hidden">
      <div className="mx-auto flex h-full max-w-5xl flex-col px-8 py-10">
        <p className="text-meta">AUTOMATION · MD SKILLS</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Skills</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reusable Markdown instruction packs. Attach one to a variation job to scope the
          AI&apos;s behaviour for that asset only — channel specs, tone, do-not-translate rules.
        </p>

        <div className="mt-8 grid min-h-0 flex-1 gap-6 md:grid-cols-[260px_1fr]">
          {/* list */}
          <div className="space-y-2 overflow-y-auto">
            {skills.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                data-active={s.id === activeId}
                className={cn(
                  "w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent",
                  "data-[active=true]:border-primary/60 data-[active=true]:bg-accent",
                )}
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="size-3.5 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {s.name}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.summary}</p>
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5">
                    <Hash className="size-2.5" /> {s.channel}
                  </span>
                  <span className="rounded border border-border px-1.5 py-0.5 capitalize">{s.scope}</span>
                </div>
              </button>
            ))}
          </div>

          {/* detail */}
          <div className="min-h-0 overflow-y-auto rounded-xl border border-border bg-card p-6">
            {active ? (
              <>
                <div className="mb-4 flex items-center gap-2 border-b border-border pb-4">
                  <FileCode2 className="size-4 text-primary" />
                  <span className="font-mono text-xs text-muted-foreground">
                    {active.id}.md
                  </span>
                </div>
                <MarkdownBody body={active.body} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No skill selected.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
