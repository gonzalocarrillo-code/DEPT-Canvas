import type { PointerEvent as ReactPointerEvent } from "react";
import { ease as easeFn } from "./animation";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "Linear", v: "Linear" },
  { label: "In", v: "EaseIn" },
  { label: "Out", v: "EaseOut" },
  { label: "In-out", v: "EaseInOut" },
  { label: "Back", v: "EaseOutBack" },
  { label: "Spring", v: "Spring" },
];

const W = 188;
const H = 116;
const PAD = 12;
const sx = (x: number) => PAD + x * (W - 2 * PAD);
const sy = (y: number) => H - PAD - y * (H - 2 * PAD);
const round = (n: number) => Math.round(n * 100) / 100;

function parseBz(ease: string): [number, number, number, number] | null {
  if (!ease.startsWith("cubic-bezier(")) return null;
  const n = ease.slice(13, -1).split(",").map((s) => Number(s.trim()));
  return n.length === 4 && n.every((x) => !Number.isNaN(x))
    ? [n[0], n[1], n[2], n[3]]
    : null;
}

export function SpeedGraph({ ease, onChange }: { ease: string; onChange: (e: string) => void }) {
  const bz = parseBz(ease);

  const pts: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const p = i / 48;
    pts.push(`${sx(p).toFixed(1)},${sy(easeFn(ease, p)).toFixed(1)}`);
  }
  const path = `M ${pts.join(" L ")}`;

  const startDrag = (which: 0 | 1, e: ReactPointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cur = (bz ?? [0.42, 0, 0.58, 1]).slice() as [number, number, number, number];
    const move = (ev: globalThis.PointerEvent) => {
      const px = (ev.clientX - rect.left) * (W / rect.width);
      const py = (ev.clientY - rect.top) * (H / rect.height);
      const x = Math.max(0, Math.min(1, (px - PAD) / (W - 2 * PAD)));
      const y = Math.max(-0.6, Math.min(1.6, (H - PAD - py) / (H - 2 * PAD)));
      if (which === 0) {
        cur[0] = round(x);
        cur[1] = round(y);
      } else {
        cur[2] = round(x);
        cur[3] = round(y);
      }
      onChange(`cubic-bezier(${cur[0]},${cur[1]},${cur[2]},${cur[3]})`);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="grid gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-md border border-border bg-background">
        <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(0)} stroke="var(--color-border)" strokeWidth="0.5" />
        <line x1={sx(0)} y1={sy(1)} x2={sx(1)} y2={sy(1)} stroke="var(--color-border)" strokeWidth="0.5" />
        <line x1={sx(0)} y1={sy(0)} x2={sx(0)} y2={sy(1)} stroke="var(--color-border)" strokeWidth="0.5" />
        {bz && (
          <>
            <line x1={sx(0)} y1={sy(0)} x2={sx(bz[0])} y2={sy(bz[1])} stroke="var(--color-primary)" strokeWidth="0.75" opacity="0.5" />
            <line x1={sx(1)} y1={sy(1)} x2={sx(bz[2])} y2={sy(bz[3])} stroke="var(--color-primary)" strokeWidth="0.75" opacity="0.5" />
          </>
        )}
        <path d={path} fill="none" stroke="var(--color-primary)" strokeWidth="1.5" />
        <circle cx={sx(0)} cy={sy(0)} r="2.5" fill="var(--color-muted-foreground)" />
        <circle cx={sx(1)} cy={sy(1)} r="2.5" fill="var(--color-muted-foreground)" />
        {bz && (
          <>
            <circle cx={sx(bz[0])} cy={sy(bz[1])} r="4.5" fill="var(--color-primary)" stroke="var(--color-card)" strokeWidth="1.5" style={{ cursor: "grab" }} onPointerDown={(e) => startDrag(0, e)} />
            <circle cx={sx(bz[2])} cy={sy(bz[3])} r="4.5" fill="var(--color-primary)" stroke="var(--color-card)" strokeWidth="1.5" style={{ cursor: "grab" }} onPointerDown={(e) => startDrag(1, e)} />
          </>
        )}
      </svg>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.v}
            onClick={() => onChange(p.v)}
            data-active={ease === p.v}
            className={cn(
              "rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent data-[active=true]:border-primary/50 data-[active=true]:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => onChange("cubic-bezier(0.42,0,0.58,1)")}
          data-active={Boolean(bz)}
          className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent data-[active=true]:border-primary/50 data-[active=true]:text-foreground"
        >
          Custom
        </button>
      </div>
    </div>
  );
}
