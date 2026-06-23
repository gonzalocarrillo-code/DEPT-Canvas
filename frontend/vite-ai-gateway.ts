import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

// ── Local AI gateway (DEV ONLY) ─────────────────────────────────────────────
// Runs inside the Vite dev server (Node), reads OPENAI_API_KEY server-side (never
// exposed to the browser), and calls OpenAI for the planner + asset generation.
// In production the same frontend endpoints route through the edge → OpenAI Agents
// → scene-MCP (where locks / safety / audit / tenancy apply). This dev bridge is the
// fast local path so the app works with the key you already have.

interface GatewayEnv {
  apiKey?: string;
  planModel: string;
  imageModel: string;
  textModel: string;
}

const ALLOWED_KINDS = ["image", "copy", "transcreate", "resize", "animate", "video"];

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const PLAN_SYSTEM = `You are the planning agent for DEPT Canvas, an enterprise creative platform.
Given a campaign brief, produce a concise plan for a node-based creative workflow.
Return ONLY JSON of shape:
{"master":{"title":string,"prompt":string},"nodes":[{"kind":string,"title":string,"prompt":string}],"rationale":string}
- "master" is the hero keyframe concept.
- "nodes" are 3-6 downstream production steps. Each "kind" MUST be one of: image, copy, transcreate, resize, animate, video.
- Keep titles under 6 words. Prompts are actionable generation instructions.
- Reflect the brand-safe, generate-once/render-many philosophy (transcreation, resizing, animation as variations of the master).`;

async function openaiChat(
  env: GatewayEnv,
  model: string,
  system: string,
  user: string,
  jsonMode: boolean,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.8,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

async function plan(env: GatewayEnv, brief: string) {
  const content = await openaiChat(env, env.planModel, PLAN_SYSTEM, brief, true);
  let parsed: { master?: unknown; nodes?: unknown; rationale?: unknown } = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }
  const master =
    parsed.master && typeof parsed.master === "object"
      ? (parsed.master as { title?: string; prompt?: string })
      : {};
  const rawNodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  const nodes = rawNodes
    .slice(0, 6)
    .map((n) => n as { kind?: string; title?: string; prompt?: string })
    .map((n) => ({
      kind: ALLOWED_KINDS.includes(String(n.kind)) ? String(n.kind) : "image",
      title: String(n.title ?? "Step"),
      prompt: String(n.prompt ?? ""),
    }));
  return {
    master: {
      title: String(master.title ?? "Master keyframe"),
      prompt: String(master.prompt ?? brief),
    },
    nodes,
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : undefined,
    estimatedCostUsd: Number((0.04 * (nodes.length + 1)).toFixed(2)),
  };
}

async function generate(env: GatewayEnv, kind: string, prompt: string) {
  if (kind === "copy" || kind === "transcreate") {
    const text = await openaiChat(
      env,
      env.textModel,
      "You are a senior brand copywriter. Return only the requested copy, no preamble.",
      prompt,
      false,
    );
    return { kind, text };
  }
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.imageModel,
      prompt,
      size: "1024x1024",
      n: 1,
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI images ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    data?: { b64_json?: string; url?: string }[];
  };
  const first = data.data?.[0];
  return {
    kind,
    dataUrl: first?.b64_json ? `data:image/png;base64,${first.b64_json}` : undefined,
    url: first?.url,
  };
}

export function aiGateway(env: GatewayEnv): Plugin {
  return {
    name: "dept-ai-gateway",
    configureServer(server) {
      // DEV-ONLY shortcut. The REAL path is the edge: set VITE_API_BASE_URL to the
      // edge origin so /api/ai/* flow through edge → orchestration → scene-mcp,
      // where locks, audit, tenancy and the safety pipeline apply.
      server.config.logger.warn(
        "[dept-ai-gateway] DEV ONLY — calls OpenAI directly and BYPASSES the edge/orchestration/scene-mcp invariants (locks, audit, tenancy, safety). Set VITE_API_BASE_URL to the edge for the real path.",
      );
      server.middlewares.use("/api/ai/status", (req, res, next) => {
        if (req.method !== "GET") return next();
        sendJson(res, 200, {
          configured: Boolean(env.apiKey),
          planModel: env.planModel,
          imageModel: env.imageModel,
        });
      });

      server.middlewares.use("/api/ai/plan", async (req, res, next) => {
        if (req.method !== "POST") return next();
        if (!env.apiKey) {
          return sendJson(res, 503, {
            error:
              "AI not configured. Add OPENAI_API_KEY to frontend/.env.local, then restart the dev server.",
          });
        }
        try {
          const body = await readBody(req);
          sendJson(res, 200, await plan(env, String(body.brief ?? "")));
        } catch (e) {
          sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) });
        }
      });

      server.middlewares.use("/api/ai/generate", async (req, res, next) => {
        if (req.method !== "POST") return next();
        if (!env.apiKey) {
          return sendJson(res, 503, { error: "AI not configured." });
        }
        try {
          const body = await readBody(req);
          sendJson(
            res,
            200,
            await generate(env, String(body.kind ?? "image"), String(body.prompt ?? "")),
          );
        } catch (e) {
          sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) });
        }
      });
    },
  };
}
