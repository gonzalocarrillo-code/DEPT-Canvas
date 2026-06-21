# DEPT Canvas — Implementation Plan

> **How to use this document.** Build strictly in **Task ID order** (P0-T1, P0-T2, …). Do **not** skip
> Phase 0. Each task is independently executable by reading only this plan plus the one governing
> `*.md` file it names. Before coding any task flagged **MUST VERIFY**, re-confirm the cited fact against
> the live docs (URLs in §F) — APIs move and this plan was written in **June 2026**.
>
> **Governing docs.** `CLAUDE.md` refers to them as `docs/…`; in this repository they currently live at
> the **root**: `CLAUDE.md`, `MOTION_ENGINE.md`, `ANIMATION.md`, `CESDK.md`, `LOCKS.md`, `SECURITY.md`,
> `MAPPING_AGENT.md`, `MCP_SERVER.md`, `AGENTS.md`, `UX.md`, `GCP.md`, and the reference spec
> `DEPT_Canvas_Complete_Architecture.docx`. Leave them where they are; create all new code in the package
> directories in §A.4. Where a doc and the docx spec disagree, **the `*.md` docs win** (CLAUDE.md: "the
> docs are the working rules; the spec is the reference").
>
> **One correction that governs the whole build:** **CE.SDK is a preset-based animation engine, NOT a
> keyframe system.** This is verified and closed (§B). Do **not** build keyframe / custom-bezier tooling
> on CE.SDK. All motion flows through an engine-agnostic **`MotionEngine`** interface; Tier 1 (CE.SDK,
> build now) backs it; Tier 2 (Remotion, true keyframes) is validated but **DEFERRED** behind a trigger.

---

## A. CONTEXT PRIMER (assume zero prior context)

### A.1 Product, in one paragraph
DEPT Canvas is an enterprise creative platform that pairs a professional editing engine (IMG.LY
**CE.SDK**) with an AI agent layer that authors **editable projects, not finished renders**. A brief
becomes an approvable animation plan; an authoring agent builds a real, layered, editable `.scene` file a
human refines; once a master is approved, selected layers are marked AI-variable while logo, brand colour,
CTA placement, and safe zones are **locked as code**; a variation engine then fans the master out into
hundreds of on-brand variants across sizes, durations, copy, and generated backgrounds. Every step passes
a four-checkpoint safety pipeline and writes an immutable audit record. It is multi-tenant with strict
per-client isolation: a shared, stateless control plane (identity, orchestration, tenant routing) over a
per-client siloed data plane (dedicated renderer, DB, storage), hosted on GCP.

### A.2 The seven non-negotiable principles (restated in full — from `CLAUDE.md`)
1. **The AI authors editable scenes, never baked video.** Every generative result is an editable
   layer/fill. A flat render as the *primary* creative artifact is wrong; it is only a final export.
2. **Locks are enforced in code, not by model behaviour.** Frozen properties (logo position, brand
   colour, CTA placement, safe zones) are rejected at the tool layer. Never rely on a prompt to "ask" the
   model to respect a lock. A write to a locked property must hard-fail and be audited. (`LOCKS.md`)
3. **Read engine ground truth; never hardcode API facts from memory.** CE.SDK property names, animatable
   properties, and easing options come from `findAllProperties()` / the `query_animatable` wrapper at
   build or run time. Memory and training data go stale. (`CESDK.md`)
4. **Tenant isolation is absolute.** Every tool resolves `tenant_id` server-side from a scoped token,
   never from an argument. No code path crosses tenants. (`SECURITY.md`)
5. **No destructive or irreversible tools.** The MCP surface has no delete, publish, or permission-change
   tool. Irreversible actions are out of scope for the agent.
6. **Generate-once / render-many.** Generate variable content once per unique combination; render every
   size/duration from it. Never re-call a generation model per aspect ratio.
7. **Two motion tiers, one interface. CE.SDK is preset-based, NOT a keyframe system.** Build the Tier 1
   scale engine (CE.SDK preset-composition) now, behind an engine-agnostic `MotionEngine` interface.
   Tier 2 (Remotion, true keyframes/bezier) is validated but **deferred** — do not build it until the
   trigger fires. Never let CE.SDK assumptions leak above the interface, and never describe CE.SDK as
   having keyframes. (`MOTION_ENGINE.md`, `ANIMATION.md`)

### A.3 Tech stack and why each piece
- **IMG.LY CE.SDK** — the cross-platform editor, timeline, layers, masks, and a programmatic scene/block
  API. We do not rebuild an editor; we wrap CE.SDK. Two distributions are used:
  - `@cesdk/node` (headless `CreativeEngine`, WASM, **no browser**) → authoring + still/PDF export in the
    MCP server and the renderer.
  - `@cesdk/cesdk-js` (browser engine + editor UI) → embedded in the frontend editor (hybrid model, §A.5).
  - **CE.SDK Renderer** (separate native Linux/Docker, GPU/EGL) → server-side MP4 encode at scale (see the
    `exportVideo()` conflict in §B.2).
- **`MotionEngine` interface (DEPT-built swap-seam) + two tiers** (`MOTION_ENGINE.md`, principle #7):
  - **Tier 1 — Scale: `CesdkMotionEngine`** — translates motion intents into CE.SDK **preset composition**
    (In/Out/Loop presets + staggers + the engine's easing enum — 16 on v1.76.1, incl. Back/Spring).
    **Build now.** Flat SDK licence, no
    per-render fee → ideal for high-volume on-brand variation.
  - **Tier 2 — Craft: `RemotionMotionEngine`** — true keyframes + cubic-bezier + spring (Remotion
    `interpolate`/`Easing.bezier`/`spring`). **Validated but DEFERRED**; built only when the trigger in
    `MOTION_ENGINE.md` fires (~≥15% of projects flagged Tier 2 candidates, or a marquee client requires
    bespoke motion). Per-render licence fee (~$0.01/render, $100/mo min) — reserve for low-volume craft.
- **OpenAI Agents SDK (Python, `openai-agents`)** — multi-agent orchestration: `Agent`, `handoff`,
  `@input_guardrail`/`@output_guardrail`, sessions, native human-in-the-loop approval, tracing, and MCP
  client transports. Maps directly onto planner→authoring→variation with human gates and checkpoint-1
  input moderation.
- **OpenAI models** — copy (GPT-class), image/background (gpt-image), moderation
  (`omni-moderation-latest`). Called **only** by the MCP server, which holds the key in Secret Manager.
- **GCP** — Cloud Run (stateless MCP service, `min-instances ≥ 1`), Cloud Run Jobs → GKE for batch render,
  Cloud Tasks/Pub-Sub queue, per-tenant Cloud SQL/AlloyDB + Cloud Storage bucket + KMS key, Secret
  Manager, Cloud Load Balancing + Cloud Armor at the edge, Cloud Logging/Monitoring/Trace.
- **Build tooling (engineering defaults; docs don't mandate a framework — adjust only with reason):**
  Node 20+, TypeScript 5.x (strict), **pnpm workspaces** for the Node/TS packages, **Zod** for tool
  schemas, **Express** for the MCP HTTP server, **Vitest** for TS tests, **Playwright** for frontend E2E.
  Python 3.11+, **uv** for env/deps, **pydantic** for typed models, **pytest**. Frontend: **React 18 +
  TypeScript + Vite**, CSS variables for design tokens, **Zustand** for app/editor state.

### A.4 Repo map (monorepo; root = the existing project dir)
```
dept-canvas/                 # repository root (this folder)
  orchestration/             # Python — OpenAI Agents SDK
    planner/  authoring/  variation/  guardrails/  mapping/  common/
    pyproject.toml           # uv-managed
  scene-mcp/                 # Node/TS — MCP server (Streamable HTTP), CE.SDK wrapper
    src/index.ts             #   Streamable HTTP entrypoint (+ stdio dev harness)
    src/tools/               #   one file per tool, Zod-typed
    src/engine/              #   @cesdk/node headless wrapper + job/session registry
    src/motion/              #   MotionEngine interface + CesdkMotionEngine (Tier 1); RemotionMotionEngine DEFERRED
    src/locks/               #   lock-manifest loader + enforcement
    src/auth/                #   OIDC validation, server-side tenant scoping, RBAC
    src/audit/               #   immutable audit writer
    Dockerfile
  renderer/                  # Node/TS + CE.SDK — batch render worker (Cloud Run Job)
  edge/                      # public API: TLS, token validation, tenant routing
  frontend/                  # React + TS + Vite (hybrid: custom shell + embedded CE.SDK editor)
  infra/                     # Terraform — modules/tenant (per-client silo), shared (control plane)
  spec/                      # the architecture docx + generated tool schemas
  pnpm-workspace.yaml  package.json
```

### A.5 Two engineering decisions this plan fixes (not mandated by the docs)
- **Frontend = React + TypeScript + Vite** (SPA; CE.SDK has first-class web/React support; the canvas is
  client-only so SSR adds no value).
- **Editor = hybrid:** embed the **stock CE.SDK editor** (`@cesdk/cesdk-js`) for deep editing; build a
  **custom DEPT React shell** for dashboard, variation studio, batch review, and governance screens. Per
  `UX.md`, the Tier-1 Animate timeline shows **preset In/Out/Loop bars + stagger handles + a scrubber** —
  **not** a keyframe/speed-graph editor (that arrives only with Tier 2 / Remotion).

---

## B. PHASE 0 SPIKE FINDINGS (verified against current docs — June 2026)

### B.1 CE.SDK headless in Node — confirmed
- **Package** `@cesdk/node` (current stable **v1.76.1**, **Node ≥ 20**). Browser packages
  `@cesdk/cesdk-js` / `@cesdk/engine` are separate. (`registry.npmjs.org/@cesdk/node/latest`,
  `img.ly/docs/cesdk/node/`)
- **Init** `import CreativeEngine from '@cesdk/node'; const engine = await CreativeEngine.init({ license, baseURL })`.
  `license` is required for production and **resolved server-side** (never a tool argument). `baseURL` →
  versioned fonts/emoji asset bundle (self-host for hermetic containers).
- **Authoring** `engine.scene.create('Free'|'VerticalStack'|'HorizontalStack'|'DepthStack')`;
  `engine.block.create('text'|'graphic'|'page')`; `engine.block.appendChild(parent, child)`.
- **Save/load** `engine.scene.saveToString(): Promise<string>` → a **`.scene`** file (asset URL refs);
  `saveToArchive(): Promise<Blob>` → a self-contained **`.zip`**. Load via `loadFromString`,
  `loadFromURL`, `loadFromArchiveURL`.
- **Still/PDF export** `engine.block.export(block, { mimeType }): Promise<Blob>` —
  `image/png|jpeg|webp`, `image/svg+xml`, `application/pdf`, `application/octet-stream`.

### B.2 Server-side MP4 — RESOLVED in P0-T4: Node cannot encode video; use the Renderer container
**Empirically confirmed on v1.76.1 (P0-T4):** `engine.block.exportVideo()` exists in `index.d.ts` but the
Node/WASM runtime **rejects it at call time** with `"Exporting video is currently not supported on
Node.JS"`. So: **stills/JPEG/PDF render via `@cesdk/node` (CPU); MP4 (H.264) MUST route through the CE.SDK
Renderer container** (`docker.io/imgly/cesdk-renderer:1.76.1`, native Linux Ubuntu 24.04, GPU/EGL via
NVIDIA Container Toolkit; licensed-codec variant required for H.264/H.265/AAC) → Cloud Run CPU for stills,
Cloud Run GPU → GKE for MP4. **Still-open:** the container path was documented but **not exercised
end-to-end** (no `CESDK_LICENSE`/Docker creds in the spike env) — validate it with a license + `ffprobe`
H.264 check inside P2-T4 before relying on it. (Sources: `img.ly/docs/cesdk/renderer/get-started/…`,
`renderer/spike/render-spike.md`.)

### B.3 The four `ANIMATION.md` capability questions — **CLOSED: refuted as native** (the answer is the two-tier strategy)
CE.SDK's programmatic animation API is a **closed named-preset model**, confirmed against the live docs.
`ANIMATION.md` states this investigation is **closed**; the conclusion is the two-tier strategy (§A.3),
**not** a workaround to make CE.SDK do keyframes.

| # (`ANIMATION.md` §"Phase 0") | Answer | Evidence |
|---|---|---|
| **Q1** Arbitrary multi-keyframe sequences per property? | **NO.** Only `engine.block.createAnimation(type)` + one `setInAnimation`/`setLoopAnimation`/`setOutAnimation` per block; tune via `setDuration` + per-preset `setFloat`/`setEnum`. No `setKeyframe`/`addKeyframe` exists. | `img.ly/docs/cesdk/engine/guides/using-animations/` |
| **Q2** Per-keyframe custom cubic-bezier easing? | **NO custom bezier / no per-keyframe easing.** Easing is a fixed enum on the preset — but P0-T2 found it has **16 values** on v1.76.1 (Linear/EaseIn/EaseOut/EaseInOut **plus Quart/Quint/Back/Spring variants**), not 4. So **overshoot/spring-feel IS reachable on Tier 1** via Back/Spring easing — you just can't supply control points. Read the list live; never hardcode 4. | `…/animation/create/base-0fc5c4/` + `capability-report.json` |
| **Q3** Nested groups animated as a unit? | **NO.** Groups exist (`group`/`ungroup`, `//ly.img.ubq/group`, transforms cascade) but **"not available when editing videos,"** and animation is gated by `supportsAnimation(block)` (graphic-with-fill / text / shape-with-fill only). | `…/node/create-composition/group-and-ungroup-62565a/` |
| **Q4** Scene-to-scene transitions? | **NO native primitive.** Hierarchy `Scene > Page > Track > Clip`; no `setTransition`/transition block type. | `…/js/create-video/timeline-editor-912252/` |

**Consequence (the build rule):** On **Tier 1**, motion = **composition of CE.SDK presets** + staggers
(time offsets) + the engine's easing enum, exposed only through the `MotionEngine` interface. Every result
is labeled **`native`** (one preset) or **`composed`** (presets combined to approximate an intent). When a
requested intent needs true multi-keyframe tracks / custom-control-point bezier / group animation /
transitions, the engine returns a **"Tier 2 candidate" signal** (and increments the trigger metric) — it
does **not** silently fake it. **NOTE (P0-T2 ground truth, v1.76.1):** the engine ships **25 named
animation presets** — In/Out `slide, pan, fade, blur, grow, zoom, pop, wipe, baseline, crop_zoom, spin`,
**`ken_burns`** (it IS a real type — do not "compose from pan/zoom"), 9 loop variants, and 5 text presets —
and a **16-value** `animationEasing` enum (incl. Back/Spring). **Always re-derive both lists from
`capability-report.json`/`query_animatable`; never hardcode them.** The blur **effect** subsystem (uniform/
linear/mirrored/radial) is confirmed separate from the `blur` animation preset.

### B.4 CE.SDK introspection & authoring API — confirmed (the `query_animatable` ground truth)
- `engine.block.findAllProperties(id): string[]` (category-prefixed keys, e.g. `'fill/solid/color'`,
  `'text/text'`, `'animation/slide/direction'`); works on blocks, fills, effects, **and animation blocks**.
- Typed accessors `getString/setString`, `getFloat/setFloat`, `getBool/setBool`, `getEnum/setEnum`,
  `getColor/setColor`; metadata `getPropertyType(property)`, `isPropertyReadable/Writable`,
  `getEnumValues(property)`; discovery `findByType`, `findByKind`, `findAllSelected`.
- Type vs kind: `getType(id)` → immutable `//ly.img.ubq/…`; `getKind/setKind` → mutable tag. Images/shapes
  are **graphic blocks** with an image fill / a shape.
- Fills: `createFill('image'|'color'|…)`, `getFill/setFill/supportsFill`. **RESOLVED (P0-T2, v1.76.1):**
  the solid colour key is **`'fill/solid/color'`** (RGBA 0..1) — **not** `'fill/color/value'`. Use
  `'fill/solid/color'` in `set_properties`, brand-colour writes, and the brand-colour lock check (or
  better, derive it from `findAllProperties`/`capability-report.json` — never hardcode). Image fill:
  `setString(fill,'fill/image/imageFileURI', url)` then `setFill(graphic, fill)`.
- Text: `create('text')` + `replaceText(block, text)`; key `'text/text'`. Typography: `setTypeface`,
  `setFont`. Shapes: likely `createShape(type)`/`setShape` — **MUST VERIFY**. `getPropertyType` return
  union (`'Float'|'Color'|'String'|'Bool'|'Enum'|'Int'|…`) — **MUST VERIFY** the exact set.
- Animations are first-class blocks: `createAnimation(type): number` → `setInAnimation`/`setOutAnimation`/
  `setLoopAnimation`; `findAllProperties(animId)` + `getEnumValues('animationEasing')` is the mapping
  agent's introspection pattern (create type → read props → classify → destroy).

### B.5 OpenAI Agents SDK (Python) — confirmed (`openai-agents` v0.17.6, Python ≥ 3.10)
- Install `pip install openai-agents`; **import package is `agents`**.
- `from agents import Agent, Runner, handoff, function_tool, input_guardrail, output_guardrail,
  GuardrailFunctionOutput, RunContextWrapper, InputGuardrailTripwireTriggered`.
- `Agent(name, instructions, model, tools, handoffs, mcp_servers, input_guardrails, output_guardrails,
  output_type, …)`. `Runner.run(starting_agent, input, *, session=None, max_turns=10) -> RunResult`
  (`.final_output`, `.to_input_list()`, `.interruptions`); also `run_sync`, `run_streamed`.
- Sessions: `SQLiteSession("id")` passed as `session=`. Handoffs: `handoff(agent, on_handoff=…,
  input_type=…, input_filter=…)`; default transfer tool `transfer_to_<agent>`.
- Guardrails: `@input_guardrail`/`@output_guardrail` → `GuardrailFunctionOutput(tripwire_triggered=…)`;
  a tripwire raises `Input/OutputGuardrailTripwireTriggered` and **halts the run** (= checkpoint 1).
- **Human-approval gate (native HITL):** `@function_tool(needs_approval=True)` pauses; `RunResult.interruptions`
  (`ToolApprovalItem`) → `s=result.to_state(); s.approve(item)/s.reject(item)` → resume `Runner.run(agent, s)`.
  `RunState` serialises (persist a pending approval across the HTTP boundary).
- Tracing on by default → OpenAI dashboard; `with trace("…"):`; `add_trace_processor`/`set_trace_processors`.
  (`openai.github.io/openai-agents-python/{agents,running_agents,handoffs,guardrails,human_in_the_loop,tracing,mcp}/`)

### B.6 Agents SDK ↔ MCP over Streamable HTTP — confirmed
- Client: `from agents.mcp import MCPServerStreamableHttp, MCPServerStdio, MCPServerSse` (**SSE deprecated**).
  `MCPServerStreamableHttp(params={'url':…, 'headers':{'Authorization': f'Bearer {token}'}, 'timeout':10},
  cache_tools_list=True, client_session_timeout_seconds=5, tool_filter=…, max_retry_attempts=3)`; attach via
  `Agent(mcp_servers=[server])`; `async with …` or `connect()/cleanup()`. Filter via
  `create_static_tool_filter(allowed_tool_names=[…], blocked_tool_names=[…])`.
- **`tenant_id` is re-resolved server-side from the token**, never trusted from the client header.
- **Transport spec (stable rev `2025-11-25`):** single MCP endpoint (POST+GET); `Accept: application/json,
  text/event-stream`; `Mcp-Session-Id` assigned on `InitializeResult` and echoed thereafter;
  `MCP-Protocol-Version` header after init; HTTP DELETE ends a session.
  (`modelcontextprotocol.io/specification/2025-11-25/basic/transports`)
- **Node server SDK:** `@modelcontextprotocol/sdk` **v1.29.0** (stable). `import { StreamableHTTPServerTransport }
  from '@modelcontextprotocol/sdk/server/streamableHttp.js'`; `import { McpServer } from
  '@modelcontextprotocol/sdk/server/mcp.js'`. Express mount `app.post/get/delete('/mcp')` →
  `transport.handleRequest`; per-session transport map keyed by `mcp-session-id`; `server.connect(transport)`
  before `handleRequest` on initialize. Options: `sessionIdGenerator`, `enableJsonResponse`, `eventStore`,
  `allowedHosts/Origins`, `enableDnsRebindingProtection`. **MUST VERIFY:** pin v1.x — do **not** use the
  `@modelcontextprotocol/node` v2 alpha (`npm view @modelcontextprotocol/sdk version`).

### B.7 OpenAI models (June 2026) — confirmed; re-verify IDs at build time
- **Image/background** `gpt-image-2` (latest; snapshot `gpt-image-2-2026-04-21`) via
  `/v1/images/generations` or the Responses `image_generation` tool; returns **base64**. Edits/cutout/
  replace-bg via `/v1/images/edits` (`mask`, `background:"transparent"`) — **MUST VERIFY** `gpt-image-2`
  is accepted on `/edits` (else fall back to `gpt-image-1.5`).
- **Copy** `gpt-5.5`/`gpt-5.4`/`gpt-5.4-mini`/`gpt-5.4-nano`; use **Responses API** (`/v1/responses`) +
  **Structured Outputs** (`text.format: json_schema`). **Character caps are NOT enforced by `maxLength`** →
  validate length in code and re-prompt.
- **Moderation** `omni-moderation-latest` (`/v1/moderations`, free, text+image; 13 categories). Checkpoint
  1 (text input) = full coverage; checkpoint 2 (generated image) = image-eligible subset only → brand/IP
  checks need a supplementary vision pass (checkpoint 3).
- **Residency/ZDR** per-project regional domain (`eu.api.openai.com`); in-region processing US/EU/UAE only;
  ZDR contractual. (`developers.openai.com/api/docs/models`, `…/guides/{image-generation,structured-outputs,moderation,your-data}`)

### B.8 Remotion (Tier 2, DEFERRED) — validated for when the trigger fires
Remotion gives a **true keyframe system**: `interpolate(frame,[in],[out])` (unlimited keyframes),
`Easing.bezier(x1,y1,x2,y2)` (arbitrary cubic-bezier), `spring()` (overshoot), `<Sequence>`/`<Composition>`,
`@remotion/transitions`. Headless render to MP4 via `@remotion/renderer` / Cloud Run inside the tenant's
isolated compute; sensitive data passed only via render-time `inputProps`. **Licensing:** Company License
required for companies > 3 people (~$0.01/render, $100/mo min) — per-render fee compounds at volume, so
Tier 2 is reserved for low-volume craft. **Do NOT build this now** (see the deferred task D-T1 and
`MOTION_ENGINE.md`).

---

## C. PHASED TASK BREAKDOWN (the build queue)

Each task: **Goal · Files · Interfaces/Schemas · Depends on · Acceptance (named tests) · Governing doc ·
Complexity (S/M/L) · Biggest risk.**

> **Note on the spec's legacy prompt wording:** the docx §14 Prompts 1/3/6 still say "two position
> keyframes" / list `set_keyframe`, `add_animation`. These predate the correction and are **superseded**
> by `ANIMATION.md`, `MOTION_ENGINE.md`, `MCP_SERVER.md`, and docx §4A / Prompt 7a. Follow the two-tier
> model: **no `set_keyframe`/`add_animation` tools on Tier 1.**
>
> **Phase 0 prerequisite (blocks the build):** a **CE.SDK licence** (`CESDK_LICENSE`) and **OpenAI API
> key** (`OPENAI_API_KEY`); for video, access to the licensed-codec CE.SDK Renderer.

### PHASE 0 — De-risk (`ANIMATION.md`, `MAPPING_AGENT.md`, `CESDK.md`, `MOTION_ENGINE.md`)

#### P0-T1 — Monorepo scaffold & tooling
- **Goal:** stand up the workspace so every later task has a home + test runner.
- **Files:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.env.example`
  (`CESDK_LICENSE`, `OPENAI_API_KEY`, `IMGLY_LOCAL_ASSETS_URL`, …), per-package `package.json`/`tsconfig.json`
  for `scene-mcp`/`renderer`/`edge`/`frontend`, `orchestration/pyproject.toml`, `vitest.config.ts`, `README.md`.
- **Interfaces:** root scripts `build`/`test`/`lint`/`typecheck`; pnpm workspace globs; Python via uv.
- **Depends on:** none. **Acceptance:** `pnpm -r typecheck`+`pnpm -r test` green (empty OK); `uv run pytest`
  green in `orchestration/`. Test `scaffold.smoke.test.ts`.
- **Governing doc:** spec §9.1. **Complexity:** S. **Risk:** mixed Node/Python toolchain drift — pin versions.

#### P0-T2 — CE.SDK authoring spike + capability ground truth (Prompt 1)
- **Goal:** prove headless authoring (scene + text + image + a `slide` **preset** entrance + save `.scene`
  + reload + export PNG) **and** dump `findAllProperties()` for every animation/blur type → the engine
  ground-truth artifact. This **confirms** the §B.3 preset-only finding on the pinned version.
- **Files:** `scene-mcp/spike/authoring-spike.ts`, `scene-mcp/spike/capability-dump.ts`, output
  `scene-mcp/src/engine/capability-report.json` (committed), `scene-mcp/spike/README.md`.
- **Interfaces (verified, §B.1/B.4):**
  ```ts
  const scene = engine.scene.create('Free'); const page = engine.block.create('page'); engine.block.appendChild(scene,page);
  const text = engine.block.create('text'); engine.block.replaceText(text,'Hello'); engine.block.appendChild(page,text);
  const anim = engine.block.createAnimation('slide'); engine.block.setInAnimation(text,anim); engine.block.setDuration(anim,0.6);
  // capability dump: for each candidate type -> createAnimation -> findAllProperties + getPropertyType (+getEnumValues) -> destroy
  // assert NO engine.block.setKeyframe/addKeyframe/createKeyframe exists.
  writeFileSync('out/spike.scene', await engine.scene.saveToString()); await engine.scene.loadFromString(...); await engine.block.export(page,{mimeType:'image/png'});
  ```
  > The Prompt-1 phrase "two position keyframes" is realized as a **`slide`/`pan` preset In animation** and
  > documented as such — CE.SDK has no keyframe API (§B.3).
- **Depends on:** P0-T1. **Acceptance:** `authoring-spike.test.ts` — scene saves, reloads, PNG > 0 bytes;
  `capability-report.json` written; `hasKeyframeApi === false`; `animationEasing` enum equals the four
  values. Prints `CreativeEngine.version`.
- **Governing doc:** `ANIMATION.md`, `CESDK.md`. **Complexity:** M. **Risk:** container fonts/assets not
  resolving (`baseURL`) → blank text; self-host the versioned bundle.

#### P0-T3 — Build-time mapping agent (Prompt 2)
- **Goal:** generate `intent_primitive_map.json` by classifying the engine's real animation types against
  creative intents, validated against `findAllProperties` so a hallucinated type fails the build.
- **Files:** `orchestration/mapping/mapping_agent.py`, `orchestration/mapping/house-style.yaml`,
  `orchestration/mapping/golden-set.json`, `orchestration/mapping/validate.py`, output
  `orchestration/mapping/intent_primitive_map.json`, `orchestration/mapping/tests/test_mapping_validation.py`,
  `…/tests/test_golden_set.py`.
- **Inputs:** `scene-mcp/src/engine/capability-report.json` (P0-T2), IMG.LY docs, `house-style.yaml`.
- **Interface (entry shape):**
  ```json
  { "intent":"energetic_entrance", "animation_type":"//ly.img.ubq/animation/pop",
    "params":{"duration":0.6,"animationEasing":"EaseOut"}, "confidence":0.9, "needs_review":false }
  ```
  Intents: `energetic_entrance, subtle_emphasis, hard_cut, smooth_transition, motion_blur_whoosh,
  attention_loop, exit`.
- **Depends on:** P0-T2. **Acceptance:** `test_mapping_validation.py` — every `animation_type`/`params` key
  exists in `capability-report.json`; an injected fake type **fails the build**. `test_golden_set.py` — each
  of ~12 briefs maps to expected primitive(s).
- **Governing doc:** `MAPPING_AGENT.md`. **Complexity:** M. **Risk:** over-fitting intents; keep
  `needs_review:true` for genuinely new intents on SDK bumps.

#### P0-T4 — Render-path spike (settle the MP4 boundary)
- **Goal:** resolve §B.2 — does `@cesdk/node` `exportVideo()` encode MP4 in Node, or must video route
  through the CE.SDK Renderer container? Establishes the `renderer/` boundary + GPU need.
- **Files:** `renderer/spike/render-spike.md`, `renderer/spike/native-export.ts`, `renderer/spike/run.sh`,
  `renderer/spike/sample.scene`.
- **Interfaces:**
  ```ts
  // in-Node:    await engine.block.exportVideo(page, 'video/mp4', { framerate, videoBitrate })  // works? (MUST VERIFY)
  // container:  docker run --runtime=nvidia --gpus all -e CESDK_LICENSE=$CESDK_LICENSE -v "$PWD/out:/output" \
  //               docker.io/imgly/cesdk-renderer:<version> --input sample.scene --output /output/render.mp4
  ```
- **Depends on:** P0-T2. **Acceptance:** `render-spike.smoke.sh` documents which native path works on the
  pinned version and produces a playable MP4 (`ffprobe` H.264); records a recommendation + GPU placement
  (Cloud Run GPU vs GKE).
- **Governing doc:** `GCP.md`, `CESDK.md`. **Complexity:** M. **Risk:** GPU availability/codec licensing —
  keep the still path CPU-only; video on GPU infra.

### PHASE 1 — MCP server & agents (`MCP_SERVER.md`, `AGENTS.md`, `SECURITY.md`)

#### P1-T1 — `scene-mcp` Streamable HTTP skeleton (Prompt 3, part 1)
- **Goal:** long-lived MCP server over Streamable HTTP + stdio dev harness.
- **Files:** `scene-mcp/src/index.ts`, `scene-mcp/src/server.ts` (`McpServer` + tool registry),
  `scene-mcp/src/dev-stdio.ts`, `scene-mcp/src/http/session-store.ts`, `scene-mcp/tests/transport.test.ts`.
- **Interfaces (verified §B.6):** `StreamableHTTPServerTransport({ sessionIdGenerator: ()=>randomUUID(),
  enableDnsRebindingProtection:true, allowedHosts:[…] })`; `app.post/get/delete('/mcp')` →
  `transport.handleRequest`; per-session map keyed by `mcp-session-id`; `server.connect(transport)` before
  `handleRequest` on initialize.
- **Depends on:** P0-T1. **Acceptance:** `transport.test.ts` — `initialize` returns a session id; a follow-up
  `tools/list` echoing `Mcp-Session-Id` succeeds; DELETE ends the session.
- **Governing doc:** `MCP_SERVER.md`. **Complexity:** M. **Risk:** pulling the v2-alpha SDK — pin `@^1.29`.

#### P1-T2 — CE.SDK engine wrapper + job registry + `query_animatable` (Prompt 3, part 2)
- **Goal:** wrap `@cesdk/node`; one engine+scene per job; typed property dispatch via `getPropertyType`;
  `query_animatable` reads live engine truth.
- **Files:** `scene-mcp/src/engine/engine-pool.ts`, `…/job-registry.ts`, `…/property-io.ts`,
  `…/query-animatable.ts`, `scene-mcp/tests/engine-wrapper.test.ts`.
- **Interfaces:**
  ```ts
  interface Job { id:string; tenantId:string; engine:CreativeEngine; sceneId:number; lockManifest?:LockManifest; brandKit?:BrandKit }
  function createJob(tenantId:string): Promise<Job>;            // CreativeEngine.init server-side (license from env)
  function setTypedProperty(engine, block, key, value): void;   // dispatch by getPropertyType
  function queryAnimatable(engine, blockId): { properties:{key:string;type:string;enumValues?:string[]}[];
    easingOptions:string[]; animationTypes:{type:string;properties:{...}[]}[] };  // live, not constant
  ```
- **Depends on:** P0-T2, P1-T1. **Acceptance:** `engine-wrapper.test.ts` — writes `'fill/solid/color'`, reads
  it back equal; `queryAnimatable` returns the engine's easing enum (16 on v1.76.1) + ≥1 animation type
  **from the engine** (not a hardcoded list).
- **Governing doc:** `CESDK.md`. **Complexity:** L. **Risk:** memory per job — cap concurrent jobs, dispose on
  save/timeout.

#### P1-T3 — Auth, tenant scoping, RBAC (Prompt 3, part 3)
- **Goal:** validate the OIDC service token, **resolve `tenant_id` server-side**, attach role; tools read
  tenant/role from context, never arguments.
- **Files:** `scene-mcp/src/auth/verify-token.ts`, `…/tenant-context.ts`, `…/rbac.ts`,
  `scene-mcp/tests/tenant-isolation.test.ts`.
- **Interfaces:** `interface CallerContext { tenantId:string; userId:string; role:'viewer'|'creator'|'brand_owner'|'approver'|'tenant_admin' }`;
  `contextFromRequest(req): Promise<CallerContext>`; `assertCan(ctx, capability): void` (throws on deny).
- **Depends on:** P1-T1. **Acceptance:** `tenant-isolation.test.ts` — an argument-supplied `tenant_id`
  differing from the token resolves to the **token's** tenant; a viewer calling a creator-only tool is
  rejected server-side.
- **Governing doc:** `SECURITY.md`. **Complexity:** M. **Risk:** trusting client tenant — test proves it's ignored.

#### P1-T4 — Immutable audit writer (Prompt 3, part 4)
- **Goal:** append-only audit of every create/generate/render/lock decision.
- **Files:** `scene-mcp/src/audit/audit-writer.ts`, `…/audit-record.ts`, `scene-mcp/tests/audit.test.ts`.
- **Interface:** `interface AuditRecord { ts; tenantId; userId; tool; argsRedacted; lockDecision?:{property;outcome:'allowed'|'rejected'}; outcome:'ok'|'error'; detail? }`;
  `writeAudit(rec): Promise<void>` (append-only; no update/delete API).
- **Depends on:** P1-T3. **Acceptance:** `audit.test.ts` — append-only (no update/delete method), PII
  redacted, tenant always present.
- **Governing doc:** `SECURITY.md`, `LOCKS.md`. **Complexity:** S. **Risk:** logging secrets/PII — redact by policy.

#### P1-T5 — Core MCP tools, Zod-typed (Prompt 3, part 5)
- **Goal:** implement `create_scene, create_block, set_properties, apply_brand_kit, apply_lock_manifest,
  save_scene` (`generate_asset`→P1-T8; `render_variant`→P2-T4; **motion tools**→P2-T2). Every tool resolves
  `tenant_id` server-side. **No destructive tool exists. No `set_keyframe`/`add_animation`** (per corrected
  `MCP_SERVER.md`).
- **Files:** one per tool under `scene-mcp/src/tools/`, shared `…/tools/_schemas.ts`, `scene-mcp/tests/core-tools.test.ts`.
- **Interfaces (representative Zod):**
  ```ts
  const Color = z.object({ r:z.number(), g:z.number(), b:z.number(), a:z.number().default(1) });
  createScene = { input: z.object({ width:z.number().int().positive(), height:z.number().int().positive(),
    layout:z.enum(['Free','VerticalStack','HorizontalStack','DepthStack']).default('Free') }),
    output: z.object({ jobId:z.string(), sceneId:z.number(), pageId:z.number() }) };
  createBlock = { input: z.object({ jobId:z.string(), parentId:z.number().int(),
    type:z.enum(['text','graphic','page']), kind:z.string().optional() }), output: z.object({ blockId:z.number() }) };
  setProperties = { input: z.object({ jobId:z.string(), blockId:z.number(),
    properties: z.array(z.object({ key:z.string(), value:z.union([z.string(),z.number(),z.boolean(),Color]) })) }),
    output: z.object({ applied:z.array(z.string()) }) };   // hard-fails atomically if any key is locked (P2-T1)
  saveScene = { input: z.object({ jobId:z.string(), archive:z.boolean().default(false) }),
    output: z.object({ sceneRef:z.string() /* storage ref, not bytes; tenant bucket only */ }) };
  ```
- **Depends on:** P1-T2, P1-T3, P1-T4. **Acceptance:** `core-tools.test.ts` — round-trip
  create_scene→create_block→set_properties→save_scene; `save_scene` returns a **ref**, not bytes; no
  `delete`/`publish`/`set_keyframe`/`add_animation` tool is registered.
- **Governing doc:** `MCP_SERVER.md`. **Complexity:** L. **Risk:** drifting property strings — always pass
  through `setTypedProperty`/capability report (§B.4 colour-key caveat).

#### P1-T6 — Orchestration agents: planner / authoring / variation (Prompt 4)
- **Goal:** three Agents SDK agents with handoffs; authoring connects to `scene-mcp` over Streamable HTTP;
  tracing on; human gates modelled.
- **Files:** `orchestration/planner/agent.py`, `orchestration/authoring/agent.py`,
  `orchestration/variation/agent.py`, `orchestration/common/mcp_client.py`, `…/models.py` (pydantic
  `AnimationPlan`, `VariationMatrix`), `…/runner.py`, `orchestration/tests/test_handoffs.py`.
- **Interfaces (verified §B.5/B.6):**
  ```python
  from agents import Agent, Runner, handoff
  from agents.mcp import MCPServerStreamableHttp
  scene_mcp = MCPServerStreamableHttp(params={"url": MCP_URL, "headers": {"Authorization": f"Bearer {token}"}}, cache_tools_list=True)
  planner   = Agent(name="Planner", instructions=PLANNER_SYS, output_type=AnimationPlan)   # references intent_primitive_map.json
  authoring = Agent(name="Authoring", instructions=AUTHORING_SYS, mcp_servers=[scene_mcp])
  variation = Agent(name="Variation", instructions=VARIATION_SYS, mcp_servers=[scene_mcp])
  planner.handoffs = [handoff(authoring)]   # human approval gate between them (P1-T7 / HITL)
  ```
  `AnimationPlan` references motion **intents** (not keyframes) from `intent_primitive_map.json`.
- **Depends on:** P1-T5, P0-T3. **Acceptance:** `test_handoffs.py` — planner emits a valid `AnimationPlan`;
  on approval authoring calls ≥1 MCP tool over Streamable HTTP → `sceneRef`; trace recorded.
- **Governing doc:** `AGENTS.md`. **Complexity:** L. **Risk:** Python↔Node seam latency — cache tools list,
  keep MCP warm.

#### P1-T7 — Input-moderation guardrail (safety checkpoint 1) (Prompt 4/5)
- **Goal:** `@input_guardrail` running `omni-moderation-latest` before any generation; tripwire halts.
- **Files:** `orchestration/guardrails/input_moderation.py`, `orchestration/tests/test_guardrail.py`.
- **Interface:** `@input_guardrail async def input_moderation(ctx,agent,input)->GuardrailFunctionOutput`.
- **Depends on:** P1-T6. **Acceptance:** `test_guardrail.py` — an unsafe brief raises
  `InputGuardrailTripwireTriggered` and **no** generation/MCP call occurs; a clean brief passes.
- **Governing doc:** `SECURITY.md`, `AGENTS.md`. **Complexity:** S. **Risk:** must run **before** generation
  — assert ordering.

#### P1-T8 — `generate_asset` + four-checkpoint safety pipeline (Prompt 5)
- **Goal:** input-moderation → OpenAI generation (copy/image/background; tone/char-caps/negative-keywords) →
  asset-moderation → brand/legal checks; returns a **fill on a block**, never baked; audits each checkpoint;
  OpenAI key never leaves the server.
- **Files:** `scene-mcp/src/tools/generate-asset.ts`, `scene-mcp/src/generation/{openai-client,copy,image,safety-pipeline,char-cap}.ts`,
  `scene-mcp/tests/generate-asset.test.ts`.
- **Interfaces (verified §B.7):**
  ```ts
  generateAsset = { input: z.object({ jobId:z.string(), targetBlockId:z.number().optional(),
    assetType:z.enum(['copy','image','background']), prompt:z.string(), tone:z.array(z.string()).optional(),
    characterLimit:z.number().int().optional(), negativeKeywords:z.array(z.string()).optional(),
    referenceImageRefs:z.array(z.string()).optional(), styleStrength:z.number().min(0).max(1).optional() }),
    output: z.object({ realizedAsFill:z.literal(true), appliedToBlockId:z.number().optional(), assetRef:z.string().optional(),
      checkpoints: z.object({ input:z.enum(['pass','block']), asset:z.enum(['pass','block']), brandLegal:z.enum(['pass','block']) }),
      auditId:z.string() }) };
  // copy: /v1/responses gpt-5.4-mini + Structured Outputs; char caps validated in code + re-prompt.
  // image/background: gpt-image-2 /v1/images/generations (b64) -> tenant bucket -> createFill('image') + setFill.
  ```
- **Depends on:** P1-T5, P1-T7. **Acceptance:** `generate-asset.test.ts` — output is a fill on a block (no
  baked bytes); a prompt over `characterLimit` regenerates until within cap; an unsafe generated asset is
  **blocked** at checkpoint 2 + audited; OpenAI key never appears in any result.
- **Governing doc:** `SECURITY.md`, `CESDK.md`. **Complexity:** L. **Risk:** char caps not enforced by schema
  (§B.7) — the validate-and-retry loop is mandatory.

### PHASE 2 — Locks, variation, the `MotionEngine` (Tier 1), two modes (`LOCKS.md`, `MOTION_ENGINE.md`, `ANIMATION.md`, `AGENTS.md`)

#### P2-T1 — Lock manifest loader + enforcement (Prompt 6)
- **Goal:** `apply_lock_manifest` loads frozen properties into the job; **`set_properties` and every
  `MotionEngine` operation** (`applyIntent`/`stagger`/`setTiming`/`sequence`) hard-reject writes to frozen
  properties and audit the rejection. Guarantee is in code, not the model.
- **Files:** `scene-mcp/src/locks/manifest.ts`, `…/enforce.ts`, `scene-mcp/src/tools/apply-lock-manifest.ts`,
  `scene-mcp/tests/locks.test.ts`.
- **Interfaces:** `interface LockManifest { templateId; version; frozen: Array<{ selector:{blockId?;kind?;name?;role?}; properties:string[]|'*' }> }`;
  `isLocked(job,blockId,property): boolean`; `enforceWritable(job,blockId,property,attempted): void` (throws
  `LockViolation` + `writeAudit(rejected)`). Called by the typed setter path **and** by the
  `CesdkMotionEngine` (P2-T2) so the core and motion surfaces are checked identically (`LOCKS.md` rule 3).
- **Depends on:** P1-T5. **Acceptance:** `locks.test.ts` (guarantees): `rejects_locked_logo_move`,
  `rejects_locked_brand_colour_change`, `rejects_motion_intent_moving_locked_position`,
  `rejects_stagger_moving_locked_position`, `every_rejection_writes_audit`,
  `lock_cannot_be_overridden_by_prompt_text`.
- **Governing doc:** `LOCKS.md`. **Complexity:** M. **Risk:** a write path bypassing `enforceWritable` — route
  **all** mutations through one choke point; assert no tool/engine writes directly.

#### P2-T2 — `MotionEngine` interface + `CesdkMotionEngine` (Tier 1) + motion MCP tools (Prompt 7a)
- **Goal:** implement the engine-agnostic `MotionEngine` and **one** backend, `CesdkMotionEngine`
  (preset-composition). Expose motion MCP tools (`apply_intent`, `stagger`, `set_timing`, `sequence`,
  `query_animatable`) that talk **only** to the interface — never to CE.SDK directly. `capabilities()`
  reports CE.SDK's real limits; an over-capability request returns a **"Tier 2 candidate" signal** and
  increments a trigger metric; every result is labeled `native` or `composed`. **Do NOT implement
  `RemotionMotionEngine`** (that is D-T1, deferred).
- **Files:** `scene-mcp/src/motion/motion-engine.ts` (the interface + types), `…/cesdk-motion-engine.ts`,
  `…/tier2-metric.ts` (candidate counter), `scene-mcp/src/tools/{apply-intent,stagger,set-timing,sequence,query-animatable}.ts`,
  `scene-mcp/src/motion/MOTION_README.md`, `scene-mcp/tests/motion-engine.test.ts`.
- **Interfaces (the contract from `MOTION_ENGINE.md` §4A.3):**
  ```ts
  type MotionResult = { realizedAs: 'native' | 'composed'; appliedPresets: string[] };
  type Tier2Candidate = { tier2Candidate: true; reason: string };   // returned, NOT thrown; increments metric
  interface MotionEngine {
    applyIntent(jobId: string, blockId: number, intent: string, params?: Record<string, number|string>): Promise<MotionResult | Tier2Candidate>;
    stagger(jobId: string, blockIds: number[], timing: { stepSec: number }): Promise<MotionResult | Tier2Candidate>;
    setTiming(jobId: string, blockId: number, t: { start: number; duration: number }): Promise<MotionResult | Tier2Candidate>;
    sequence(jobId: string, sceneIds: number[], offsets: number[]): Promise<MotionResult | Tier2Candidate>;
    capabilities(): { keyframeTracks: boolean; customBezier: boolean; easings: string[]; groupAnimation: boolean; transitions: boolean };
    render(sceneRef: string, format: 'mp4'|'png'|'pdf'): Promise<string>;   // storage ref (see P2-T4)
  }
  // CesdkMotionEngine.capabilities() => { keyframeTracks:false, customBezier:false,
  //   easings:['Linear','EaseIn','EaseOut','EaseInOut'], groupAnimation:false, transitions:false }
  // MCP tool example:
  applyIntent = { input: z.object({ jobId:z.string(), blockId:z.number(), intent:z.string(),
    params:z.record(z.union([z.string(),z.number()])).optional() }),
    output: z.union([ z.object({ realizedAs:z.enum(['native','composed']), appliedPresets:z.array(z.string()) }),
                      z.object({ tier2Candidate:z.literal(true), reason:z.string() }) ]) };
  ```
  **Hard rules:** the planner, authoring agent, and MCP tools import the **`MotionEngine` interface only**,
  never `CesdkMotionEngine` or `@cesdk/node` (§A.2 principle 7). `query_animatable` is called before
  authoring so presets/easings are engine truth (`ANIMATION.md`). Every motion write routes through the lock
  choke point (P2-T1).
- **Depends on:** P2-T1, P0-T2 (capability report), P0-T3 (intent map). **Acceptance:** `motion-engine.test.ts`
  — `capabilities()` reports `keyframeTracks:false`/`customBezier:false` and the engine's **actual** easing
  enum read live from `capability-report.json` (16 on v1.76.1, incl. Back/Spring — NOT hardcoded to 4);
  `apply_intent('energetic_entrance')` returns `realizedAs:'native'|'composed'` and applies a real preset;
  a request needing custom bezier / group animation / a transition returns a **`tier2Candidate`** signal and
  the metric increments (`tier2_candidate_signalled_not_faked`); a motion op on a **locked** property is
  rejected + audited (`motion_respects_locks`); **no module under `src/tools` or `orchestration/` imports
  `@cesdk/node` or `cesdk-motion-engine` directly** (`no_engine_leak_above_interface` — static import scan).
- **Governing doc:** `MOTION_ENGINE.md`, `ANIMATION.md`, `LOCKS.md`. **Complexity:** L. **Risk:** engine
  assumptions leaking above the interface — enforce with the import-scan test; never silently approximate
  without the `composed`/`tier2Candidate` label.

#### P2-T3 — Variation engine + generate-once/render-many (Prompt 7)
- **Goal:** per-layer states (AI-variable / fixed / brand-locked); generate variable content **once per
  unique combination**, render every size/duration from it; surface estimated cost+time pre-batch.
- **Files:** `orchestration/variation/engine.py`, `…/matrix.py`, `…/cost_estimate.py`,
  `orchestration/tests/test_generate_once.py`.
- **Interfaces:** `class VariationMatrix(BaseModel){ sizes; durations; copy_variants; backgrounds;
  layer_states: dict[int, Literal['ai_variable','fixed','brand_locked']] }`; `plan_generations(m) ->
  list[GenerationKey]` (dedupe to unique content combos); `estimate(m) -> {count,cost_usd,eta_sec}`.
- **Depends on:** P1-T8, P2-T1. **Acceptance:** `test_generate_once.py` — for N sizes × 1 copy/background,
  generation is called **once**; `estimate()` shown before any `render_variant`.
- **Governing doc:** spec §4.4/§3.2, `GCP.md`. **Complexity:** M. **Risk:** combinatorial cost — estimate gate
  precedes fan-out.

#### P2-T4 — `render_variant` tool + renderer worker (Prompt 7, render path)
- **Goal:** `render_variant` enqueues an async job (Cloud Tasks) consumed by `renderer/`; rendering goes
  through `MotionEngine.render()`. Stills/JPEG/PDF via `@cesdk/node` (CPU); **MP4 ONLY via the CE.SDK
  Renderer container** (`docker.io/imgly/cesdk-renderer:1.76.1`, GPU/EGL) — `exportVideo()` is rejected in
  Node (P0-T4 confirmed), so there is no native-Node MP4 path. **First action in this task:** validate the
  container path end-to-end with a real `CESDK_LICENSE` + `ffprobe` H.264 check (P0-T4 documented it but did
  not exercise it). Writes only to the tenant bucket.
- **Files:** `scene-mcp/src/tools/render-variant.ts`, `renderer/src/worker.ts`, `renderer/src/cesdk-render.ts`,
  `renderer/Dockerfile`, `renderer/tests/render-worker.test.ts`.
- **Interfaces:**
  ```ts
  renderVariant = { input: z.object({ sceneRef:z.string(),
    outputs: z.array(z.object({ width:z.number().int(), height:z.number().int(),
      durationSec:z.number().optional(), format:z.enum(['png','jpeg','pdf','mp4']) })) }),
    output: z.object({ renderJobId:z.string(), estimated: z.object({ count:z.number(), costUsd:z.number(), etaSec:z.number() }) }) };
  ```
- **Depends on:** P2-T2 (`render()`), P2-T3, P0-T4. **Acceptance:** `render-worker.test.ts` — `render_variant`
  enqueues + returns a job id (no synchronous render on the tool path); the worker renders a still via
  `@cesdk/node` and MP4 via the path P0-T4 selected; the same scene renders to multiple aspect ratios from one
  generation (generate-once/render-many); output lands only in the tenant bucket.
- **Governing doc:** `GCP.md`, `MCP_SERVER.md`. **Complexity:** L. **Risk:** Renderer GPU/codec licensing —
  still path CPU-only, video on GPU infra.

#### P2-T5 — Two generation modes as configuration (Prompt 7b)
- **Goal:** compose (prompt-only, wide latitude within brand kit) vs constrained (master + lock manifest +
  spec, fills only unlocked slots) — same agents, same enforcement, differing only in locks set.
- **Files:** `orchestration/common/modes.py`, `orchestration/tests/test_modes.py`.
- **Interface:** `class GenerationMode(Enum): COMPOSE; CONSTRAINED` → selects which lock manifest is applied;
  **no separate code path**.
- **Depends on:** P2-T1, P1-T6. **Acceptance:** `test_modes.py` — `constrained_never_changes_locked` (full
  batch leaves every locked property byte-identical); `compose_has_structural_latitude`.
- **Governing doc:** `AGENTS.md`, `LOCKS.md`. **Complexity:** M. **Risk:** a config branch that duplicates
  logic — keep one path.

### PHASE 3 — UX / UI (`UX.md`) — the differentiator (Prompts 8–13)

> **Editor model: hybrid** (§A.5). **Tier-1 timeline shows preset In/Out/Loop bars + stagger handles + a
> scrubber — NOT a keyframe/speed-graph editor** (that is Tier 2 / Remotion, deferred). Style: sentence case,
> two font weights, flat surfaces, canvas always primary.

#### P3-T1 — Design system & app shell (Prompt 8)
- **Goal:** tokens + shell (top bar, left icon rail, left contextual panel, center canvas, right panel,
  collapsible bottom timeline).
- **Files:** `frontend/src/main.tsx`, `frontend/src/app/Shell.tsx`, `frontend/src/design/tokens.css`,
  `frontend/src/design/{Button,Panel,IconRail,TopBar}.tsx`, `frontend/tests/shell.spec.ts`.
- **Depends on:** P0-T1. **Acceptance:** `shell.spec.ts` — all regions render; sentence-case + two-weight
  tokens; timeline collapsed by default. **Governing doc:** `UX.md`. **Complexity:** M. **Risk:** scope creep.

#### P3-T2 — Editor: Design/Animate progressive disclosure (Prompt 9)
- **Goal:** embed CE.SDK editor; Design mode hides the timeline (Canva-like); **Animate mode reveals per-layer
  preset In/Out/Loop bars + stagger handles + scrubber** (Tier 1); format switcher 1:1/9:16/16:9/4:5; layers
  panel shows lock badges.
- **Files:** `frontend/src/editor/EditorScreen.tsx`, `…/CesdkCanvas.tsx` (mounts `@cesdk/cesdk-js`),
  `…/DesignAnimateToggle.tsx`, `…/Timeline.tsx`, `…/FormatSwitcher.tsx`, `frontend/tests/editor.spec.ts`.
- **Interfaces:** `useCesdk()` hook; `mode:'design'|'animate'`; timeline renders **preset bars/stagger**, not
  keyframe diamonds. A keyframe/speed-graph editor is explicitly out of scope until Tier 2.
- **Depends on:** P3-T1, P2-T2. **Acceptance:** `editor.spec.ts` — Animate reveals the preset timeline; locked
  layers show a lock badge; format switch reframes the same scene.
- **Governing doc:** `UX.md`. **Complexity:** L. **Risk:** implying keyframe editing exists on Tier 1 — present
  preset bars honestly.

#### P3-T3 — Contextual AI panel (Prompt 10)
- **Goal:** selection-scoped actions (background→"replace background"; text→"copy variants"; image→"cut out
  subject"/"animate to video"); locked layers grey AI actions; simple (prompt+tone) / advanced (guidance,
  char caps, negative keywords, reference/style pins); properties below.
- **Files:** `frontend/src/editor/AiPanel.tsx`, `…/ai/{SimpleControls,AdvancedControls}.tsx`, `…/ai/actions.ts`,
  `frontend/tests/ai-panel.spec.ts`.
- **Depends on:** P3-T2, P1-T8. **Acceptance:** `ai-panel.spec.ts` — actions change with selection type; a
  **locked layer's AI actions are disabled**; advanced char-cap is sent to `generate_asset`.
- **Governing doc:** `UX.md`, `SECURITY.md`. **Complexity:** M. **Risk:** UI implying it enforces locks — it
  reflects; the server enforces (P2-T1).

#### P3-T4 — Variation studio & batch review (Prompt 11)
- **Goal:** studio to mark layers AI-variable/fixed/locked, set axes, show count + estimated cost/time, generate
  batch; review grid with done/rendering/queued, spot-check, approve-all, reject-individual, push-to-delivery
  gated behind approval.
- **Files:** `frontend/src/variation/{StudioScreen,AxisEditor,ReviewGrid,CostEstimate}.tsx`,
  `frontend/tests/variation.spec.ts`.
- **Depends on:** P3-T1, P2-T3, P2-T4. **Acceptance:** `variation.spec.ts` — count+cost shown before generate;
  push-to-delivery disabled until an approver approves. **Governing doc:** `UX.md`. **Complexity:** L. **Risk:**
  cost shown only after the fact — gate before.

#### P3-T5 — Workspace dashboard (Prompt 12)
- **Goal:** projects by brand workspace, recent, search/filter, templates + variations; reach any master in a
  couple clicks.
- **Files:** `frontend/src/dashboard/{DashboardScreen,Search,Filters,WorkspaceTree}.tsx`,
  `frontend/tests/dashboard.spec.ts`.
- **Depends on:** P3-T1. **Acceptance:** `dashboard.spec.ts` — search returns a master in ≤2 interactions.
  **Governing doc:** `UX.md`. **Complexity:** M. **Risk:** none major.

#### P3-T6 — Auth / account / users / tenant settings (Prompt 13)
- **Goal:** SSO login (SAML/OIDC, no password storage) + logout; profile; user & role management (five RBAC
  roles); tenant settings. UI reflects permissions; server enforces.
- **Files:** `frontend/src/auth/LoginScreen.tsx`, `…/account/ProfileScreen.tsx`, `…/admin/UserRoleScreen.tsx`,
  `…/admin/TenantSettingsScreen.tsx`, `frontend/tests/auth-screens.spec.ts`.
- **Depends on:** P3-T1, P1-T3. **Acceptance:** `auth-screens.spec.ts` — role list matches
  `viewer/creator/brand_owner/approver/tenant_admin`; a viewer cannot trigger creator actions (server rejects
  if forced). **Governing doc:** `SECURITY.md` (§5), `UX.md`. **Complexity:** M. **Risk:** treating UI gating as
  security — it is not.

### PHASE 4 — Enterprise hardening (`SECURITY.md`, `GCP.md`)

#### P4-T1 — Terraform per-tenant module (Prompt 14, part 1)
- **Goal:** one command provisions a tenant silo: dedicated DB, bucket, KMS key (CMEK-capable), Cloud Run MCP
  service (`min-instances ≥ 1`), IAM.
- **Files:** `infra/modules/tenant/{main,variables,outputs}.tf`, `…/README.md`, `infra/tests/tenant_module.tftest.hcl`.
- **Interfaces:** inputs `tenant_id`, `region`, `cmek_key?`; outputs `db_conn`, `bucket_name`, `mcp_service_url`, `kms_key_id`.
- **Depends on:** P1-T1. **Acceptance:** `terraform validate` + `tftest` plan asserts per-tenant DB+bucket+KMS+
  Cloud Run and **no cross-tenant IAM binding**. **Governing doc:** `GCP.md`, `SECURITY.md` (§5.3/§6).
  **Complexity:** L. **Risk:** per-tenant cost — keep the module cheap/automated.

#### P4-T2 — Shared control plane + edge (Prompt 14, part 2)
- **Goal:** edge API (TLS, session-token validation, tenant routing, Cloud Armor rate limiting), Cloud Tasks
  queue, Cloud Run Jobs renderer + documented GKE escalation; MCP server **not** internet-exposed, egress
  restricted to OpenAI + tenant bucket.
- **Files:** `edge/src/{server,validate-token,tenant-router,rate-limit}.ts`, `infra/shared/{edge,queue,renderer_job,network}.tf`,
  `edge/tests/routing.test.ts`.
- **Depends on:** P4-T1, P1-T3. **Acceptance:** `routing.test.ts` — a request routes to the token's tenant
  silo; an MCP egress to a non-allowed host is blocked; rate limit trips. **Governing doc:** `GCP.md`,
  `SECURITY.md`. **Complexity:** L. **Risk:** egress misconfig — assert allow-list.

#### P4-T3 — Audit sink, observability, residency (Prompt 15)
- **Goal:** immutable audit sink (tenant/identity/tool/redacted-args/lock-decisions/outcome) for every step;
  Cloud Logging/Monitoring/Trace + Agents SDK tracing; per-tenant residency pinning region for Cloud Run, DB,
  bucket (confirm OpenAI regional/ZDR terms).
- **Files:** `infra/shared/{audit_sink,observability}.tf`, `scene-mcp/src/audit/sink.ts`,
  `orchestration/common/tracing.py`, `infra/modules/tenant/residency.tf`, `scene-mcp/tests/audit-sink.test.ts`.
- **Depends on:** P1-T4, P4-T1. **Acceptance:** `audit-sink.test.ts` — every create/generate/render and every
  lock rejection produces an immutable record; residency var pins a tenant's region across all three resources.
- **Governing doc:** `SECURITY.md`, `GCP.md`. **Complexity:** M. **Risk:** OpenAI in-region processing limited to
  US/EU/UAE (§B.7) — surface per tenant.

#### P4-T4 — SSO/SCIM federation + server-side RBAC matrix (§5 backend)
- **Goal:** SAML/OIDC federation to client IdPs, short-lived OIDC service tokens internally, SCIM (optional),
  break-glass admin (audited), full RBAC capability matrix enforced server-side in every service.
- **Files:** `edge/src/sso/{saml,oidc}.ts`, `edge/src/scim/provisioning.ts`,
  `scene-mcp/src/auth/capability-matrix.ts`, `edge/tests/sso.test.ts`, `scene-mcp/tests/rbac-matrix.test.ts`.
- **Depends on:** P4-T2, P1-T3. **Acceptance:** `rbac-matrix.test.ts` — each role's allowed/denied caps match
  `SECURITY.md` §5.2; cross-tenant access denied for every role. **Governing doc:** `SECURITY.md`. **Complexity:**
  L. **Risk:** federation edge cases — break-glass separate + audited.

### DEFERRED — build only when the Tier 2 trigger fires (`MOTION_ENGINE.md`)

#### D-T1 — `RemotionMotionEngine` (Tier 2 craft engine) — **DO NOT BUILD NOW** (Prompt 16, deferred)
- **Trigger (gate):** **≥ ~15% of projects** flagged Tier 2 candidates (track the metric from P2-T2), **or** a
  committed marquee client contractually requires bespoke motion. Until then, Tier 2 candidates are finished
  manually by a human in the editor, or deferred.
- **Goal (when built):** implement `RemotionMotionEngine` as a **second backend of the existing `MotionEngine`
  interface** — **do not modify the interface or the CE.SDK Tier 1 path**. Author motion as React using
  `interpolate()`, `Easing.bezier()`, `spring()`; `capabilities()` reports full keyframe + custom-bezier.
  Render via Remotion on GCP Cloud Run **inside the tenant's isolated compute**; pass sensitive data only via
  render-time `inputProps`, never hardcoded. Acquire a Remotion **Company License**; account for the per-render
  fee. Route only Tier 2 (craft) projects here; scale work stays on CE.SDK.
- **Files (when built):** `scene-mcp/src/motion/remotion-motion-engine.ts`, `renderer/remotion/…`,
  `scene-mcp/tests/remotion-motion-engine.test.ts`.
- **Depends on:** P2-T2 (the interface), and the trigger. **Acceptance:** the same motion MCP tools, unchanged,
  now report `keyframeTracks:true`/`customBezier:true` via `capabilities()` for Tier-2 projects; the CE.SDK
  Tier 1 path and the interface are untouched; renders run in the tenant's isolated compute.
- **Governing doc:** `MOTION_ENGINE.md`, `ANIMATION.md` §"Tier 2". **Complexity:** L. **Risk:** building it early
  / on a hunch — gate strictly on the metric; per-render cost compounds at volume.

---

## D. CROSS-CUTTING REQUIREMENTS (where each is enforced, per task)

| Requirement | Enforced in | Proven by |
|---|---|---|
| **Lock enforcement at the tool layer** (`LOCKS.md`) | `scene-mcp/src/locks/enforce.ts` choke point; called by `set_properties` (P1-T5) and **every `MotionEngine` op** in `CesdkMotionEngine` (P2-T2). Hard-fail + audit; never a prompt. | P2-T1 `locks.test.ts`; P2-T2 `motion_respects_locks`; P2-T5 `constrained_never_changes_locked` |
| **Tenant isolation via server-side `tenant_id`** (`SECURITY.md`) | `scene-mcp/src/auth/tenant-context.ts` (P1-T3); token-derived only. Per-tenant DB/bucket/KMS (P4-T1); egress allow-list (P4-T2). | P1-T3 `tenant-isolation.test.ts`; P4-T2 `routing.test.ts` |
| **Read engine truth, never hardcode CE.SDK facts** (`CESDK.md`) | `query_animatable`/`findAllProperties` + `capability-report.json` (P0-T2); typed dispatch via `getPropertyType` (P1-T2); mapping validated vs engine (P0-T3). | P0-T2 `authoring-spike.test.ts`; P0-T3 `test_mapping_validation.py`; P1-T2 `engine-wrapper.test.ts` |
| **Two tiers, one interface; no engine leak; CE.SDK ≠ keyframes** (`MOTION_ENGINE.md`, principle 7) | All motion via the `MotionEngine` interface (P2-T2); agents/tools never import `@cesdk/node`/`CesdkMotionEngine`; over-capability → `tier2Candidate` signal + metric; results labeled `native`/`composed`; **no `set_keyframe` tool**. | P2-T2 `no_engine_leak_above_interface`, `tier2_candidate_signalled_not_faked`; P1-T5 absence of `set_keyframe` |
| **Generate-once / render-many** | `orchestration/variation/engine.py` dedupes to unique content combos before `render_variant` fan-out (P2-T3); cost-estimate gate (P2-T3/P3-T4). | P2-T3 `test_generate_once.py` |
| **No destructive tools** | MCP registry exposes no delete/publish/permission tool (P1-T5); irreversible actions surfaced to humans only (HITL). | P1-T5 `core-tools.test.ts` asserts absence |
| **Editable output, never baked** | `generate_asset` returns a fill (P1-T8); `save_scene` returns a `.scene`/`.zip` ref (P1-T5); flat render only via `render_variant` (P2-T4). | P1-T8 `generate-asset.test.ts` (`realizedAsFill`) |
| **Secrets never in model/results** (`SECURITY.md`) | OpenAI/CE.SDK keys via Secret Manager, server-side only (P1-T8, P4-T1). | P1-T8 asserts key never in a tool result |

---

## E. TEST PLAN (the guarantees that must exist)

**Lock & isolation tests (guarantees — a guarantee without a test does not exist):**
- `scene-mcp/tests/locks.test.ts`: `rejects_locked_logo_move`, `rejects_locked_brand_colour_change`,
  `rejects_motion_intent_moving_locked_position`, `rejects_stagger_moving_locked_position`,
  `constrained_mode_full_batch_leaves_locks_unchanged`, `every_rejection_writes_audit`,
  `lock_cannot_be_overridden_by_prompt_text`.
- `scene-mcp/tests/tenant-isolation.test.ts`: `argument_tenant_id_is_ignored`, `cross_tenant_read_denied`,
  `cross_tenant_write_denied`, `role_denied_capability_rejected_server_side`.
- `scene-mcp/tests/motion-engine.test.ts`: `no_engine_leak_above_interface` (static import scan: nothing under
  `src/tools`/`orchestration` imports `@cesdk/node` or `cesdk-motion-engine`), `tier2_candidate_signalled_not_faked`,
  `motion_respects_locks`, `capabilities_reports_preset_limits`, `motion_result_labeled_native_or_composed`.

**Mapping-agent golden set:**
- `orchestration/mapping/tests/test_golden_set.py`: the ~12 briefs in `golden-set.json` each resolve to the
  expected primitive(s); an SDK/prompt change that re-maps a brief fails the test.
- `…/test_mapping_validation.py`: every emitted `animation_type`/`params` key exists in
  `capability-report.json`; an injected hallucinated type **fails the build**.

**Python ↔ Node Streamable HTTP integration:**
- `orchestration/tests/test_mcp_integration.py`: an Agents SDK `MCPServerStreamableHttp` client connects to a
  running `scene-mcp`, `tools/list` returns the registered core + motion tools, and an authoring run executes
  `create_scene`→`create_block`→`apply_intent`→`save_scene` end-to-end over Streamable HTTP, asserting the
  `Mcp-Session-Id` is established and a bearer token is required. Pair with `scene-mcp/tests/transport.test.ts`.

**Pipeline & safety:** `orchestration/tests/test_guardrail.py` (checkpoint 1 halts before generation);
`scene-mcp/tests/generate-asset.test.ts` (checkpoints 2–3, fill-not-baked, char-cap retry, key never leaks).

**Frontend E2E (Playwright):** `editor.spec.ts`, `ai-panel.spec.ts`, `variation.spec.ts`, `auth-screens.spec.ts`.

---

## F. EXECUTION NOTES FOR CURSOR (handoff)

1. **Build strictly in Task ID order. Do NOT skip Phase 0.** P0-T2/T4 retire the remaining unknowns
   (authoring viability + capability ground truth; the MP4 render boundary).
2. **The animation question is CLOSED.** CE.SDK is **preset-based, not a keyframe system** (§B.3,
   `ANIMATION.md`). **Do NOT build `set_keyframe`/custom-bezier/transition tooling on CE.SDK** — it does not
   exist. All motion goes through the `MotionEngine` interface (P2-T2). When a request exceeds
   `capabilities()`, return a **"Tier 2 candidate" signal** — never silently fake it.
3. **Do NOT build `RemotionMotionEngine` (D-T1) until the trigger fires** (~≥15% Tier 2 candidate rate or a
   marquee client). Leave the interface ready for it; never modify the interface or the CE.SDK Tier 1 path to
   accommodate it early.
4. **The spec docx §14 Prompts 1/3/6 contain legacy "keyframe" wording** that is **superseded** by
   `ANIMATION.md`/`MOTION_ENGINE.md`/`MCP_SERVER.md` and docx §4A / Prompt 7a. Follow the two-tier model.
5. **Re-verify every fast-moving fact before coding the part that uses it** (you won't have the research context
   this plan was built from):
   - CE.SDK headless/animation/introspection: `https://img.ly/docs/cesdk/node/`,
     `https://img.ly/docs/cesdk/engine/guides/using-animations/`,
     `https://img.ly/docs/cesdk/js/concepts/blocks-90241e/`, `https://img.ly/docs/cesdk/js/llms-full.txt`,
     `https://img.ly/docs/cesdk/changelog/`; pin version via `https://registry.npmjs.org/@cesdk/node/latest`.
   - CE.SDK Renderer (video/MP4): `https://img.ly/docs/cesdk/renderer/get-started/commandline-4230bf/`,
     `…/renderer/get-started/node-processing-a2e4dc/`.
   - OpenAI Agents SDK: `https://openai.github.io/openai-agents-python/` (agents, running_agents, handoffs,
     guardrails, human_in_the_loop, tracing, mcp, ref/mcp/server); version `https://pypi.org/project/openai-agents/`.
   - MCP transport: `https://modelcontextprotocol.io/specification/2025-11-25/basic/transports`; Node SDK
     `https://github.com/modelcontextprotocol/typescript-sdk` (pin v1.x via `npm view @modelcontextprotocol/sdk version`).
   - OpenAI models/APIs: `https://developers.openai.com/api/docs/models` and `…/guides/{image-generation,structured-outputs,moderation,your-data}`.
   - Remotion (only when D-T1 unlocks): `https://www.remotion.dev/docs/` + `https://www.remotion.dev/license`.
6. **"MUST VERIFY" items — status after Phase 0:** (a) §B.2 `exportVideo()`-in-Node — **RESOLVED**: rejected
   in Node, MP4 = Renderer container only; (b) §B.4 solid-colour key — **RESOLVED**: `'fill/solid/color'` on
   v1.76.1 (not `'fill/color/value'`); easing enum — **RESOLVED**: 16 values incl. Back/Spring. **Still open,
   confirm before the relevant task:** `getPropertyType` union, `findByName`, `createShape`/`setShape` + shape
   types, blur-effect (`createBlur`/`BlurType`) names (§B.4); §B.5 exact `Runner.run` kwargs and handoff-level
   `needs_approval`; §B.6 pin `@modelcontextprotocol/sdk` v1.x (not the v2 alpha); §B.7 `gpt-image-2` on
   `/v1/images/edits` (else `gpt-image-1.5`), and that char caps need a code-side validate-and-retry loop;
   §B.2 the Renderer **container** path still needs an end-to-end license + `ffprobe` validation in P2-T4.
7. **Hard product invariants (never violate):** AI authors editable scenes not baked video; locks enforced in
   code + audited; `tenant_id` server-side only; no delete/publish/permission tools; generate-once/render-many;
   engine facts read live; **two tiers behind one interface, CE.SDK never described or used as a keyframe engine.**
8. **Definition of done per task** (`CLAUDE.md`): behaviour matches the cited spec/doc section; locks + tenant
   scoping enforced and tested; no CE.SDK/SDK fact hardcoded from memory; audit records written for any
   create/generate/render tool call.
