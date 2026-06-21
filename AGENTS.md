# docs/AGENTS.md

The OpenAI Agents SDK orchestration layer (Python). Runtime agents plus the build-time mapping agent.

## Runtime agents

| Agent | Role | Output |
|---|---|---|
| Planner | Brief + constraints → structured animation plan (uses `intent_primitive_map.json`) | An approvable plan |
| Authoring | Executes the approved plan via MCP tools over Streamable HTTP | A `.scene` file |
| Variation | Fans an approved master across size/duration/copy/background | A batch of variants |

The mapping agent (build-time) is documented in `docs/MAPPING_AGENT.md`.

## Handoffs

Planner → human approval → Authoring → human refine/approve → Variation. The human gates are part of the flow, not optional. Use the SDK's handoff and session primitives.

## Guardrails

Input moderation (safety checkpoint 1) lives in the SDK guardrails layer — it runs before any generation call. The other three checkpoints live in the generation pipeline (`docs/SECURITY.md`).

## Two generation modes (configuration, not separate code)

Both modes use the same agents and the same lock enforcement. They differ only in how many locks are set.

### Compose mode (open)
From a prompt alone, the planner invents layout, layers, motion, and timing; the authoring agent builds the full scene. Bound only by the brand kit and any tenant-level locks. Use for ideation and first drafts.

### Constrained mode (locked-fill)
Given a master + lock manifest + spec, the agent generates only the unlocked slots and cannot alter anything locked. Use for production and scaled variation.

| | Compose | Constrained |
|---|---|---|
| Input | A prompt | Master + lock manifest + spec |
| Latitude | Wide — invents structure | Narrow — fills variable slots |
| Use | Ideation | Production / variation |
| Guarantee | On-brand within kit | Nothing locked changes |

**Test both:** constrained mode must never change a locked property; compose mode must have full structural latitude within the brand kit.

## The Python ↔ Node boundary

The agents (Python) call the MCP server and renderer (Node) over Streamable HTTP, never in-process. Design and load-test this seam early — it is on the interactive authoring path.

## Verify as you go

Re-check the SDK's guardrail and handoff APIs against current docs. They move quickly; this file is a guide, not a frozen reference.
