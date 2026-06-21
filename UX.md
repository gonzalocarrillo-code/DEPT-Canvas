# docs/UX.md

The interface — the product's differentiator. Canva's approachability, After Effects' depth.

## Design thesis

Progressive disclosure. A clean, approachable surface that reveals timeline and motion depth only when needed. A first-timer never touches the timeline; a power user is one click from it. AI is a contextual panel, not a separate mode.

## Layout

- **Top bar**: project breadcrumb, save state, collaborators, preview, export, account avatar (profile, settings, log out).
- **Left icon rail**: layers, assets, brand kit, text, shapes, settings.
- **Left panel**: contextual to rail; defaults to layers with lock badges.
- **Center canvas**: the focus. Design/Animate toggle + format switcher (1:1, 9:16, 16:9, 4:5) above it.
- **Right panel**: contextual AI assist for the selected layer + that layer's properties.
- **Bottom timeline**: appears in Animate mode; per-layer tracks, preset In/Out/Loop bars, stagger handles, and a scrubber. (A full keyframe/speed-graph editor is a Tier 2 / Remotion feature — see docs/MOTION_ENGINE.md — not part of the CE.SDK Tier 1 build.)

## Key interactions

- **Design / Animate toggle** — the whole Canva↔AE synthesis in one control. Design hides the timeline; Animate reveals the per-layer timeline with preset motion and stagger controls (Tier 1). Full keyframe/speed-graph editing arrives only with the Tier 2 craft engine.
- **Contextual AI** — actions scoped to selection (background → replace background; text → copy variants). Locked layers grey their AI actions out — the UI teaches the locking model.
- **Two generation modes surfaced** — compose (prompt-only ideation) vs constrained (locked-fill production). See `docs/AGENTS.md`.
- **Simple / advanced generation controls** — simple = prompt + tone; advanced = guidance, character caps, negative keywords, reference/style pins.

## Screens to build

Editor; login/SSO; workspace dashboard (fast organisation, search); variation studio; batch review grid; template constraint/lock editor; user & role management; tenant settings; account/profile.

## Style rules

Sentence case everywhere. Two font weights. Flat surfaces, no gradients/shadows. Canvas is always primary; governance surfaces (auth, users, settings) are present but peripheral.

## Honest note

The Design/Animate progressive-disclosure model is a strong proposed resolution, not a tested one. Paper-prototype it with real creatives before committing heavy engineering.
