"""Validate intent_primitive_map.json against capability-report.json ground truth."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

MAPPING_DIR = Path(__file__).resolve().parent
REPO_ROOT = MAPPING_DIR.parent.parent
CAPABILITY_REPORT_PATH = (
    REPO_ROOT / "scene-mcp" / "src" / "engine" / "capability-report.json"
)
INTENT_MAP_PATH = MAPPING_DIR / "intent_primitive_map.json"


class MappingValidationError(Exception):
    """Raised when a mapping entry references a type or property not in the engine report."""


def load_capability_report(path: Path | None = None) -> dict[str, Any]:
    report_path = path or CAPABILITY_REPORT_PATH
    with report_path.open(encoding="utf-8") as f:
        return json.load(f)


def load_intent_map(path: Path | None = None) -> list[dict[str, Any]]:
    map_path = path or INTENT_MAP_PATH
    with map_path.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise MappingValidationError("intent_primitive_map.json must be a JSON array")
    return data


def build_property_index(report: dict[str, Any]) -> dict[str, set[str]]:
    index: dict[str, set[str]] = {}
    for anim in report.get("animationTypes", []):
        anim_type = anim["type"]
        keys = {prop["key"] for prop in anim.get("properties", [])}
        index[anim_type] = keys
    global_easing = set(report.get("animationEasing", []))
    index["__global_animationEasing__"] = global_easing
    return index


def validate_entry(
    entry: dict[str, Any],
    property_index: dict[str, set[str]],
    global_easing: set[str],
) -> None:
    intent = entry.get("intent", "<unknown>")
    animation_type = entry.get("animation_type")
    if not animation_type:
        raise MappingValidationError(f"Entry for intent '{intent}' missing animation_type")

    if animation_type not in property_index:
        raise MappingValidationError(
            f"Intent '{intent}' references unknown animation_type '{animation_type}'"
        )

    allowed_keys = property_index[animation_type]
    params = entry.get("params", {})
    if not isinstance(params, dict):
        raise MappingValidationError(f"Intent '{intent}' params must be an object")

    for key, value in params.items():
        if key not in allowed_keys:
            raise MappingValidationError(
                f"Intent '{intent}' param key '{key}' not in findAllProperties "
                f"for {animation_type}"
            )
        if key == "animationEasing" and value not in global_easing:
            raise MappingValidationError(
                f"Intent '{intent}' animationEasing '{value}' not in engine enum"
            )


def validate_mapping(
    entries: list[dict[str, Any]] | None = None,
    report: dict[str, Any] | None = None,
) -> None:
    """Validate all entries; raises MappingValidationError on first failure."""
    report = report or load_capability_report()
    entries = entries if entries is not None else load_intent_map()
    property_index = build_property_index(report)
    global_easing = property_index["__global_animationEasing__"]

    for entry in entries:
        validate_entry(entry, property_index, global_easing)


def main() -> None:
    validate_mapping()
    print(f"Validated {len(load_intent_map())} mapping entries against engine ground truth.")


if __name__ == "__main__":
    main()
