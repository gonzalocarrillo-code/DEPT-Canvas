from __future__ import annotations

from pydantic import BaseModel, Field


class GenerationKey(BaseModel):
    model_config = {"protected_namespaces": ()}

    copy_text: str | None = None
    background: str | None = None

    def signature(self) -> tuple[str | None, str | None]:
        return (self.copy_text, self.background)


class VariationMatrix(BaseModel):
    sizes: list[tuple[int, int]]
    durations: list[float]
    copy_variants: list[str] = Field(default_factory=list)
    backgrounds: list[str] = Field(default_factory=list)
    layer_states: dict[int, str] = Field(default_factory=dict)
