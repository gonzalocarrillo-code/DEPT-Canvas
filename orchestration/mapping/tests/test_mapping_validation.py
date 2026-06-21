"""Tests for mapping validation against capability-report.json."""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from mapping.mapping_agent import generate_intent_map
from mapping.validate import (
    MappingValidationError,
    load_capability_report,
    validate_mapping,
)

MAPPING_DIR = Path(__file__).resolve().parent.parent
INTENT_MAP_PATH = MAPPING_DIR / "intent_primitive_map.json"


@pytest.fixture(scope="module")
def capability_report() -> dict:
    return load_capability_report()


@pytest.fixture(scope="module")
def intent_map(capability_report: dict) -> list[dict]:
    return generate_intent_map(capability_report)


def test_every_animation_type_exists_in_capability_report(
    intent_map: list[dict], capability_report: dict
) -> None:
    known = {a["type"] for a in capability_report["animationTypes"]}
    for entry in intent_map:
        assert entry["animation_type"] in known


def test_every_param_key_exists_in_capability_report(
    intent_map: list[dict], capability_report: dict
) -> None:
    validate_mapping(intent_map, capability_report)


def test_injected_fake_animation_type_fails_build(
    intent_map: list[dict], capability_report: dict
) -> None:
    bad = copy.deepcopy(intent_map)
    bad[0]["animation_type"] = "//ly.img.ubq/animation/totally_fake"
    with pytest.raises(MappingValidationError, match="unknown animation_type"):
        validate_mapping(bad, capability_report)


def test_injected_fake_param_key_fails_build(
    intent_map: list[dict], capability_report: dict
) -> None:
    bad = copy.deepcopy(intent_map)
    bad[0]["params"]["fake/property/key"] = 1.0
    with pytest.raises(MappingValidationError, match="not in findAllProperties"):
        validate_mapping(bad, capability_report)


def test_committed_intent_map_validates(capability_report: dict) -> None:
    """Ensure the committed artifact stays in sync with the engine report."""
    if not INTENT_MAP_PATH.is_file():
        entries = generate_intent_map(capability_report)
        INTENT_MAP_PATH.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")
    with INTENT_MAP_PATH.open(encoding="utf-8") as f:
        committed = json.load(f)
    validate_mapping(committed, capability_report)
