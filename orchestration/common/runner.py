from __future__ import annotations

from agents import Agent, handoff

from common.mcp_client import (
    authoring_system_prompt,
    planner_system_prompt,
    variation_system_prompt,
)
from common.models import AnimationPlan
from planner.agent import build_planner


def build_authoring(mcp_servers: list | None = None) -> Agent:
    from authoring.agent import build_authoring as _build

    return _build(mcp_servers)


def build_variation(mcp_servers: list | None = None) -> Agent:
    from variation.agent import build_variation as _build

    return _build(mcp_servers)


def build_orchestration_agents(mcp_servers: list | None = None) -> tuple[Agent, Agent, Agent]:
    planner = build_planner()
    authoring = build_authoring(mcp_servers)
    variation = build_variation(mcp_servers)
    planner.handoffs = [handoff(authoring)]
    authoring.handoffs = [handoff(variation)]
    return planner, authoring, variation
