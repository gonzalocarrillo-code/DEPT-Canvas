# Running DEPT Canvas locally

The product is a frontend (React/Vite) over a 4-process backend. The **real**
request path is:

```
frontend → edge (auth, tenant, CORS) → orchestration (OpenAI Agents) → scene-mcp (CE.SDK tools, locks, audit)
                                                                      ↘ renderer (generate-once / render-many)
```

Everything runs locally with **no GCP** — storage is the local filesystem, audit
is a local file sink, the render queue is in-memory, and auth uses dev tokens.

## Prerequisites (once)

```bash
pnpm install
cd orchestration && uv sync && cd ..
```

Create a repo `.env` (gitignored) — both are **optional** for wiring tests:

```
CESDK_LICENSE=<node + browser trial>     # needed for real CE.SDK render/engine
OPENAI_API_KEY=sk-...                    # needed for real plan/generate
```

Without keys, set `DEPT_MOCK_AI=1` on orchestration for deterministic stubs.

## The 4 backend processes + frontend

**1 — scene-mcp** (CE.SDK tools, locks, audit) → `http://127.0.0.1:3100/mcp`
```bash
set -a; source .env 2>/dev/null; set +a
export SCENE_STORAGE_LOCAL_DIR="$PWD/.local-storage"
pnpm --filter @dept-canvas/scene-mcp dev
```

**2 — orchestration** (FastAPI: /plan, /generate, /scenes) → `:8000`
```bash
cd orchestration
export SCENE_MCP_URL=http://127.0.0.1:3100/mcp
export OPENAI_API_KEY=...        # or: export DEPT_MOCK_AI=1
uv run uvicorn service.app:app --port 8000
```

**3 — edge** (public API: auth, tenant, CORS, proxy) → `:8080`
```bash
export EDGE_AUTH_MODE=dev
export ORCH_BASE_URL=http://127.0.0.1:8000
export RENDERER_URL=http://127.0.0.1:8830
export EDGE_ALLOWED_ORIGIN=http://127.0.0.1:5173
pnpm --filter @dept-canvas/edge dev
```

**4 — renderer** (render jobs + status) → `:8830`
```bash
set -a; source .env 2>/dev/null; set +a
export SCENE_STORAGE_LOCAL_DIR="$PWD/.local-storage"
pnpm --filter @dept-canvas/renderer dev
```

**5 — frontend** → `http://127.0.0.1:5173`. In `frontend/.env.local`:
```
VITE_API_BASE_URL=http://127.0.0.1:8080
VITE_DEV_TOKEN=dev:<base64url({"sub":"u1","tenant_id":"tenant-local","role":"creator"})>
VITE_CESDK_LICENSE=<browser trial>
```
```bash
pnpm --filter @dept-canvas/frontend dev
```
This routes `/api/ai/*`, `/api/scenes/*`, `/api/variations/*` through the **edge**.

> **The Vite AI gateway (`frontend/vite-ai-gateway.ts`) is DEV-ONLY.** It calls
> OpenAI directly and **bypasses** the edge/orchestration/scene-mcp invariants
> (locks, audit, tenancy, safety). It only serves `/api/ai/*` when
> `VITE_API_BASE_URL` is unset. Use the edge for the real path.

## Smoke the slice

With the edge (3) running:

```bash
bash scripts/smoke.sh        # mints a dev token, hits status + plan via the edge
```

## What needs real keys

- **plan / generate**: real output needs `OPENAI_API_KEY` (else `DEPT_MOCK_AI=1`).
- **render stills (png/jpeg/pdf)** + the CE.SDK engine: need `CESDK_LICENSE`.
- **MP4**: needs the imgly renderer container (`CESDK_RENDERER_IMAGE`); gated otherwise.
- **SSO/JWKS**: not needed locally — `EDGE_AUTH_MODE=dev` accepts `dev:` tokens.

## Tests

```bash
pnpm -r test                 # TS: frontend, edge, scene-mcp, renderer
cd orchestration && DEPT_MOCK_AI=1 uv run pytest -q
```

## Invariants (enforced + tested)

- `tenant_id` is resolved server-side from the token/session — **never** from a
  request body (edge `app-proxy.ts`, orchestration headers, scene-mcp `ctx`).
- No destructive tools: the MCP surface has no delete/publish/permission tool
  (`tool-surface.test.ts`, `FORBIDDEN_TOOL_NAMES`).
- Locks enforced in code: the only edit-apply path is `set_properties` →
  `enforceWritableBatch` (a locked write hard-fails + audits — `locks.test.ts`).
- Generation runs a 3-checkpoint safety pipeline + audit and never leaks the key.
