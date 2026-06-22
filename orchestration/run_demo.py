#!/usr/bin/env python3
"""Local end-to-end demo: planner → auto-approve → authoring over Streamable HTTP MCP."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from agents import Runner, trace
from agents.tracing import set_tracing_disabled, set_tracing_export_api_key

from authoring.agent import build_authoring
from common.mcp_client import build_scene_mcp_server
from common.models import AnimationPlan
from common.modes import GenerationMode
from planner.agent import build_planner


def _load_repo_env() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    env_path = repo_root / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def _format_tool_calls(new_items: list) -> list[dict[str, object]]:
    calls: list[dict[str, object]] = []
    for item in new_items:
        item_type = getattr(item, "type", None)
        if item_type == "tool_call_item":
            raw = getattr(item, "raw_item", None)
            calls.append(
                {
                    "type": item_type,
                    "name": getattr(raw, "name", None) if raw else None,
                    "arguments": getattr(raw, "arguments", None) if raw else None,
                }
            )
        elif item_type == "tool_call_output_item":
            raw = getattr(item, "raw_item", None)
            output = getattr(raw, "output", None) if raw else None
            calls.append({"type": item_type, "output": output})
    return calls


def _extract_scene_ref(final_output: object, tool_calls: list[dict[str, object]]) -> str | None:
    if isinstance(final_output, str) and "tenant/" in final_output and ".scene" in final_output:
        return final_output.strip()

    for entry in reversed(tool_calls):
        if entry.get("type") != "tool_call_output_item":
            continue
        output = entry.get("output")
        if isinstance(output, str):
            try:
                payload = json.loads(output)
            except json.JSONDecodeError:
                payload = None
            if isinstance(payload, dict) and "sceneRef" in payload:
                return str(payload["sceneRef"])
        if isinstance(output, dict) and "sceneRef" in output:
            return str(output["sceneRef"])

    return None


async def run_demo(*, brief: str, tenant_id: str, mode: GenerationMode) -> int:
    if not os.getenv("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is required", file=sys.stderr)
        return 1

    set_tracing_disabled(False)
    if api_key := os.getenv("OPENAI_API_KEY"):
        set_tracing_export_api_key(api_key)

    scene_mcp = build_scene_mcp_server(tenant_id=tenant_id)
    planner = build_planner()
    authoring = build_authoring(mcp_servers=[scene_mcp])

    mode_note = (
        "Compose mode: invent layout and motion freely within the brand kit."
        if mode is GenerationMode.COMPOSE
        else "Constrained mode: fill only unlocked slots from the approved master."
    )

    async with scene_mcp:
        with trace(
            "local_runtime_demo",
            metadata={"tenant_id": tenant_id, "mode": mode.value},
        ) as demo_trace:
            print(f"trace_id={demo_trace.trace_id}")

            plan_result = await Runner.run(
                planner,
                f"{brief}\n\n{mode_note}",
                max_turns=8,
            )
            plan = plan_result.final_output
            if not isinstance(plan, AnimationPlan):
                print("Planner did not return AnimationPlan", file=sys.stderr)
                return 1

            print("\n=== AnimationPlan ===")
            print(plan.model_dump_json(indent=2))

            approved_input = (
                "Human approved the plan. Execute it via MCP tools and call save_scene.\n"
                f"{plan.model_dump_json()}"
            )

            auth_result = await Runner.run(
                authoring,
                approved_input,
                max_turns=25,
            )

            tool_calls = _format_tool_calls(auth_result.new_items)
            scene_ref = _extract_scene_ref(auth_result.final_output, tool_calls)

            print("\n=== MCP tool calls ===")
            print(json.dumps(tool_calls, indent=2, default=str))

            print("\n=== Authoring output ===")
            print(auth_result.final_output)

            print("\n=== sceneRef ===")
            print(scene_ref or "(not found)")

            local_root = Path(
                os.environ.get("SCENE_STORAGE_LOCAL_DIR", ".local-storage"),
            )
            if scene_ref:
                scene_id = scene_ref.rsplit("/", 1)[-1].replace(".scene", "")
                disk_path = local_root / tenant_id / f"{scene_id}.scene"
                print("\n=== persisted path ===")
                print(disk_path.resolve())
                if disk_path.is_file():
                    print(f"bytes={disk_path.stat().st_size}")
                else:
                    print("(file not found on disk — is scene-mcp running with local storage?)")

    return 0


def main() -> None:
    _load_repo_env()

    parser = argparse.ArgumentParser(description="Run local planner → authoring demo")
    parser.add_argument("--brief", required=True, help="Creative brief for the planner")
    parser.add_argument(
        "--tenant",
        default=os.environ.get("DEMO_TENANT_ID", "tenant-dev"),
        help="Tenant id embedded in the dev bearer token",
    )
    parser.add_argument(
        "--mode",
        choices=[m.value for m in GenerationMode],
        default=GenerationMode.COMPOSE.value,
        help="Generation mode (compose | constrained)",
    )
    args = parser.parse_args()

    exit_code = asyncio.run(
        run_demo(
            brief=args.brief,
            tenant_id=args.tenant,
            mode=GenerationMode(args.mode),
        )
    )
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
