# MotionEngine (Tier 1)

All motion authoring flows through the engine-agnostic `MotionEngine` interface in
`motion-engine.ts`. Tier 1 is backed by `CesdkMotionEngine` (CE.SDK preset composition).

- MCP tools import `getMotionEngine()` only — never `@cesdk/node` or `CesdkMotionEngine`.
- Over-capability requests return a `tier2Candidate` signal; the metric increments in `tier2-metric.ts`.
- Every motion write routes through the lock choke point in `../locks/enforce.ts`.
