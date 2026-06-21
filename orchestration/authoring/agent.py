from __future__ import annotations

from agents import Agent

from common.mcp_client import authoring_system_prompt


def build_authoring(mcp_servers: list | None = None) -> Agent:
    return Agent(
        name="Authoring",
        instructions=authoring_system_prompt(),
        model="gpt-5.4-mini",
        mcp_servers=mcp_servers or [],
    )
