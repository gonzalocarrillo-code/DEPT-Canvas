import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
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

  app.use(async (req, res, next) => {
    if (req.path === "/health") {
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
