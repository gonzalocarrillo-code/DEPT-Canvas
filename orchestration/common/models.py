from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class MotionIntent(BaseModel):
    intent: str
    block_role: str | None = None
    params: dict[str, str | float | int] = Field(default_factory=dict)


class AnimationPlan(BaseModel):
    brief_summary: str
    intents: list[MotionIntent]
    duration_sec: float = 6.0
    format: Literal["1080x1080", "1080x1920", "1920x1080"] = "1080x1080"


class LayerState(str, Enum):
    AI_VARIABLE = "ai_variable"
    FIXED = "fixed"
    BRAND_LOCKED = "brand_locked"


class VariationMatrix(BaseModel):
    sizes: list[tuple[int, int]]
    durations: list[float]
    copy_variants: list[str] = Field(default_factory=list)
    backgrounds: list[str] = Field(default_factory=list)
    layer_states: dict[int, LayerState] = Field(default_factory=dict)
