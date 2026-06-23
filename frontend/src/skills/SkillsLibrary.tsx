import { useState } from "react";
import { BookOpen, Hash, FileCode2, Plus, Trash2, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/ui/button";
import { cn } from "@/lib/utils";
import { useSkillsStore, BUILTIN_SKILLS, type Skill, type NewSkill } from "./skills";

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

const EMPTY: NewSkill = {
  name: "",
  channel: "",
  scope: "transcreation",
  summary: "",
  body: "# New skill\n\n- Describe the rules the AI should follow for this asset.\n",
};

type Editing = { mode: "new" } | { mode: "edit"; id: string } | null;

export function SkillsLibrary() {
  const skills = useSkillsStore((s) => s.skills);
  const addSkill = useSkillsStore((s) => s.addSkill);
  const updateSkill = useSkillsStore((s) => s.updateSkill);
  const deleteSkill = useSkillsStore((s) => s.deleteSkill);
  const resetBuiltins = useSkillsStore((s) => s.resetBuiltins);

  const [activeId, setActiveId] = useState<string>(skills[0]?.id ?? "");
  const [editing, setEditing] = useState<Editing>(null);

  const active: Skill | undefined = skills.find((s) => s.id === activeId);
  const missingBuiltins = BUILTIN_SKILLS.some((b) => !skills.some((s) => s.id === b.id));

  const startNew = () => setEditing({ mode: "new" });
  const startEdit = (id: string) => setEditing({ mode: "edit", id });

  const onSave = (draft: NewSkill) => {
    if (editing?.mode === "edit") {
      updateSkill(editing.id, draft);
      setActiveId(editing.id);
    } else {
      const id = addSkill(draft);
      setActiveId(id);
    }
    setEditing(null);
  };

  const onDelete = (id: string) => {
    deleteSkill(id);
    setEditing(null);
    const remaining = skills.filter((s) => s.id !== id);
    setActiveId(remaining[0]?.id ?? "");
  };

  return (
    <div className="h-full overflow-hidden">
      <div className="mx-auto flex h-full max-w-5xl flex-col px-8 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-meta">AUTOMATION · MD SKILLS</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Skills</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Reusable Markdown instruction packs. Attach one to a variation job to scope the
              AI&apos;s behaviour for that asset only — channel specs, tone, do-not-translate rules.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {missingBuiltins && (
              <Button variant="ghost" size="sm" onClick={resetBuiltins} title="Restore deleted built-in skills">
                <RotateCcw /> Restore defaults
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={startNew}>
              <Plus /> New skill
            </Button>
          </div>
        </div>

        <div className="mt-8 grid min-h-0 flex-1 gap-6 md:grid-cols-[260px_1fr]">
          {/* list */}
          <div className="space-y-2 overflow-y-auto pr-1">
            {skills.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "group relative rounded-lg border border-border p-3 transition-colors hover:bg-accent",
                  s.id === activeId && !editing && "border-primary/60 bg-accent",
                )}
              >
                <button
                  onClick={() => {
                    setActiveId(s.id);
                    setEditing(null);
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-2 pr-6">
                    <BookOpen className="size-3.5 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {s.name || "Untitled skill"}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5">
                      <Hash className="size-2.5" /> {s.channel || "—"}
                    </span>
                    <span className="rounded border border-border px-1.5 py-0.5 capitalize">{s.scope}</span>
                    {s.builtin && (
                      <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">built-in</span>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => onDelete(s.id)}
                  title="Delete skill"
                  className="absolute right-2 top-2 grid size-6 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            {skills.length === 0 && (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                No skills yet. Create one with “New skill”.
              </p>
            )}
          </div>

          {/* detail / editor */}
          <div className="min-h-0 overflow-y-auto rounded-xl border border-border bg-card p-6">
            {editing ? (
              <SkillForm
                initial={editing.mode === "edit" ? skills.find((s) => s.id === editing.id) ?? EMPTY : EMPTY}
                onCancel={() => setEditing(null)}
                onSave={onSave}
              />
            ) : active ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-2 border-b border-border pb-4">
                  <span className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <FileCode2 className="size-4 text-primary" /> {active.id}.md
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(active.id)}>
                      <Pencil /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(active.id)}>
                      <Trash2 /> Delete
                    </Button>
                  </div>
                </div>
                <MarkdownBody body={active.body} />
              </>
            ) : (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <p className="text-sm text-muted-foreground">No skill selected.</p>
                  <Button variant="primary" size="sm" className="mt-3" onClick={startNew}>
                    <Plus /> New skill
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkillForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: Skill | NewSkill;
  onCancel: () => void;
  onSave: (draft: NewSkill) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [channel, setChannel] = useState(initial.channel);
  const [scope, setScope] = useState(initial.scope);
  const [summary, setSummary] = useState(initial.summary);
  const [body, setBody] = useState(initial.body);
  const valid = name.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-foreground">
        {"id" in initial ? "Edit skill" : "New skill"}
      </h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. LinkedIn — B2B tone" className={inputCls} />
        </Field>
        <Field label="Channel">
          <input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="LinkedIn" className={inputCls} />
        </Field>
        <Field label="Scope">
          <input value={scope} onChange={(e) => setScope(e.target.value)} list="skill-scopes" placeholder="transcreation" className={inputCls} />
          <datalist id="skill-scopes">
            <option value="transcreation" />
            <option value="copy" />
            <option value="image" />
            <option value="resize" />
          </datalist>
        </Field>
      </div>
      <Field label="Summary">
        <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One line shown in the picker" className={inputCls} />
      </Field>
      <Field label="Instructions (Markdown)">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={cn(inputCls, "h-64 resize-y font-mono text-xs leading-relaxed")}
        />
      </Field>
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!valid}
          onClick={() => onSave({ name: name.trim(), channel: channel.trim(), scope: scope.trim() || "copy", summary: summary.trim(), body })}
        >
          Save skill
        </Button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-meta mb-1 block uppercase">{label}</span>
      {children}
    </label>
  );
}
