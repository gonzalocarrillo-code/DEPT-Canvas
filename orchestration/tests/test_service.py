"""Mock-mode tests for the orchestration HTTP service (no OpenAI key required)."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from planner.production_plan import ALLOWED_KINDS, MAX_NODES
from service.app import app


@pytest.fixture(autouse=True)
def force_mock_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEPT_MOCK_AI", "1")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def test_health(client: TestClient) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["ok"] is True


def test_status_reports_not_configured_in_mock(client: TestClient) -> None:
    res = client.get("/status")
    assert res.status_code == 200
    body = res.json()
    assert body["configured"] is False
    assert body["planModel"]


def test_plan_returns_graphplan_contract(client: TestClient) -> None:
    res = client.post("/plan", json={"brief": "Fall launch — bold, optimistic"})
    assert res.status_code == 200
    plan = res.json()
    # frontend GraphPlan contract
    assert set(plan["master"].keys()) >= {"title", "prompt"}
    assert isinstance(plan["nodes"], list)
    assert 0 < len(plan["nodes"]) <= MAX_NODES
    for node in plan["nodes"]:
        assert node["kind"] in ALLOWED_KINDS
        assert node["title"] and node["prompt"]


def test_generate_copy_is_simulated_in_mock(client: TestClient) -> None:
    res = client.post("/generate", json={"kind": "copy", "prompt": "summer energy"})
    assert res.status_code == 200
    body = res.json()
    assert body["kind"] == "copy"
    assert "text" in body


def test_generate_image_has_no_bytes_in_mock(client: TestClient) -> None:
    res = client.post("/generate", json={"kind": "image", "prompt": "penguins"})
    assert res.status_code == 200
    body = res.json()
    assert body["kind"] == "image"
    assert "dataUrl" not in body


def test_get_scene_mock(client: TestClient) -> None:
    res = client.get("/scenes/scene-1", headers={"x-tenant-id": "tenant-a"})
    assert res.status_code == 200
    assert res.json()["sceneId"] == "scene-1"


def test_import_psd_mock_returns_sceneref(client: TestClient) -> None:
    res = client.post("/import/psd", headers={"x-tenant-id": "tenant-a"}, json={"psd": "AAAA"})
    assert res.status_code == 200
    assert res.json()["sceneRef"].startswith("tenant/tenant-a/scenes/")


def test_save_scene_acknowledges_with_lock_provenance(client: TestClient) -> None:
    res = client.post(
        "/scenes/scene-1/save",
        headers={"x-tenant-id": "tenant-a"},
        json={"layers": [], "keyframes": {}},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["sceneId"] == "scene-1"
    # lock enforcement is owned by scene-mcp set_properties, not faked here
    assert body["locksEnforcedBy"] == "scene-mcp set_properties"
