# docs/CESDK.md

Rules for working with IMG.LY CE.SDK. The cardinal rule: **read engine truth, never hardcode from memory.**

## The engine

CE.SDK's headless `CreativeEngine` provides the scene graph and rendering. We wrap it in `scene-mcp/` and `renderer/`. It is Node/JS — keep all engine code in the Node/TS packages.

## Cardinal rule

CE.SDK property names, animatable properties, easing options, blur types, and animation types are **version-specific facts**. Read them at build/run time:
- `findAllProperties(id)` — property keys for a block or animation.
- `query_animatable` (our wrapper) — available animation presets, their tunable properties, and the easing enum options.
- IMG.LY docs MCP — human-readable descriptions.

Never write a property string like `animation/slide/direction` from memory into shipping code without confirming it against the engine. Memory and training data go stale between SDK versions.

## Built-in vocabulary (confirm against the running version)

CE.SDK ships named animation types (entrance/exit/loop): slide, fade, zoom, spin, pop, wipe, typewriter, Ken Burns, pan, blur, and loop variants — plus a blur subsystem (uniform, linear, mirrored, radial). The mapping agent classifies these; it does not invent new ones. See `docs/MAPPING_AGENT.md`.

## Editable-output rule

Generated media (background, image-to-video) lands as a **fill on a block**, so it stays editable. The engine outputs an editable `.scene` file as the primary artifact; a flat render is only a final export, never the working creative object.

## Verify as you go

When IMG.LY ships a new version, re-run the mapping agent and re-check property coverage. Treat the changelog as required reading on upgrades.
