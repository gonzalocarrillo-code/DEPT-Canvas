"""Production-plan agent: emits the FRONTEND GraphPlan shape (master + production
nodes), distinct from the motion-intent AnimationPlan used by the authoring path.

The frontend (frontend/src/api/ai.ts) expects:
  { master: {title, prompt}, nodes: [{kind, title, prompt}], rationale?, estimatedCostUsd? }
with kind in image|copy|transcreate|resize|animate|video, at most 6 nodes.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

NodeKind = Literal["image", "copy", "transcreate", "resize", "animate", "video"]
ALLOWED_KINDS: tuple[str, ...] = ("image", "copy", "transcreate", "resize", "animate", "video")
MAX_NODES = 6


class PlanMaster(BaseModel):
    title: str
    prompt: str


class PlanNode(BaseModel):
    kind: NodeKind
    title: str
    prompt: str


class GraphPlan(BaseModel):
    master: PlanMaster
    nodes: List[PlanNode] = Field(default_factory=list)
    rationale: Optional[str] = None
    estimatedCostUsd: Optional[float] = None


def production_plan_system_prompt() -> str:
    return (
        "You are the planning agent for DEPT Canvas, an enterprise creative platform.\n"
        "Given a campaign brief, produce a plan for a node-based creative workflow.\n"
        'Return JSON: {"master":{"title","prompt"},"nodes":[{"kind","title","prompt"}],"rationale"}.\n'
        "- master is the hero keyframe concept.\n"
        f"- nodes are 3-6 downstream production steps; kind MUST be one of: {', '.join(ALLOWED_KINDS)}.\n"
        "- Titles under 6 words; prompts are actionable generation instructions.\n"
        "- Reflect the brand-safe, generate-once/render-many philosophy (transcreation, "
        "resizing, animation as variations of the master)."
    )


def build_production_planner():
    """Construct the production-plan Agent. Imported lazily so the FastAPI service
    can run in mock mode without the openai-agents SDK installed/configured."""
    from agents import Agent, AgentOutputSchema

    return Agent(
        name="ProductionPlanner",
        instructions=production_plan_system_prompt(),
        model="gpt-5.4-mini",
        output_type=AgentOutputSchema(GraphPlan, strict_json_schema=False),
    )


def clamp_plan(plan: GraphPlan) -> GraphPlan:
    """Enforce the contract: <=6 nodes, only allowed kinds (coerce unknown -> image)."""
    safe_nodes: list[PlanNode] = []
    for node in plan.nodes[:MAX_NODES]:
        kind = node.kind if node.kind in ALLOWED_KINDS else "image"
        safe_nodes.append(PlanNode(kind=kind, title=node.title, prompt=node.prompt))
    plan.nodes = safe_nodes
    return plan


def mock_graph_plan(brief: str) -> GraphPlan:
    """Deterministic plan for local/keyless runs — mirrors the dev gateway's shape."""
    summary = (brief or "New campaign").strip()
    return GraphPlan(
        master=PlanMaster(title="Master keyframe", prompt=summary),
        nodes=[
            PlanNode(kind="image", title="Hero background", prompt=f"On-brand hero background for: {summary}"),
            PlanNode(kind="copy", title="Headline", prompt=f"Punchy benefit-led headline for: {summary}"),
            PlanNode(kind="transcreate", title="Localize copy", prompt="Transcreate the headline per target locale"),
            PlanNode(kind="resize", title="Resize set", prompt="Resize the master to 1:1, 9:16 and 16:9"),
            PlanNode(kind="animate", title="Motion", prompt="Apply Tier-1 preset motion to the master"),
        ],
        rationale="Deterministic local plan (AI not configured).",
        estimatedCostUsd=round(0.04 * 6, 2),
    )
