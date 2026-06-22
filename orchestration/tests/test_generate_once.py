from __future__ import annotations

from variation.cost_estimate import estimate
from variation.engine import plan_generations, render_combinations
from variation.matrix import VariationMatrix


def test_generation_called_once_for_n_sizes_one_copy_background() -> None:
    matrix = VariationMatrix(
        sizes=[(1080, 1080), (1080, 1920), (1920, 1080)],
        durations=[6.0],
        copy_variants=["Summer sale"],
        backgrounds=["gradient-blue"],
    )

    keys = plan_generations(matrix)
    assert len(keys) == 1

    combos = render_combinations(matrix)
    assert len(combos) == 3
    assert all(combo[2] == keys[0] for combo in combos)


def test_estimate_shown_before_render_variant_fan_out() -> None:
    matrix = VariationMatrix(
        sizes=[(1080, 1080), (1080, 1920)],
        durations=[6.0, 15.0],
        copy_variants=["A", "B"],
        backgrounds=["bg1"],
    )

    est = estimate(matrix)
    assert est.generation_count == 2
    assert est.render_count == 8
    assert est.count == est.render_count
    assert est.cost_usd > 0
    assert est.eta_sec > 0

    generation_calls: list[str] = []
    render_calls: list[str] = []

    def generate_once(key_sig: str) -> None:
        generation_calls.append(key_sig)

    def render_variant(_combo: str) -> None:
        render_calls.append(_combo)

    for key in plan_generations(matrix):
        generate_once(str(key.signature()))

    assert len(generation_calls) == est.generation_count

    est_before_render = estimate(matrix)
    assert est_before_render.render_count == 8

    for combo in render_combinations(matrix):
        render_variant(str(combo))

    assert len(render_calls) == est_before_render.render_count


def test_estimate_precedes_render_fan_out() -> None:
    matrix = VariationMatrix(
        sizes=[(300, 250), (728, 90)],
        durations=[6.0],
        copy_variants=["Headline"],
    )
    est = estimate(matrix)
    renders = render_combinations(matrix)
    assert est.render_count == len(renders)
    assert est.generation_count == 1
