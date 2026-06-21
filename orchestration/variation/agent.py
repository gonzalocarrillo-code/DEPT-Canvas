from __future__ import annotations

from agents import Agent

from common.mcp_client import variation_system_prompt


def build_variation(mcp_servers: list | None = None) -> Agent:
    return Agent(
        name="Variation",
        instructions=variation_system_prompt(),
        model="gpt-5.4-mini",
        mcp_servers=mcp_servers or [],
    )
