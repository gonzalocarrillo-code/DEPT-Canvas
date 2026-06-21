#!/usr/bin/env bash
# P0-T4 acceptance: documents native vs container MP4 path on pinned @cesdk/node version.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
bash "$ROOT/renderer/spike/run.sh"

echo ""
echo "Recommendation: MP4 via CE.SDK Renderer container; stills/PDF via @cesdk/node CPU path."
echo "See renderer/spike/render-spike.md for full findings."
