# docs/MCP_SERVER.md

The DEPT-built scene-authoring MCP server. Node/TS, wraps the CE.SDK headless engine, exposes it as typed tools.

## What it is / is not

- **Is**: a long-lived service exposing the CE.SDK Block/Scene API as MCP tools over **Streamable HTTP**. Runs in our GCP.
- **Is not**: the IMG.LY public MCP server (docs search only), and not a hosted OpenAI tool — it touches per-tenant assets and must stay inside our isolation boundary.

## Transport

- **Streamable HTTP** for production (`MCPServerStreamableHttp` on the Agents SDK side).
- stdio only for local dev. SSE is deprecated — do not use.

## Core tool surface

`create_scene`, `create_block`, `set_properties`, `apply_brand_kit`, `apply_lock_manifest`, `generate_asset`, `save_scene`, `render_variant`.

Motion tools (`apply_intent`, `stagger`, `set_timing`, `sequence`) are backed by the engine-agnostic `MotionEngine` interface, not by direct engine calls. On Tier 1 the interface is implemented by CE.SDK preset-composition. **There is no `set_keyframe`/custom-bezier tool on Tier 1 — CE.SDK has no keyframe API.** See `docs/MOTION_ENGINE.md` and `docs/ANIMATION.md`. When a requested motion exceeds the engine's `capabilities()`, the tool returns a Tier 2 candidate signal rather than silently approximating without labeling.

## Hard rules for every tool

1. **`tenant_id` is resolved server-side** from the caller's scoped token. Never trust it from an argument.
2. **Locks are enforced here.** `set_properties` and every `MotionEngine` operation consult the loaded lock manifest and hard-reject writes to frozen properties, then audit the rejection. See `docs/LOCKS.md`.
3. **No destructive tools.** No delete, publish, or permission change exists in this surface.
4. **`generate_asset` runs the safety pipeline** before returning. Output is a fill on a block, never baked. See `docs/SECURITY.md`.
5. **`save_scene` returns a storage ref**, not the bytes; writes only to the tenant's own bucket.
6. **Type every input** (Zod). Reject malformed calls early with clear errors.

## Engine ground truth

Wrap the engine such that `query_animatable` and any capability check reads from the live engine, not a cached assumption. CE.SDK facts are read, never hardcoded from memory.

## Repo

```
scene-mcp/
  src/index.ts        Streamable HTTP entrypoint
  src/tools/          one file per tool, Zod-typed
  src/engine/         CE.SDK headless wrapper
  src/locks/          lock-manifest loader + enforcement
  src/auth/           OIDC validation, tenant scoping
  src/audit/          immutable audit writer
  Dockerfile
```

## Hosting

Cloud Run, `min-instances >= 1` (avoid cold start on the agent path). Not internet-exposed; egress restricted to the OpenAI API and the tenant bucket. Secrets via Secret Manager. See `docs/GCP.md`.
