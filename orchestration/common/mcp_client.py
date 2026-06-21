from __future__ import annotations

import json
import os
from pathlib import Path

INTENT_MAP_PATH = (
    Path(__file__).resolve().parent.parent / "mapping" / "intent_primitive_map.json"
)


def load_intent_primitive_map() -> list[dict]:
    with INTENT_MAP_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def planner_system_prompt() -> str:
    intents = load_intent_primitive_map()
    intent_names = sorted({entry["intent"] for entry in intents})
    return (
        "You are the DEPT Canvas planner. Output an AnimationPlan JSON using motion "
        f"intents only (no keyframes): {', '.join(intent_names)}. "
        "Tier 1 motion = CE.SDK preset composition."
    )


def authoring_system_prompt() -> str:
    return (
        "You are the DEPT Canvas authoring agent. Build editable scenes via MCP tools "
        "(create_scene, create_block, set_properties, save_scene). Never request "
        "set_keyframe or add_animation — they do not exist on Tier 1."
    )


def variation_system_prompt() -> str:
    return (
        "You are the DEPT Canvas variation agent. Fan approved masters across sizes "
        "and copy using generate-once/render-many discipline."
    )


def mcp_url() -> str:
    return os.environ.get("SCENE_MCP_URL", "http://127.0.0.1:3100/mcp")


def dev_bearer_token(
    *,
    tenant_id: str = "tenant-dev",
    user_id: str = "orchestration-dev",
    role: str = "creator",
) -> str:
    import base64

    payload = json.dumps(
        {"sub": user_id, "tenant_id": tenant_id, "role": role},
        separators=(",", ":"),
    )
    encoded = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    return f"dev:{encoded}"
