"""FastAPI HTTP surface for the orchestration control plane.

The edge validates the session + resolves the tenant, then forwards product calls
here with `X-Tenant-Id`/`X-User-Id`/`X-User-Role` as TRUSTED headers. tenant_id is
never read from the request body. Runs in mock mode (deterministic, no OpenAI) when
OPENAI_API_KEY is absent or DEPT_MOCK_AI=1, so the full wiring is verifiable locally
without a key — mirroring the dev gateway's simulated path.
"""

from __future__ import annotations

import os
from typing import Optional

from fastapi import FastAPI, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from planner.production_plan import GraphPlan, clamp_plan, mock_graph_plan

PLAN_MODEL = "gpt-5.4-mini"
IMAGE_MODEL = "gpt-image-2"
TEXT_MODEL = "gpt-5.4-mini"

app = FastAPI(title="DEPT Canvas Orchestration", version="0.1.0")


def ai_configured() -> bool:
    """Real AI is on only with a key and not explicitly mocked."""
    return bool(os.getenv("OPENAI_API_KEY")) and os.getenv("DEPT_MOCK_AI") != "1"


class PlanRequest(BaseModel):
    brief: str = ""
    mode: str = "compose"


class GenerateRequest(BaseModel):
    kind: str = "image"
    prompt: str = ""


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "dept-canvas-orchestration"}


@app.get("/status")
def status() -> dict:
    return {"configured": ai_configured(), "planModel": PLAN_MODEL, "imageModel": IMAGE_MODEL}


@app.post("/plan")
async def plan(req: PlanRequest, x_tenant_id: Optional[str] = Header(default=None)) -> dict:
    if not ai_configured():
        return mock_graph_plan(req.brief).model_dump()
    # Real path: run the production-plan agent (emits the GraphPlan shape).
    from agents import Runner

    from planner.production_plan import build_production_planner

    planner = build_production_planner()
    result = await Runner.run(planner, req.brief, max_turns=4)
    plan_obj = result.final_output
    if isinstance(plan_obj, GraphPlan):
        return clamp_plan(plan_obj).model_dump()
    return mock_graph_plan(req.brief).model_dump()


@app.post("/generate")
async def generate(
    req: GenerateRequest,
    x_tenant_id: Optional[str] = Header(default=None),
) -> JSONResponse:
    # Mock: simulated copy; images have no bytes locally (frontend keeps its placeholder).
    if not ai_configured():
        if req.kind in ("copy", "transcreate"):
            seed = req.prompt.strip() or "Untitled"
            return JSONResponse({"kind": req.kind, "text": f"{seed} ·"})
        return JSONResponse({"kind": req.kind})
    # Phase 2: route through scene-mcp generate_asset (moderation + audit + tenancy).
    return JSONResponse(
        {"error": "generate_not_wired", "detail": "real generation lands in Phase 2 via scene-mcp"},
        status_code=501,
    )
