# DEPT Canvas

Enterprise creative platform: CE.SDK editing engine + AI agent layer for editable `.scene` authoring and on-brand variation at scale.

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- uv (Python 3.11+)
- `CESDK_LICENSE` and `OPENAI_API_KEY` (see `.env.example`)

## Quick start

```bash
pnpm install
pnpm typecheck
pnpm test

cd orchestration && uv sync && uv run pytest
```

## Build order

Follow `IMPLEMENTATION_PLAN.md` strictly (Phase 0 → 4). Operating contract: `BUILD_AGENT.md`.

## Packages

| Package | Role |
|---------|------|
| `scene-mcp/` | MCP server, CE.SDK wrapper, motion engine |
| `renderer/` | Batch render worker |
| `edge/` | Public API, tenant routing |
| `frontend/` | React editor shell |
| `orchestration/` | OpenAI Agents SDK (planner, authoring, variation) |
