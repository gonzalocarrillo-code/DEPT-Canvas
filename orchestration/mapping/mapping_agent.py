"""Build-time mapping agent: classify CE.SDK animation types against creative intents."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml

from mapping.validate import (
    CAPABILITY_REPORT_PATH,
    INTENT_MAP_PATH,
    load_capability_report,
    validate_mapping,
)

MAPPING_DIR = Path(__file__).resolve().parent
HOUSE_STYLE_PATH = MAPPING_DIR / "house-style.yaml"

INTENTS = [
    "energetic_entrance",
    "subtle_emphasis",
    "hard_cut",
    "smooth_transition",
    "motion_blur_whoosh",
    "attention_loop",
    "exit",
]


def load_house_style(path: Path | None = None) -> dict[str, Any]:
    style_path = path or HOUSE_STYLE_PATH
    with style_path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def animation_properties(report: dict[str, Any], shorthand: str) -> set[str]:
    for anim in report["animationTypes"]:
        if anim["shorthand"] == shorthand:
            return {p["key"] for p in anim.get("properties", [])}
    raise KeyError(f"Animation shorthand '{shorthand}' not in capability report")


def build_params(
    report: dict[str, Any],
    shorthand: str,
    easing: str,
    duration_sec: float,
) -> dict[str, Any]:
    props = animation_properties(report, shorthand)
    params: dict[str, Any] = {}

    if "playback/duration" in props:
        params["playback/duration"] = duration_sec
    if "animationEasing" in props and easing in report.get("animationEasing", []):
        params["animationEasing"] = easing

    return params


def generate_intent_map(
    report: dict[str, Any] | None = None,
    house_style: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    report = report or load_capability_report()
    house_style = house_style or load_house_style()
    rules = house_style["intent_rules"]

    entries: list[dict[str, Any]] = []
    for intent in INTENTS:
        rule = rules[intent]
        shorthand = rule["animation_shorthand"]
        animation_type = f"//ly.img.ubq/animation/{shorthand}"
        params = build_params(
            report,
            shorthand,
            rule["easing"],
            rule["duration_sec"],
        )

        entry: dict[str, Any] = {
            "intent": intent,
            "animation_type": animation_type,
            "params": params,
            "confidence": rule.get("confidence", 0.8),
            "needs_review": rule.get("needs_review", False),
        }
        entries.append(entry)

    validate_mapping(entries, report)
    return entries


def write_intent_map(
    output_path: Path | None = None,
    report: dict[str, Any] | None = None,
) -> Path:
    out = output_path or INTENT_MAP_PATH
    entries = generate_intent_map(report=report)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2)
        f.write("\n")
    return out


def main() -> None:
    if not CAPABILITY_REPORT_PATH.is_file():
        raise FileNotFoundError(
            f"Missing capability report at {CAPABILITY_REPORT_PATH}. Run P0-T2 first."
        )
    path = write_intent_map()
    with path.open(encoding="utf-8") as f:
        count = len(json.load(f))
    print(f"Wrote {count} entries to {path}")


if __name__ == "__main__":
    main()
