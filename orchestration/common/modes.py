from __future__ import annotations

from enum import Enum


class GenerationMode(str, Enum):
    COMPOSE = "compose"
    CONSTRAINED = "constrained"


def lock_manifest_for_mode(
    mode: GenerationMode,
    *,
    compose_manifest: dict | None = None,
    constrained_manifest: dict,
) -> dict | None:
    """Select lock manifest by mode — same pipeline, different locks only."""
    if mode is GenerationMode.COMPOSE:
        return compose_manifest
    return constrained_manifest


def allows_structural_authoring(mode: GenerationMode) -> bool:
    return mode is GenerationMode.COMPOSE
