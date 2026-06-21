# BUILD_AGENT.md — operating contract for AI coding agents building DEPT Canvas

This file is the **single, tool-agnostic operating contract** for any AI coding agent (Cursor
Composer, Codex/GPT-5.5, or other) that writes code in this repository. Read it fully before writing
anything, then re-read the relevant governing doc before each task.

> **Naming note:** the file `AGENTS.md` at the repo root is a *product domain doc* (it describes the
> OpenAI Agents SDK runtime agents — planner/authoring/variation — that the product *contains*). It is
> **not** instructions for you. Your operating rules are THIS file + `CLAUDE.md` + `IMPLEMENTATION_PLAN.md`.

## 1. Mission
Implement the DEPT Canvas platform **task by task**, in strict Task ID order, exactly as
`IMPLEMENTATION_PLAN.md` specifies. You write production code, types, and tests — not prose.

## 2. Sources of truth & precedence
1. `IMPLEMENTATION_PLAN.md` — THE BUILD QUEUE (tasks P0-T1 … P4-T4, then deferred D-T1). Each task
   lists files, interfaces/Zod schemas, dependencies, acceptance tests, governing doc, and risk.
2. `CLAUDE.md` — project rules + the 7 non-negotiable principles.
3. Governing docs at repo root: `MOTION_ENGINE.md`, `ANIMATION.md`, `CESDK.md`, `LOCKS.md`,
   `SECURITY.md`, `MAPPING_AGENT.md`, `MCP_SERVER.md`, `AGENTS.md`, `UX.md`, `GCP.md`.
4. `DEPT_Canvas_Complete_Architecture.docx` — REFERENCE ONLY.

**Precedence:** the `.md` docs win over the `.docx`; `IMPLEMENTATION_PLAN.md` is the executable
sequence. The docx §14 Prompts 1/3/6 contain **legacy "keyframe" wording that is SUPERSEDED** — ignore
it; follow the two-tier motion model below.

## 3. Non-negotiable invariants (violating any is a defect)
1. **Editable scenes, never baked video.** Generated media is a fill on a block; a flat render is only
   a final export, never the primary artifact.
2. **Locks enforced in code, never by prompting.** A write to a locked property MUST hard-fail with a
   clear error AND write an audit record. Applies to `set_properties` and every `MotionEngine` op.
3. **Read engine truth.** Never hardcode CE.SDK property names / animation types / easings from memory;
   read them via `findAllProperties()` / the `query_animatable` wrapper at build/run time.
4. **Tenant isolation is absolute.** Every tool resolves `tenant_id` SERVER-SIDE from the scoped token,
   never from an argument. No code path crosses tenants.
5. **No destructive tools.** No delete/publish/permission-change tool exists in the MCP surface. Never
   add one.
6. **Generate-once / render-many.** Generate variable content once per unique combination; render every
   size/duration from it. Never re-call a generation model per aspect ratio.
7. **Two motion tiers, one interface — CE.SDK is PRESET-BASED, NOT a keyframe system.**
   - Build ONLY Tier 1 now: the engine-agnostic `MotionEngine` interface backed by `CesdkMotionEngine`
     (preset composition + staggers + the four easings Linear/EaseIn/EaseOut/EaseInOut). Label every
     result `native` or `composed`.
   - DO NOT build `set_keyframe` / custom-bezier / transition / group-animation tooling on CE.SDK — it
     does not exist. When a request exceeds `capabilities()`, return a **"Tier 2 candidate" signal** and
     increment the trigger metric; never silently approximate without labeling.
   - The planner, authoring agent, and MCP tools import the **`MotionEngine` interface ONLY** — never
     `@cesdk/node` or `CesdkMotionEngine` directly. No engine assumptions leak above the interface.
   - DO NOT build Tier 2 (`RemotionMotionEngine`, task D-T1). It is DEFERRED behind a usage trigger.

## 4. Per-task execution protocol (repeat for each Task ID, in order)
- **A. Claim & read.** Announce the Task ID + goal. Open its `IMPLEMENTATION_PLAN.md` entry and the one
  governing doc it names. Do not start a task whose `Depends on` tasks are not merged to `main`.
- **B. Verify first.** If the task or a fact it relies on is flagged **MUST VERIFY** (plan §B/§F),
  re-confirm it against the live doc URL in §F before coding. If you cannot confirm an API from official
  docs, STOP and ask — never invent an API surface.
- **C. Implement.** Create exactly the files listed (full paths). Implement the interfaces/Zod
  schemas/type signatures as written. Stay in the package language: Python in `orchestration/`, Node/TS
  in `scene-mcp/`/`renderer/`/`edge/`, React+TS in `frontend/`. They meet only over Streamable HTTP.
- **D. Test.** Write the task's named acceptance tests (exact names from the plan). Lock and
  tenant-isolation tests are guarantees — they must exist and pass.
- **E. Run.** `pnpm -r typecheck && pnpm -r test` (TS) / `uv run pytest` (Python). Iterate to green.
- **F. Commit.** One task per branch, named `<taskid>-<tool>` (e.g. `p1-t5-cursor`, `p3-t4-codex`).
  Commit message starts with the Task ID. Keep PRs small (one task).
- **G. Log & report.** Check the task off in `BUILD_LOG.md` with Task ID, tool, branch, and test
  results. Report what changed, tests + results, MUST-VERIFY confirmations (with source), next Task ID.

## 5. Verification protocol (you lack prior research context — re-check live)
- CE.SDK headless/animation/introspection: `img.ly/docs/cesdk/node/`,
  `.../engine/guides/using-animations/`, `.../js/concepts/blocks-90241e/`, `.../js/llms-full.txt`,
  `.../changelog/`; pin version via `registry.npmjs.org/@cesdk/node/latest`.
- CE.SDK Renderer (MP4): `img.ly/docs/cesdk/renderer/get-started/commandline-4230bf/`,
  `.../node-processing-a2e4dc/`. (P0-T4 settles `exportVideo()`-in-Node vs the Renderer container.)
- OpenAI Agents SDK (Python, pkg `openai-agents`, import `agents`):
  `openai.github.io/openai-agents-python/`; version `pypi.org/project/openai-agents/`.
- MCP transport: `modelcontextprotocol.io/specification/2025-11-25/basic/transports`. Node server SDK
  `@modelcontextprotocol/sdk` — **PIN v1.x** (`StreamableHTTPServerTransport` from
  `@modelcontextprotocol/sdk/server/streamableHttp.js`). Do NOT use the `@modelcontextprotocol/node` v2 alpha.
- OpenAI models/APIs: `developers.openai.com/api/docs/models` + `.../guides/{image-generation,
  structured-outputs,moderation,your-data}`. (Char caps are NOT enforced by JSON-schema `maxLength` —
  validate in code and re-prompt.)
- Remotion: ONLY when task D-T1 unlocks (`remotion.dev/docs`, `remotion.dev/license`).

## 6. Phase gates / stop conditions (pause and report; wait for human go-ahead)
- STOP after **Phase 0** (P0-T1..P0-T4): report `capability-report.json` findings + the P0-T4 MP4-path
  decision before Phase 1.
- STOP after each subsequent phase (1, 2, 3, 4) for review.
- Implement the product's human-approval gates (planner→approval→authoring→approval→variation) as native
  HITL pauses — never auto-approve.
- **NEVER begin task D-T1 (`RemotionMotionEngine`).** It is deferred until the Tier-2 trigger fires;
  leave the interface ready and stop.

## 7. Definition of done (per task; and before advancing a phase)
- Behaviour matches the cited plan task + governing doc section.
- Locks and tenant scoping are enforced AND tested (a guarantee without a test does not exist).
- No CE.SDK/SDK fact hardcoded from memory; it was read from the engine or current docs.
- Audit records written for any tool call that creates, generates, or renders.
- Named acceptance tests pass; typecheck/lint clean.

## 8. Multi-agent coordination (when Cursor and Codex work the repo together)
The goal is parallel speed with zero collisions. Both agents obey §1–§7 above.

**8.1 Ownership map (who may edit which package at a given phase)**
- **Cursor (local, supervised) owns the spine:** Phases 0–2 → `scene-mcp/`, `orchestration/`,
  `renderer/`. This is the engine-/Docker-/license-bound, invariant-sensitive work.
- **Codex (cloud, parallel) owns the leaves, AFTER their upstream interface is frozen:** `frontend/`
  (P3-T1..T6), `infra/` (P4-T1..T2), and clearly-isolated Python (variation engine P2-T3, mapping
  golden tests P0-T3). Codex also runs **adversarial review** of `locks.test.ts` /
  `tenant-isolation.test.ts` / `motion-engine.test.ts`.
- **Rule:** a package has exactly one owner at a time. Consumers **import** shared types/schemas; they
  never edit a package they don't own. If you need a change in someone else's package, request it — do
  not edit across the boundary.

**8.2 The "frozen interface" handoff gate**
- A downstream task may start only when its upstream **interface is FROZEN**: the relevant Zod
  schemas / TypeScript types / the `MotionEngine` interface / MCP tool I/O exist on `main` and pass
  `pnpm -r typecheck`. The spine owner (Cursor) marks a freeze by tagging the commit
  `freeze/<interface>` (e.g. `freeze/motion-engine`, `freeze/mcp-tools`) and noting it in `BUILD_LOG.md`.
- Codex must `git pull main` and confirm the freeze tag exists before starting a dependent leaf task.

**8.3 Branch / PR discipline**
- One task per branch: `<taskid>-<tool>` (`p3-t2-cursor`, `p4-t1-codex`). One task per PR; small diffs.
- No two agents edit the same files concurrently. If a merge conflict appears, the package **owner**
  resolves it.
- PR description states: Task ID, files, tests + results, MUST-VERIFY confirmations, and which freeze
  tag it built against.

**8.4 Shared status ledger**
- `BUILD_LOG.md` (repo root) is the single source of "what's done." Before claiming a task, read it to
  avoid duplicates; after finishing, append a line: `Task ID · tool · branch · freeze-tag · tests pass/fail`.

**8.5 Integration cadence**
- Cursor (or the human) integrates and reviews Codex PRs; all acceptance tests must pass before merge.
- Respect phase gates: Codex does not start Phase 3/4 leaves until Phase 2 interfaces are frozen and
  merged. Codex never touches the spine packages; Cursor never silently rewrites a leaf Codex owns.

## 9. Working style
- Concrete over clever: real paths, real signatures, real test names, small commits.
- Type every MCP tool I/O (Zod in TS, pydantic in Python).
- When blocked or unsure about an API: STOP and ask with the specific question + the doc you checked.
- Secrets (OpenAI, CE.SDK keys) live only in the server via Secret Manager — never in code, never
  returned in a tool result.
