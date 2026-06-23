import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { createScimRouter } from "./scim/provisioning.js";
import { registerAppRoutes } from "./app-proxy.js";
import { assertMcpEgressAllowed } from "./egress-policy.js";
import {
  EgressDeniedError,
  PathTraversalError,
  RateLimitExceededError,
  TenantRoutingError,
} from "./errors.js";
import { checkRateLimit } from "./rate-limit.js";
import { routeRequest, type RoutedRequest } from "./tenant-router.js";
import {
  isPublicAuthPath,
  registerAuthRoutes,
} from "./sso/auth-routes.js";
import {
  TokenValidationError,
  validateSessionToken,
  type SessionToken,
} from "./validate-token.js";

export interface EdgeServerOptions {
  tlsTerminatedAtLoadBalancer?: boolean;
}

type EdgeRequest = Request & {
  session?: SessionToken;
  routed?: RoutedRequest;
};

function safeErrorResponse(res: Response, status: number, code: string): void {
  res.status(status).json({ error: code });
}

export function createEdgeApp(options: EdgeServerOptions = {}): Express {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  // CORS for the browser frontend (dev origin by default). Preflight is answered
  // before auth so OPTIONS without an Authorization header succeeds.
  const allowedOrigin = process.env.EDGE_ALLOWED_ORIGIN ?? "http://127.0.0.1:5173";
  app.use((req, res, next) => {
    const origin = req.header("origin");
    if (origin && origin === allowedOrigin) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("vary", "origin");
      res.setHeader("access-control-allow-headers", "authorization,content-type,x-tenant-id");
      res.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  if (options.tlsTerminatedAtLoadBalancer !== false) {
    app.use((req, res, next) => {
      const proto = req.header("x-forwarded-proto");
      if (proto && proto !== "https" && process.env.EDGE_REQUIRE_TLS === "true") {
        safeErrorResponse(res, 403, "tls_required");
        return;
      }
      next();
    });
  }

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "dept-canvas-edge" });
  });

  registerAuthRoutes(app, safeErrorResponse);
  app.use("/scim/v2", createScimRouter());

  app.use(async (req, res, next) => {
    if (isPublicAuthPath(req.path)) {
      next();
      return;
    }

    const edgeReq = req as EdgeRequest;
    try {
      const session = await validateSessionToken(req.header("authorization"));
      edgeReq.session = session;
      checkRateLimit(`${session.tenantId}:${req.ip ?? "unknown"}`);
      next();
    } catch (error) {
      if (error instanceof TokenValidationError) {
        safeErrorResponse(res, 401, "invalid_token");
        return;
      }
      if (error instanceof RateLimitExceededError) {
        safeErrorResponse(res, 429, "rate_limit_exceeded");
        return;
      }
      next(error);
    }
  });

  // App API: proxy product endpoints to the orchestration control plane.
  registerAppRoutes(app);

  // Fallback for any other /api/* path: resolve the tenant silo route (the
  // internal data-plane URL) without leaking cross-tenant access.
  app.use("/api", (req, res, next) => {
    const edgeReq = req as EdgeRequest;
    try {
      if (!edgeReq.session) {
        safeErrorResponse(res, 401, "unauthorized");
        return;
      }
      const requestedTenant = req.header("x-tenant-id") ?? undefined;
      const routed = routeRequest(
        edgeReq.session,
        req.url || "/",
        requestedTenant,
      );
      edgeReq.routed = routed;
      res.status(200).json({
        tenantId: routed.tenantId,
        upstreamUrl: routed.upstreamUrl,
        region: routed.region,
        rendererQueue: routed.rendererQueue,
      });
    } catch (error) {
      if (error instanceof TenantRoutingError) {
        safeErrorResponse(res, 403, "cross_tenant_denied");
        return;
      }
      if (error instanceof PathTraversalError) {
        safeErrorResponse(res, 400, "invalid_path");
        return;
      }
      next(error);
    }
  });

  app.post("/internal/mcp-egress-check", (req, res) => {
    const edgeReq = req as EdgeRequest;
    try {
      if (!edgeReq.session) {
        safeErrorResponse(res, 401, "unauthorized");
        return;
      }
      assertMcpEgressAllowed(
        edgeReq.session.tenantId,
        String(req.body?.host ?? ""),
      );
      res.json({ allowed: true });
    } catch (error) {
      if (error instanceof EgressDeniedError) {
        safeErrorResponse(res, 403, "egress_denied");
        return;
      }
      safeErrorResponse(res, 400, "invalid_request");
    }
  });

  app.use((_err: Error, _req: Request, res: Response, _next: NextFunction) => {
    safeErrorResponse(res, 500, "internal_error");
  });

  return app;
}
