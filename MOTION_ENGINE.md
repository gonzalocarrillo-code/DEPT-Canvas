# docs/MOTION_ENGINE.md

The motion-engine strategy and the swap-seam that lets a second engine slot in later without touching the scale tier. **This is the architectural decision that makes "build CE.SDK now, add Remotion later" safe.**

## Decision (made, with evidence)

- **Tier 1 — Scale: CE.SDK.** Preset-composition motion. Build now. Flat license, no per-render fee, ideal for high-volume on-brand variation.
- **Tier 2 — Craft: Remotion.** True keyframe + cubic-bezier + spring (verified). The validated premium path. **Deferred** — do not build until the trigger fires.

Rationale: the engines are complements. CE.SDK is cheap and reliable at volume but motion-limited; Remotion is motion-rich but carries a per-render license fee that compounds exactly at the volume the scale tier maximises. Splitting by tier puts each engine where its cost/capability fits.

## The trigger condition for building Tier 2

Do **not** build Remotion on a hunch. Build it when real usage proves the ceiling is hit often enough to justify a second engine and its per-render cost. Concrete trigger (tune the number with the team):

> When **≥ ~15% of projects** are flagged as Tier 2 candidates (briefs that need true keyframes / custom curves / group animation / transitions), OR a committed marquee client contractually requires bespoke motion, build Tier 2.

Until then, Tier 2 candidates are handled by: (a) a human finishing the motion manually in the editor, or (b) deferring that creative to a later phase. Track the candidate rate — it is the signal.

## The swap-seam (build this now, even with one engine)

All motion authoring flows through one engine-agnostic interface. Tier 1 backs it with CE.SDK; Tier 2 will back it with Remotion. The scale tier must never import an engine directly.

### Interface contract (conceptual)
A `MotionEngine` interface with methods like:
- `applyIntent(blockRef, intent, params)` — apply a named motion intent
- `stagger(blockRefs, timing)` — offset start times
- `setTiming(blockRef, { start, duration })`
- `sequence(scenes, offsets)`
- `capabilities()` — returns what THIS engine supports (so callers can detect Tier 2 needs)
- `render(sceneRef, format)` — produce output

### Two implementations
- `CesdkMotionEngine` (Tier 1, now): translates intents into preset composition; `capabilities()` reports no-custom-bezier, no-keyframe-tracks, etc.
- `RemotionMotionEngine` (Tier 2, later): translates intents into React/`interpolate`/`Easing.bezier`/`spring` code; `capabilities()` reports full keyframe + bezier.

### The rule
The MCP motion tools, the planner, and the authoring agent talk only to the `MotionEngine` interface. When a requested intent exceeds `capabilities()`, the engine returns a **"Tier 2 candidate" signal** rather than silently approximating without labeling. On Tier 1 that signal increments the trigger metric.

## Cost shapes (know these before scaling)

- **CE.SDK:** flat SDK license, no per-render fee. High-volume variation is cost-flat here — keep scale work on CE.SDK deliberately.
- **Remotion:** Company License required (companies > 3 people). "Automators" tier ≈ $0.01 per render, $100/mo minimum, plus your own GCP compute. Per-render fee compounds with volume — reserve for lower-volume, high-value craft.

## Isolation note

Remotion renders via headless browser **in your own cloud** (it offers no hosted rendering; supports GCP Cloud Run). Renders run inside the tenant's isolated compute; sensitive data passes at render time and is never publicly exposed. The per-tenant isolation guarantee holds for both tiers. Tier 2 is server-side-in-isolated-env, not literally in-browser — which was never realistic for batch video anyway.

## Build-now checklist (Tier 1 only)

- [ ] Define the `MotionEngine` interface.
- [ ] Implement `CesdkMotionEngine` (preset composition).
- [ ] Wire MCP motion tools + agents to the interface, never to CE.SDK directly.
- [ ] Implement `capabilities()` and the Tier 2 candidate signal + metric.
- [ ] Do NOT implement `RemotionMotionEngine` yet — leave the interface ready for it.
