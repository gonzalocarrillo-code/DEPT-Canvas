import { describe, expect, it, afterEach } from "vitest";
import request from "supertest";
import { createSceneMcpApp } from "../src/index.js";

function parseSseJson(text: string): unknown {
  for (const line of text.split("\n")) {
    if (line.startsWith("data: ")) {
      return JSON.parse(line.slice(6));
    }
  }
  return undefined;
}

describe("Streamable HTTP transport", () => {
  const { app, sessions } = createSceneMcpApp();
  let sessionId: string | undefined;

  afterEach(async () => {
    if (sessionId) {
      await sessions.closeSession(sessionId);
      sessionId = undefined;
    }
  });

  it("initialize returns a session id", async () => {
    const initRes = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "test", version: "0.0.0" },
        },
      });

    expect(initRes.status).toBeLessThan(500);
    sessionId = initRes.headers["mcp-session-id"] as string | undefined;
    expect(sessionId).toBeTruthy();
    expect(sessions.has(sessionId!)).toBe(true);
  });

  it("tools/list with Mcp-Session-Id succeeds after initialize", async () => {
    const initRes = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "test", version: "0.0.0" },
        },
      });

    sessionId = initRes.headers["mcp-session-id"] as string;

    const listRes = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Mcp-Session-Id", sessionId)
      .send({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      });

    expect(listRes.status).toBeLessThan(500);
    const payload = listRes.body?.result
      ? listRes.body
      : (parseSseJson(listRes.text) as { result?: { tools?: unknown[] } });
    expect(payload?.result?.tools).toBeDefined();
  });

  it("DELETE ends the session", async () => {
    const initRes = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "test", version: "0.0.0" },
        },
      });

    sessionId = initRes.headers["mcp-session-id"] as string;
    expect(sessions.has(sessionId)).toBe(true);

    const deleteRes = await request(app)
      .delete("/mcp")
      .set("Mcp-Session-Id", sessionId);

    expect(deleteRes.status).toBeLessThan(500);
    expect(sessions.has(sessionId)).toBe(false);
    sessionId = undefined;
  });
});
