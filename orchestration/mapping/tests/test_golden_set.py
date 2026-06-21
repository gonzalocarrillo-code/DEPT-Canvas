"""Golden-set regression tests for intent → primitive mapping."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from mapping.mapping_agent import generate_intent_map
from mapping.validate import load_capability_report

MAPPING_DIR = Path(__file__).resolve().parent.parent
GOLDEN_SET_PATH = MAPPING_DIR / "golden-set.json"


@pytest.fixture(scope="module")
def intent_by_name() -> dict[str, dict]:
    report = load_capability_report()
    entries = generate_intent_map(report)
    return {e["intent"]: e for e in entries}


@pytest.fixture(scope="module")
def golden_briefs() -> list[dict]:
    with GOLDEN_SET_PATH.open(encoding="utf-8") as f:
        data = json.load(f)
    return data["briefs"]


@pytest.mark.parametrize("brief_id", [b["id"] for b in json.loads(GOLDEN_SET_PATH.read_text())["briefs"]])
def test_golden_brief_maps_to_expected_primitive(
    brief_id: str, golden_briefs: list[dict], intent_by_name: dict[str, dict]
) -> None:
    brief = next(b for b in golden_briefs if b["id"] == brief_id)
    for intent in brief["expected_intents"]:
        mapping = intent_by_name[intent]
        assert mapping["animation_type"] == brief["expected_animation"], (
            f"Brief '{brief_id}' expected {brief['expected_animation']} "
            f"for intent '{intent}', got {mapping['animation_type']}"
        )
