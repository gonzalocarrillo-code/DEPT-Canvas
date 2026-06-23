import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { Play, Pause, SkipBack } from "lucide-react";
import { useEditorStore } from "./editorStore";
import { ANIMATABLE_PROPS } from "./types";
import { cn } from "@/lib/utils";

export function TimelinePanel() {
  const { layers, keyframes, durationS, playhead, playing, selectedId, selectedKeyframe } =
    useEditorStore(
      useShallow((s) => ({
        layers: s.layers,
        keyframes: s.keyframes,
        durationS: s.durationS,
        playhead: s.playhead,
        playing: s.playing,
        selectedId: s.selectedId,
        selectedKeyframe: s.selectedKeyframe,
      })),
    );
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const moveKeyframe = useEditorStore((s) => s.moveKeyframe);
  const selectKeyframe = useEditorStore((s) => s.selectKeyframe);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const next = useEditorStore.getState().playhead + dt;
      useEditorStore.getState().setPlayhead(next >= durationS ? 0 : next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, durationS]);

  const layer = layers.find((l) => l.id === selectedId) ?? null;
  const kf = layer ? keyframes[layer.id] : undefined;
  const frac = durationS ? playhead / durationS : 0;

  return (
    <div className="flex h-48 shrink-0 flex-col border-t border-border bg-card">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPlayhead(0);
              setPlaying(false);
            }}
            title="Restart"
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <SkipBack className="size-3.5" />
          </button>
          <button
            onClick={() => setPlaying(!playing)}
            title={playing ? "Pause" : "Play"}
            className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <p className="text-meta uppercase">
            {layer ? `Keyframes · ${layer.name}` : "Keyframes"}
          </p>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          {playhead.toFixed(1)}s / {durationS.toFixed(1)}s
        </span>
      </div>

      <div className="px-3">
        <input
          type="range"
          min={0}
          max={durationS}
          step={0.05}
          value={playhead}
          onChange={(e) => setPlayhead(Number(e.target.value))}
          className="w-full accent-[var(--color-primary)]"
        />
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {!layer ? (
          <p className="grid h-full place-items-center text-xs text-muted-foreground">
            Select a layer to animate it with keyframes.
          </p>
        ) : (
          <>
            <div
              className="pointer-events-none absolute bottom-2 top-2 z-10 w-px bg-primary"
              style={{ left: `calc(104px + (100% - 104px - 0.75rem) * ${frac})` }}
            />
            <div className="grid gap-1">
              {ANIMATABLE_PROPS.map(({ prop, label }) => {
                const track = kf?.[prop] ?? [];
                return (
                  <div
                    key={prop}
                    className="grid grid-cols-[96px_1fr] items-center gap-2"
                  >
                    <span className="truncate text-[11px] text-muted-foreground">
                      {label}
                    </span>
                    <div className="relative h-5 rounded bg-background ring-1 ring-border">
                      {track.map((k, i) => (
                        <button
                          key={i}
                          title={`${k.value} @ ${k.t.toFixed(2)}s · ${k.ease} — drag to retime`}
                          onClick={() => {
                            selectKeyframe({ prop, t: k.t });
                            setPlayhead(k.t);
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const trackEl = e.currentTarget.parentElement;
                            if (!trackEl) return;
                            const rect = trackEl.getBoundingClientRect();
                            let curT = k.t;
                            const mv = (ev: globalThis.PointerEvent) => {
                              const t = Math.max(
                                0,
                                Math.min(durationS, ((ev.clientX - rect.left) / rect.width) * durationS),
                              );
                              const rt = Math.round(t * 100) / 100;
                              moveKeyframe(layer.id, prop, curT, rt);
                              curT = rt;
                              setPlayhead(rt);
                            };
                            const up = () => {
                              window.removeEventListener("pointermove", mv);
                              window.removeEventListener("pointerup", up);
                            };
                            window.addEventListener("pointermove", mv);
                            window.addEventListener("pointerup", up);
                          }}
                          className={cn(
                            "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] ring-1 ring-background transition-transform hover:scale-125",
                            selectedKeyframe &&
                              selectedKeyframe.prop === prop &&
                              Math.abs(selectedKeyframe.t - k.t) < 0.06
                              ? "scale-150 bg-foreground"
                              : "bg-primary",
                          )}
                          style={{
                            left: `${durationS ? (k.t / durationS) * 100 : 0}%`,
                            cursor: "ew-resize",
                            touchAction: "none",
                          }}
                        />
                      ))}
                      {track.length === 0 && (
                        <span className="absolute inset-0 grid place-items-center text-[9px] text-muted-foreground/40">
                          no keyframes
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
