from __future__ import annotations

from variation.matrix import GenerationKey, VariationMatrix


def plan_generations(matrix: VariationMatrix) -> list[GenerationKey]:
    """Dedupe variable content to unique copy/background combinations."""
    copies = matrix.copy_variants or [None]
    backgrounds = matrix.backgrounds or [None]

    seen: set[tuple[str | None, str | None]] = set()
    keys: list[GenerationKey] = []

    for copy in copies:
        for background in backgrounds:
            key = GenerationKey(copy_text=copy, background=background)
            sig = key.signature()
            if sig in seen:
                continue
            seen.add(sig)
            keys.append(key)

    return keys


def render_combinations(matrix: VariationMatrix) -> list[tuple[tuple[int, int], float, GenerationKey]]:
    """Every size × duration × unique generation key (generate-once/render-many)."""
    keys = plan_generations(matrix)
    combos: list[tuple[tuple[int, int], float, GenerationKey]] = []
    for size in matrix.sizes:
        for duration in matrix.durations:
            for key in keys:
                combos.append((size, duration, key))
    return combos
