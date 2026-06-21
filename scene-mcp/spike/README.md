# Phase 0 CE.SDK spike (P0-T2)

Headless authoring proof and engine ground-truth dump for `@cesdk/node` **v1.76.1**.

## What this proves

1. **Authoring** — create scene → text block → `slide` preset In animation → save `.scene` → reload → export PNG.
2. **Capability ground truth** — introspect every animation/blur type via `findAllProperties()` + `getPropertyType` (+ `getEnumValues` for enums).
3. **Preset-only model** — assert no `setKeyframe` / `addKeyframe` / `createKeyframe` on `engine.block`.

> The legacy Prompt-1 phrase "two position keyframes" is realized as a **`slide` preset In animation** — CE.SDK has no keyframe API.

## Run manually

```bash
# From repo root (evaluation license if CESDK_LICENSE unset)
pnpm --filter @dept-canvas/scene-mcp exec tsx spike/run-capability-dump.ts
pnpm --filter @dept-canvas/scene-mcp exec tsx spike/authoring-spike.ts
```

Output:

- `scene-mcp/src/engine/capability-report.json` — committed artifact for mapping agent (P0-T3)
- `out/spike.scene`, `out/spike.png` — local spike outputs (gitignored)

## Tests

```bash
pnpm --filter @dept-canvas/scene-mcp test
```

`authoring-spike.test.ts` runs the spike and validates `capability-report.json`.
