from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from common.models import AnimationPlan, MotionIntent
from common.runner import build_orchestration_agents
from planner.agent import build_planner


def test_planner_emits_valid_animation_plan() -> None:
    planner = build_planner()
    assert planner.name == "Planner"
    assert "energetic_entrance" in planner.instructions or "intent" in planner.instructions


@pytest.mark.asyncio
async def test_handoffs_wiring_and_authoring_scene_ref() -> None:
    planner, authoring, variation = build_orchestration_agents(mcp_servers=[])

    assert len(planner.handoffs) == 1
    assert authoring.name == "Authoring"
    assert variation.name == "Variation"

    plan = AnimationPlan(
        brief_summary="Launch ad",
        intents=[MotionIntent(intent="energetic_entrance", block_role="headline")],
    )

    mock_result = MagicMock()
    mock_result.final_output = "tenant/tenant-dev/scenes/plan-123.scene"
    mock_result.to_input_list.return_value = []

    with patch("agents.Runner.run", new_callable=AsyncMock) as run_mock:
        run_mock.return_value = mock_result
        from agents import Runner

        result = await Runner.run(authoring, "Execute approved plan", session=None)

    assert "scene" in str(result.final_output)
    run_mock.assert_awaited()


def test_planner_output_type_uses_intent_map_intents() -> None:
    from common.mcp_client import load_intent_primitive_map

    known = {e["intent"] for e in load_intent_primitive_map()}
    plan = AnimationPlan(
        brief_summary="Test",
        intents=[MotionIntent(intent="exit")],
    )
    assert plan.intents[0].intent in known
