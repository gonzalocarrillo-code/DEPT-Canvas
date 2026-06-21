#!/usr/bin/env bash
# Run the render-path spike: native export attempt + optional CE.SDK Renderer container.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SPIKE="$ROOT/renderer/spike"
OUT="$ROOT/out/render-spike"
CESDK_VERSION="${CESDK_NODE_VERSION:-1.76.1}"

mkdir -p "$OUT"

echo "=== P0-T4 render spike (@cesdk/node v${CESDK_VERSION}) ==="

echo "--- Native exportVideo() in Node ---"
cd "$ROOT/renderer"
NATIVE_JSON="$(pnpm exec tsx spike/native-export.ts 2>/dev/null || true)"
echo "$NATIVE_JSON"

echo "$NATIVE_JSON" > "$OUT/native-result.json"

if echo "$NATIVE_JSON" | grep -q '"success": true'; then
  echo "Native export unexpectedly succeeded — update render-spike.md"
  exit 0
fi

if ! echo "$NATIVE_JSON" | grep -qi "not supported on Node"; then
  echo "FAIL: expected Node exportVideo rejection message"
  exit 1
fi

echo "Native path rejected as expected."

if [[ "${SKIP_RENDERER_CONTAINER:-}" == "1" ]]; then
  echo "SKIP_RENDERER_CONTAINER=1 — container path not attempted."
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not available — container path documented but not exercised."
  exit 0
fi

if [[ -z "${CESDK_LICENSE:-}" ]]; then
  echo "CESDK_LICENSE unset — container path documented but not exercised."
  exit 0
fi

IMAGE="docker.io/imgly/cesdk-renderer:${CESDK_VERSION}"
echo "--- CE.SDK Renderer container (${IMAGE}) ---"

docker run --rm \
  -e "CESDK_LICENSE=${CESDK_LICENSE}" \
  -v "$SPIKE/sample.scene:/input.scene:ro" \
  -v "$OUT:/output" \
  "$IMAGE" \
  --input /input.scene --output /output/container-render.mp4 \
  || {
    echo "Container render failed (GPU/licensing may be required). Native rejection still confirmed."
    exit 0
  }

MP4="$OUT/container-render.mp4"
if [[ ! -s "$MP4" ]]; then
  echo "Container produced no MP4 bytes."
  exit 1
fi

if command -v ffprobe >/dev/null 2>&1; then
  CODEC="$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$MP4")"
  echo "ffprobe codec: $CODEC"
  if [[ "$CODEC" != "h264" ]]; then
    echo "FAIL: expected H.264 video stream"
    exit 1
  fi
else
  echo "ffprobe not installed — MP4 size check only ($(wc -c < "$MP4") bytes)."
fi

echo "Container MP4 render OK."
