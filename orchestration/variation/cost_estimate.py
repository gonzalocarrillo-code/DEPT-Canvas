from __future__ import annotations

from pydantic import BaseModel

from variation.engine import plan_generations, render_combinations
from variation.matrix import VariationMatrix

GENERATION_COST_USD = 0.02
RENDER_COST_USD = 0.005


class CostEstimate(BaseModel):
    generation_count: int
    render_count: int
    count: int
    cost_usd: float
    eta_sec: float


def estimate(matrix: VariationMatrix) -> CostEstimate:
    generation_count = len(plan_generations(matrix))
    render_count = len(render_combinations(matrix))

    cost_usd = round(
        generation_count * GENERATION_COST_USD + render_count * RENDER_COST_USD,
        4,
    )
    eta_sec = float(generation_count * 8 + render_count * 3)

    return CostEstimate(
        generation_count=generation_count,
        render_count=render_count,
        count=render_count,
        cost_usd=cost_usd,
        eta_sec=eta_sec,
    )
