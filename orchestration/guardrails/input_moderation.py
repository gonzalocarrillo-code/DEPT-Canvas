from __future__ import annotations

from typing import Any

from agents import Agent, input_guardrail
from agents.guardrail import GuardrailFunctionOutput


@input_guardrail
async def input_moderation(
    ctx: Any, agent: Agent, input: str | list[Any]
) -> GuardrailFunctionOutput:
    text = input if isinstance(input, str) else str(input)
    flagged = await _moderate_text(text)
    return GuardrailFunctionOutput(
        tripwire_triggered=flagged,
        output_info={"checkpoint": 1, "flagged": flagged},
    )


async def _moderate_text(text: str) -> bool:
    if "BLOCK_BRIEF" in text:
        return True

    import os

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return False

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)
    response = await client.moderations.create(
        model="omni-moderation-latest", input=text
    )
    result = response.results[0]
    return bool(getattr(result, "flagged", False))


def guarded_agent() -> Agent:
    from agents import Agent

    return Agent(
        name="GuardedPlanner",
        instructions="Test agent",
        model="gpt-5.4-mini",
        input_guardrails=[input_moderation],
    )


async def run_guarded(brief: str) -> None:
    from agents import Runner

    agent = guarded_agent()
    await Runner.run(agent, brief)
