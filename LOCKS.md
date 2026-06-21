# docs/LOCKS.md

How brand-critical properties are protected. This is the platform's primary brand-safety guarantee.

## The principle

Once a property is locked, it is no longer a generative decision — it is a deterministic constraint enforced in code. The AI cannot move a locked logo because writing to that property **is not a capability the system has** at that point. The guarantee comes from the tool layer refusing the call, never from asking the model to behave.

## Three layer states

| State | Controlled by | Example |
|---|---|---|
| Brand-locked | Code — immutable | Logo position/asset, CTA placement/colour, palette, safe zones |
| Fixed | Author — set once, not varied | A chosen hero product shot |
| AI-variable | AI — within constraints | Headline copy, generated background |

## The lock manifest

A per-template record of which properties are frozen. `apply_lock_manifest` loads it into the job. Every property-writing tool (`set_properties`) and every `MotionEngine` operation (`applyIntent`, `stagger`, `setTiming`, `sequence`) consults it.

## Enforcement rules

1. A write to a frozen property **hard-fails** with a clear error. It does not silently no-op.
2. The rejection is **written to the audit log** (tenant, tool, property, attempted value).
3. Enforcement is identical across static properties and all `MotionEngine` operations — a preset, stagger, or sequence that would move a locked property is checked the same way.
4. Both generation modes (compose and constrained) are bound by the manifest; they differ only in how many properties are locked.

## Required tests

- Moving a locked logo is refused at the tool layer.
- Changing a locked brand colour is refused.
- A motion intent or stagger that would move a locked position is refused.
- Constrained mode never alters any locked property across a full variation batch.
- Every refusal produces an audit record.

## Why it matters

A brand manager signs off once on the master and the locks. From then on, every variation is on-brand *by construction* — not by review of each output. Review still exists (the human approval gate), but it is a safety net, not the mechanism.
