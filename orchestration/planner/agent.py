from __future__ import annotations

from agents import Agent

from common.mcp_client import planner_system_prompt
from common.models import AnimationPlan


def build_planner() -> Agent:
    return Agent(
        name="Planner",
        instructions=planner_system_prompt(),
        model="gpt-5.4-mini",
        output_type=AnimationPlan,
    )
