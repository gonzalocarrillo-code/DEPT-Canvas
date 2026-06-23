import type { Express, Request, Response } from "express";
import type { SessionToken } from "./validate-token.js";
import { TenantRoutingError } from "./errors.js";

// ── App API proxy ───────────────────────────────────────────────────────────
// The product endpoints the frontend calls (plan a brief, generate an asset,
// fan out variations, render) flow: frontend → edge → orchestration control
// plane (OpenAI Agents) → scene-MCP tools. The edge has ALREADY validated the
// token and resolved the tenant; identity is forwarded to orchestration as
// trusted headers and is NEVER taken from the client body/query. tenant_id is
// authoritative from the session — a mismatching x-tenant-id is denied.

type ProxyRequest = Request & { session?: SessionToken };

interface AppRoute {
  method: "get" | "post";
  path: string;
  upstream: string;
}

const APP_ROUTES: AppRoute[] = [
  { method: "get", path: "/api/ai/status", upstream: "/status" },
  { method: "post", path: "/api/ai/plan", upstream: "/plan" },
  { method: "post", path: "/api/ai/generate", upstream: "/generate" },
  { method: "post", path: "/api/variations", upstream: "/variation" },
  { method: "post", path: "/api/render", upstream: "/render" },
];

const UPSTREAM_TIMEOUT_MS = Number(process.env.ORCHESTRATION_TIMEOUT_MS ?? 90_000);

function orchestrationUrl(): string {
  return process.env.ORCH_BASE_URL ?? process.env.ORCHESTRATION_URL ?? "";
}

function rendererUrl(): string {
  return process.env.RENDERER_URL ?? "";
}

/** Authoritative tenant from the session; reject any conflicting client hint. */
function resolveTenant(req: ProxyRequest): string {
  const session = req.session;
  if (!session) throw new TenantRoutingError("unauthorized");
  const hinted = req.header("x-tenant-id");
  if (hinted && hinted !== session.tenantId) {
    throw new TenantRoutingError("Cross-tenant routing denied");
  }
  return session.tenantId;
}

async function forward(
  req: ProxyRequest,
  res: Response,
  upstreamPath: string,
  base: string = orchestrationUrl(),
): Promise<void> {
  let tenantId: string;
  try {
    tenantId = resolveTenant(req);
  } catch (error) {
    if (error instanceof TenantRoutingError) {
      res.status(req.session ? 403 : 401).json({ error: req.session ? "cross_tenant_denied" : "unauthorized" });
      return;
    }
    throw error;
  }
  const session = req.session!;

  if (!base) {
    // /status degrades gracefully so the frontend can fall back to simulation.
    if (upstreamPath === "/status") {
      res.json({ configured: false, planModel: "", imageModel: "" });
      return;
    }
    res.status(503).json({ error: "ai_not_configured", detail: "ORCHESTRATION_URL is not set" });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${base}${upstreamPath}`, {
      method: req.method,
      headers: {
        "content-type": "application/json",
        "x-tenant-id": tenantId,
        "x-user-id": session.userId,
        "x-user-role": session.role,
      },
      body: req.method === "GET" ? undefined : JSON.stringify(req.body ?? {}),
      signal: controller.signal,
    });
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader("content-type", upstream.headers.get("content-type") ?? "application/json");
    res.send(body);
  } catch {
    if (upstreamPath === "/status") {
      res.json({ configured: false, planModel: "", imageModel: "" });
      return;
    }
    res.status(502).json({ error: "upstream_unavailable" });
  } finally {
    clearTimeout(timer);
  }
}

export function registerAppRoutes(app: Express): void {
  for (const route of APP_ROUTES) {
    app[route.method](route.path, (req, res) => {
      void forward(req as ProxyRequest, res, route.upstream);
    });
  }
  // Scene save/load carry a scene id in the path; forward it to orchestration.
  app.get("/api/scenes/:id", (req, res) => {
    void forward(req as ProxyRequest, res, `/scenes/${encodeURIComponent(req.params.id)}`);
  });
  app.post("/api/scenes/:id/save", (req, res) => {
    void forward(req as ProxyRequest, res, `/scenes/${encodeURIComponent(req.params.id)}/save`);
  });

  // Render/export goes to the renderer data plane (generate-once / render-many).
  // The tenant-scoped sceneRef is built server-side from the session tenant +
  // a client-supplied sceneId — the client never supplies the tenant segment.
  app.post("/api/variations/export", (req, res) => {
    const proxyReq = req as ProxyRequest;
    const session = proxyReq.session;
    if (session && req.body && typeof req.body === "object") {
      const body = req.body as Record<string, unknown>;
      const sceneId = String(body.sceneId ?? "").replace(/[^A-Za-z0-9_-]/g, "");
      body.sceneRef = `tenant/${session.tenantId}/scenes/${sceneId}.scene`;
      delete body.sceneId;
    }
    void forward(proxyReq, res, "/jobs", rendererUrl());
  });
  app.get("/api/jobs/:id/status", (req, res) => {
    void forward(req as ProxyRequest, res, `/jobs/${encodeURIComponent(req.params.id)}`, rendererUrl());
  });
}

export const APP_ROUTE_PATHS = APP_ROUTES.map((r) => r.path);
