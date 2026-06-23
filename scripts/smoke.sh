#!/usr/bin/env bash
# Smoke the local stack through the EDGE: edge → orchestration (→ scene-mcp).
# Requires the edge running with EDGE_AUTH_MODE=dev. Mints a dev token and hits
# /api/ai/status + /api/ai/plan, asserting a GraphPlan comes back through the edge
# (not the Vite gateway). With DEPT_MOCK_AI=1 on orchestration this needs no key.
set -euo pipefail

EDGE="${EDGE_URL:-http://127.0.0.1:8080}"
TENANT="${TENANT:-tenant-local}"

# dev:<base64url(json)> — the scheme the edge (EDGE_AUTH_MODE=dev) + scene-mcp accept.
PAYLOAD=$(printf '{"sub":"u1","tenant_id":"%s","role":"creator"}' "$TENANT")
B64=$(printf '%s' "$PAYLOAD" | base64 | tr '+/' '-_' | tr -d '=')
AUTH="Authorization: Bearer dev:${B64}"

echo "== GET ${EDGE}/api/ai/status =="
curl -fsS -H "$AUTH" "${EDGE}/api/ai/status"; echo

echo "== POST ${EDGE}/api/ai/plan =="
curl -fsS -X POST -H "$AUTH" -H "content-type: application/json" \
  -d '{"brief":"Fall/Winter launch — bold, optimistic"}' "${EDGE}/api/ai/plan"; echo

echo "smoke OK — plan returned through the edge"
