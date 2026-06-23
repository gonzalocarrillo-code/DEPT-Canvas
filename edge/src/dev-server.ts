import { createEdgeApp } from "./server.js";

// Local dev entrypoint. Set EDGE_AUTH_MODE=dev to accept dev:<b64> tokens,
// ORCH_BASE_URL + RENDERER_URL for the upstreams, and EDGE_ALLOWED_ORIGIN for
// the browser frontend. Production uses OIDC + TLS at the load balancer.
const port = Number(process.env.EDGE_PORT ?? 8080);

createEdgeApp({ tlsTerminatedAtLoadBalancer: false }).listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `dept-canvas-edge listening on :${port} (auth=${process.env.EDGE_AUTH_MODE ?? "oidc"}, ` +
      `orch=${process.env.ORCH_BASE_URL ?? process.env.ORCHESTRATION_URL ?? "unset"}, ` +
      `renderer=${process.env.RENDERER_URL ?? "unset"})`,
  );
});
