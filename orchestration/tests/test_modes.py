from __future__ import annotations

from common.modes import GenerationMode, allows_structural_authoring, lock_manifest_for_mode


def _locked_colour(manifest: dict) -> dict:
    for entry in manifest["frozen"]:
        for prop in entry["properties"]:
            if "color" in prop:
                return {"key": prop, "value": {"r": 1, "g": 0, "b": 0, "a": 1}}
    raise AssertionError("no colour lock in manifest")


def test_constrained_never_changes_locked() -> None:
    constrained_manifest = {
        "templateId": "master",
        "version": "1",
        "frozen": [
            {
                "selector": {"blockId": 42},
                "properties": ["fill/solid/color", "position/x"],
            }
        ],
    }
    manifest = lock_manifest_for_mode(
        GenerationMode.CONSTRAINED,
        constrained_manifest=constrained_manifest,
    )
    assert manifest is constrained_manifest

    locked = _locked_colour(manifest)
    batch_writes = [
        {"blockId": 42, "properties": [locked]},
        {"blockId": 42, "properties": [{"key": "position/x", "value": 999}]},
    ]

    for write in batch_writes:
        for prop in write["properties"]:
            assert any(
                prop["key"] in entry["properties"]
                for entry in manifest["frozen"]
            )

    unchanged = locked["value"]
    for write in batch_writes:
        for prop in write["properties"]:
            if prop["key"] == locked["key"]:
                assert prop["value"] == unchanged


def test_compose_has_structural_latitude() -> None:
    compose_manifest = None
    manifest = lock_manifest_for_mode(
        GenerationMode.COMPOSE,
        compose_manifest=compose_manifest,
        constrained_manifest={"templateId": "x", "version": "1", "frozen": []},
    )
    assert manifest is None
    assert allows_structural_authoring(GenerationMode.COMPOSE) is True
    assert allows_structural_authoring(GenerationMode.CONSTRAINED) is False
