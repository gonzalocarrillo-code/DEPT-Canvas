# P0-T4 Render-path spike findings

**Date:** 2026-06-21  
**CE.SDK version:** `@cesdk/node` **v1.76.1**  
**Question (IMPLEMENTATION_PLAN §B.2):** Does `engine.block.exportVideo()` encode MP4 in Node, or must video route through the CE.SDK Renderer container?

## Decision

**MP4 must route through the CE.SDK Renderer container.** Native `exportVideo()` in `@cesdk/node` is **not supported**.

## Empirical evidence

Running `renderer/spike/native-export.ts` against v1.76.1 (evaluation license):

```
Error: Exporting video is currently not supported on Node.JS
```

The API surface exists in `index.d.ts` (`exportVideo`, `VideoExportOptions`, H.264 profile/level/bitrate options), but the Node/WASM runtime rejects video encode at call time.

Still export (PNG/PDF) **does work** in Node — confirmed in P0-T2 authoring spike.

## Recommended architecture

| Format | Path | Infra |
|--------|------|-------|
| PNG / JPEG / PDF | `@cesdk/node` in `scene-mcp` / CPU Cloud Run | CPU-only, no GPU |
| MP4 (H.264) | CE.SDK Renderer container (`docker.io/imgly/cesdk-renderer:<version>`) | GPU (NVIDIA/EGL) — Cloud Run GPU for moderate volume, GKE for batch scale |

```bash
docker run --runtime=nvidia --gpus all \
  -e CESDK_LICENSE="$CESDK_LICENSE" \
  -v "$PWD/out:/output" \
  docker.io/imgly/cesdk-renderer:1.76.1 \
  --input sample.scene --output /output/render.mp4
```

## GPU placement (GCP)

- **Cloud Run GPU** — suitable for on-demand / moderate batch render jobs per tenant (simpler ops, per GCP.md workload shapes).
- **GKE + GPU node pool** — escalate when batch fan-out exceeds Cloud Run GPU concurrency/cost thresholds (variation engine P2-T4).

## Files in this spike

| File | Purpose |
|------|---------|
| `native-export.ts` | Attempts in-Node `exportVideo()`; records success/failure JSON |
| `sample.scene` | 2 s video-mode scene with fade In animation (committed fixture) |
| `run.sh` | Runs native attempt + optional container render |
| `render-spike.smoke.sh` | Acceptance script — asserts native rejection; ffprobe H.264 when container output exists |

## P2-T4 implication

`MotionEngine.render(..., 'mp4')` and `render_variant` enqueue to the **renderer worker** using the CE.SDK Renderer container, not `@cesdk/node` `exportVideo()`.
