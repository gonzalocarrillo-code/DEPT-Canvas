# CLAUDE.md

This file orients Claude Code on the DEPT Canvas build. Read it fully before any task. It is the source of truth for how this project is structured, what the rules are, and which document to consult for detail.

## What we are building

DEPT Canvas: an enterprise creative platform that pairs a professional editing engine (IMG.LY CE.SDK) with an AI agent layer that authors **editable projects**, not finished renders. A brief becomes an approvable animation plan, then an editable `.scene` file a human refines. Approved masters fan out into hundreds of on-brand variations. Everything runs multi-tenant with strict per-client isolation on GCP.

The full specification lives in `DEPT_Canvas_Complete_Architecture.docx`. This file and the docs in `docs/` are the working rules; the spec is the reference.

## Non-negotiable principles

1. **The AI authors editable scenes, never baked video.** Every generative result is an editable layer/fill. If a task would produce a flat render as the primary creative artifact, it is wrong.
2. **Locks are enforced in code, not by model behaviour.** Frozen properties (logo position, brand colour, CTA placement, safe zones) are rejected at the tool layer. Never rely on a prompt to "ask" the model to respect a lock. A write to a locked property must hard-fail and be audited. See `docs/LOCKS.md`.
3. **Read engine ground truth; never hardcode API facts from memory.** CE.SDK property names, animatable properties, and easing options come from `findAllProperties()` / `query_animatable` at build or run time. Memory and training data go stale. See `docs/CESDK.md`.
4. **Tenant isolation is absolute.** Every tool resolves `tenant_id` server-side from a scoped token, never from an argument. No code path crosses tenants. See `docs/SECURITY.md`.
5. **No destructive or irreversible tools.** The MCP surface has no delete, publish, or permission-change tool. Irreversible actions are out of scope for the agent.
6. **Generate-once / render-many.** Generate variable content once per unique combination; render every size/duration from it. Never re-call a generation model per aspect ratio.
7. **Two motion tiers, one interface. CE.SDK is preset-based, NOT a keyframe system.** Build the Tier 1 scale engine (CE.SDK preset-composition) now, behind an engine-agnostic `MotionEngine` interface. Tier 2 (Remotion, true keyframes/bezier) is validated but **deferred** — do not build it until the trigger fires. Never let CE.SDK assumptions leak above the interface, and never describe CE.SDK as having keyframes. See `docs/MOTION_ENGINE.md` and `docs/ANIMATION.md`.

## Architecture in one paragraph

A shared, stateless control plane (identity, orchestration, tenant routing) sits above a per-client isolated data plane (dedicated renderer, DB, storage). The OpenAI Agents SDK (Python) orchestrates planner, authoring, and variation agents. A DEPT-built scene-authoring MCP server (Node/TS, wrapping CE.SDK) exposes the engine as typed tools over Streamable HTTP. OpenAI models do generation, called only by the MCP server. Hosted on GCP: Cloud Run for the MCP service, Cloud Run Jobs (escalating to GKE) for batch rendering.

## Repository map

```
orchestration/   Python — OpenAI Agents SDK (planner, authoring, variation, mapping, guardrails)
scene-mcp/        Node/TS — MCP server (Streamable HTTP), CE.SDK wrapper, locks, auth, audit
renderer/         Node/TS — batch render worker (Cloud Run Job)
edge/             Public API — TLS, token validation, tenant routing
frontend/         The editor UI (Canva × After Effects), dashboards, auth screens
infra/            Terraform — modules/tenant (per-client silo), shared (control plane)
docs/             The .md rule files referenced throughout
```

## How to work in this repo

- **Always start a task by reading the relevant `docs/*.md`.** They are short and authoritative.
- **Stay in the right language per package:** Python in `orchestration/`, Node/TS in `scene-mcp/` and `renderer/`. They meet over Streamable HTTP, never in-process.
- **Type every tool** with Zod (TS) or equivalent; tools take explicit, validated inputs.
- **Write tests for every lock and isolation guarantee.** A guarantee without a test does not exist.
- **Verify fast-moving facts as you go.** The OpenAI Agents SDK guardrail APIs, MCP transport config, and CE.SDK property coverage change; re-check against current docs rather than trusting this file.

## Build order (do not skip Phase 0)

0. Authoring spike + mapping agent (`docs/ANIMATION.md`, `docs/MAPPING_AGENT.md`). Phase 0 already established CE.SDK is preset-based, not keyframe-based — that question is closed; the answer is the two-tier strategy.
1. MCP server + orchestration agents (`docs/MCP_SERVER.md`, `docs/AGENTS.md`)
2. Locks + variation + the `MotionEngine` interface with the **CE.SDK Tier 1 implementation only** + two generation modes (`docs/LOCKS.md`, `docs/ANIMATION.md`, `docs/MOTION_ENGINE.md`). Wire the Tier 2 candidate signal; do NOT build the Remotion engine.
3. UX/UI (`docs/UX.md`) — the differentiator; the largest body of work
4. Tenancy + GCP hardening (`docs/SECURITY.md`, `docs/GCP.md`)

**Deferred (post-launch, trigger-gated):** Tier 2 Remotion craft engine behind the same interface, built only when the Tier 2 candidate rate clears the threshold in `docs/MOTION_ENGINE.md`.

## Definition of done for any feature

- Behaviour matches the spec section it implements.
- Locks and tenant scoping are enforced and tested.
- No fact about CE.SDK or an SDK was hardcoded from memory; it was read from the engine or current docs.
- Audit records are written for any tool call that creates, generates, or renders.
