from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from agents.exceptions import InputGuardrailTripwireTriggered

from guardrails.input_moderation import run_guarded


@pytest.mark.asyncio
async def test_unsafe_brief_raises_tripwire_and_skips_runner_generation() -> None:
    with pytest.raises(InputGuardrailTripwireTriggered):
        await run_guarded("BLOCK_BRIEF: violent content")


@pytest.mark.asyncio
async def test_clean_brief_passes_guardrail() -> None:
    with patch("agents.Runner.run", new_callable=AsyncMock) as run_mock:
        run_mock.return_value = AsyncMock(final_output="ok")
        await run_guarded("On-brand product launch with logo lock")
        run_mock.assert_awaited_once()
