import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { useShallow } from "zustand/react/shallow";
import { Play, Check, X, RotateCcw, Send, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/ui/button";
import { cn } from "@/lib/utils";
import {
  FORMAT_OPTIONS,
  LOCALE_OPTIONS,
  useBatchStore,
  type CellStatus,
} from "./batchStore";

const COST_PER_VARIATION = 0.04;

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-active={active}
      className="rounded-md border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent data-[active=true]:border-primary/50 data-[active=true]:bg-accent data-[active=true]:text-foreground"
    >
      {label}
    </button>
  );
}

const statusStyle: Record<CellStatus, string> = {
  queued: "text-muted-foreground",
  rendering: "text-primary",
  done: "text-foreground",
  approved: "text-success",
  rejected: "text-destructive",
};

export function VariationStudio() {
  const { projectId } = useParams();
  const { selFormats, selLocales, cells, generated } = useBatchStore(
    useShallow((s) => ({
      selFormats: s.selFormats,
      selLocales: s.selLocales,
      cells: s.cells,
      generated: s.generated,
    })),
  );
  const load = useBatchStore((s) => s.load);
  const toggleFormat = useBatchStore((s) => s.toggleFormat);
  const toggleLocale = useBatchStore((s) => s.toggleLocale);
  const generate = useBatchStore((s) => s.generate);
  const approveCell = useBatchStore((s) => s.approveCell);
  const rejectCell = useBatchStore((s) => s.rejectCell);
  const approveAll = useBatchStore((s) => s.approveAll);
  const reset = useBatchStore((s) => s.reset);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    load(projectId ?? "demo");
  }, [projectId, load]);

  const count = selFormats.length * selLocales.length;
  const cost = (count * COST_PER_VARIATION).toFixed(2);
  const etaS = Math.max(1, Math.round(count * 0.6));
  const approved = cells.filter((c) => c.status === "approved").length;
  const resolved = cells.filter((c) => c.status === "approved" || c.status === "rejected").length;
  const allApproved = cells.length > 0 && approved === cells.length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-8 py-10">
        <p className="text-meta">SCALE · GENERATE-ONCE / RENDER-MANY</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Variation studio</h1>

        {!generated ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Fan the approved master out across locales and formats. Variable content is
              generated once; every size renders from it.
            </p>

            <div className="mt-8 grid gap-6">
              <div>
                <p className="text-meta mb-2 uppercase">Formats</p>
                <div className="flex flex-wrap gap-2">
                  {FORMAT_OPTIONS.map((f) => (
                    <Chip key={f} label={f} active={selFormats.includes(f)} onClick={() => toggleFormat(f)} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-meta mb-2 uppercase">Locales</p>
                <div className="flex flex-wrap gap-2">
                  {LOCALE_OPTIONS.map((l) => (
                    <Chip key={l} label={l} active={selLocales.includes(l)} onClick={() => toggleLocale(l)} />
                  ))}
                </div>
              </div>
            </div>

            {/* Cost / count gate */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-6">
                <Stat label="Variations" value={String(count)} />
                <Stat label="Est. cost" value={`$${cost}`} />
                <Stat label="Est. time" value={`~${etaS}s`} />
              </div>
              {confirming ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <AlertTriangle className="size-3.5 text-lock" />
                    Generate {count} variations for ${cost}?
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => { generate(); setConfirming(false); }}>
                    Confirm &amp; run
                  </Button>
                </div>
              ) : (
                <Button variant="primary" disabled={count === 0} onClick={() => setConfirming(true)}>
                  <Play /> Generate {count} variation{count === 1 ? "" : "s"}
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {cells.length} variations · <span className="text-success">{approved} approved</span> ·{" "}
                {resolved}/{cells.length} reviewed
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={reset}>
                  <RotateCcw /> New batch
                </Button>
                <Button variant="secondary" size="sm" onClick={approveAll}>
                  <Check /> Approve all
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!allApproved}
                  title={allApproved ? "Push to delivery" : "Approve all variations first"}
                >
                  <Send /> Push to delivery
                </Button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {cells.map((c) => (
                <div key={c.id} className="overflow-hidden rounded-lg border border-border bg-card">
                  <div
                    className="relative h-24"
                    style={{ background: `radial-gradient(120% 120% at 0% 0%, hsl(${c.hue} 55% 26%), hsl(${c.hue} 45% 11%))` }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)", backgroundSize: "14px 14px" }}
                    />
                    <span className="absolute left-2 top-2 rounded bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground backdrop-blur-sm">
                      {c.locale} · {c.format}
                    </span>
                    {c.status === "approved" && (
                      <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-success text-white">
                        <Check className="size-3" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-2">
                    <span className={cn("flex items-center gap-1 text-[11px] capitalize", statusStyle[c.status])}>
                      {c.status === "rendering" && <Loader2 className="size-3 animate-spin" />}
                      {c.status}
                    </span>
                    {(c.status === "done" || c.status === "rejected" || c.status === "approved") && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => approveCell(c.id)}
                          title="Approve"
                          className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-success"
                        >
                          <Check className="size-3.5" />
                        </button>
                        <button
                          onClick={() => rejectCell(c.id)}
                          title="Reject"
                          className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-meta uppercase">{label}</p>
      <p className="font-mono text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
