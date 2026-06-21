# docs/MAPPING_AGENT.md

How the intent-to-primitive mapping is built and kept current. The mapping is a **generated, validated artifact**, never hand-authored.

## Why

The model already knows what a bounce or transition is (conceptual knowledge — do not train it). It does not reliably know how that maps to *this* CE.SDK version's API (procedural knowledge — read it). The mapping agent bridges the two and refreshes when the SDK changes.

## Inputs → output

**Inputs**
- `findAllProperties()` output from the running engine (ground truth for types + property keys)
- IMG.LY docs (via their docs MCP) for human-readable descriptions
- The house-style rule sheet (`house-style.yaml`) — easing defaults, stagger timing, duration ranges, never-do rules

**Output**: `intent_primitive_map.json`

## What the agent does

It **classifies existing, named CE.SDK animation/blur types against creative intents** and assigns sane default parameters. It does not invent primitives and does not author raw keyframes.

Creative intents (starter set): `energetic_entrance`, `subtle_emphasis`, `hard_cut`, `smooth_transition`, `motion_blur_whoosh`, `attention_loop`, `exit`.

Each map entry:
```json
{
  "intent": "energetic_entrance",
  "animation_type": "//ly.img.ubq/animation/pop",
  "params": { "duration": 0.6, "easing": "ease-out-back" },
  "confidence": 0.9,
  "needs_review": false
}
```

## Validation (build-fails on mismatch)

- Every `animation_type` and every property key in `params` is checked against the engine's `findAllProperties()` output.
- A hallucinated type or property **fails the build**. The mapping never ships unvalidated.

## Refresh on SDK update

When CE.SDK bumps version, **re-run the agent**. It slots new types against existing intents and flags genuinely new intents (`needs_review: true`) for a human. Nothing is edited by hand.

## What stays human-owned

Two small artifacts:
1. `house-style.yaml` — the designers' taste. Claude drafts a first version; designers ratify it.
2. `golden-set.json` — ~12 briefs with expected primitive choices, to catch regressions when the SDK or a prompt changes.

## The agent in context

This is a **build-time** agent — a fourth agent alongside the runtime planner/authoring/variation agents. It runs in CI on SDK updates, not per user request.
