# docs/ANIMATION.md

How DEPT Canvas authors motion. **Read this carefully — an earlier draft overstated CE.SDK's capabilities. This is the corrected, honest model.**

## The ground truth (verified against CE.SDK docs)

CE.SDK is a **preset-based animation engine, not a keyframe system.** Confirmed against the live docs:

- Animations are attached to a block as **In / Out / Loop presets** (`setInAnimation`, `setOutAnimation`, `setLoopAnimation`), each with a fixed set of tunable properties (direction, duration, intensity).
- **Easing is an enum** — `Linear`, `EaseIn`, `EaseOut`, `EaseInOut` (via `setEnum` on `animationEasing`). There is **no custom cubic-bezier** and **no per-keyframe easing**.
- There are **no arbitrary multi-keyframe property tracks** (you cannot keyframe position at frames 0/30/90/120 with independent values).
- There is **no group/composition animation in video mode** and **no first-class transition primitive** between scenes.

IMG.LY's marketing uses the word "keyframes," but in their vocabulary that means the preset-animation timeline, not After Effects-style property keyframing. Do not build toward a keyframe API on CE.SDK — it does not exist.

## Two-tier motion strategy

The product needs both scaled ad creative and bespoke craft. These have different motion needs and use **different engines behind the same interface.**

### Tier 1 — Scale (CE.SDK) — BUILD NOW
- Motion = **composition of CE.SDK presets**. The motion-primitives library combines In/Out/Loop presets, staggers (via time offsets), and the four easing enums to approximate richer motion.
- Every produced motion is labeled `native` (a single preset) or `composed` (presets combined to approximate an intent).
- This is the right model for high-volume, on-brand variation: the preset ceiling is a **guardrail** that keeps thousands of AI variants reliable and on-brand, and CE.SDK's flat license has no per-render fee.
- The AI **composes from the preset vocabulary** (see `docs/MAPPING_AGENT.md`).

### Tier 2 — Craft (Remotion) — DEFERRED, validated, do NOT build yet
- Remotion gives true keyframe + cubic-bezier + spring motion (verified). It is the validated answer for bespoke craft.
- **Do not build it now.** It is gated behind a trigger condition (see `docs/MOTION_ENGINE.md`).
- When built, it sits behind the **same MCP motion interface** as CE.SDK, so the scale tier is untouched.

## What the AI can and cannot do on Tier 1

CAN: pick a preset intent and parameterise it; stagger layers via time offsets; choose one of four easings; combine presets into a `composed` result; sequence In/Out across a timeline.

CANNOT (on CE.SDK): author arbitrary keyframe tracks, define custom speed curves, animate nested groups as a unit, or place true scene transitions. If a brief needs these, it is a **Tier 2 (Remotion) candidate** — flag it, do not fake it on CE.SDK.

## The motion interface (critical for the future swap)

All motion authoring goes through a single set of MCP tools (`docs/MOTION_ENGINE.md` defines the contract). On Tier 1 these are backed by CE.SDK preset-composition. The interface is engine-agnostic so Tier 2 (Remotion) can back the *same* tools later. **Never let CE.SDK-specific assumptions leak above this interface.**

## Hard rules

- **Read engine truth, never hardcode.** Use `query_animatable` / `findAllProperties()` from the running engine for available presets, properties, and easings. Do not write preset/property strings from memory.
- **Label native vs composed.** Every motion result records which it is, for transparency and for spotting Tier 2 candidates.
- **Lock enforcement is identical.** Any preset, stagger, or composed motion that would move a locked property is hard-rejected and audited. See `docs/LOCKS.md`.
- **Stagger by default** per the house-style rule sheet.

## What Phase 0 already established

The four original capability questions are **answered: refuted as native** on CE.SDK (no multi-keyframe, no custom bezier, no group animation, no transition primitive). That investigation is closed. The conclusion is the two-tier strategy above — not a workaround to make CE.SDK do keyframes.
