import express from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { createMcpServer } from "./server.js";
import { buildCoreTools } from "./tools/registry.js";
import { McpSessionStore } from "./http/session-store.js";
import { mountMcpRoutes } from "./http/mcp-router.js";

export interface SceneMcpHttpOptions {
  port?: number;
  host?: string;
  allowedHosts?: string[];
}

export function createSceneMcpApp(options: SceneMcpHttpOptions = {}) {
  const sessions = new McpSessionStore({
    allowedHosts: options.allowedHosts ?? ["127.0.0.1", "localhost"],
  });

  const app = createMcpExpressApp({
    host: options.host ?? "127.0.0.1",
    allowedHosts: options.allowedHosts ?? ["127.0.0.1", "localhost"],
  });

  app.use(express.json({ limit: "4mb" }));
  mountMcpRoutes(app, () => createMcpServer(buildCoreTools()), sessions);

  return { app, sessions };
}

export async function startSceneMcpHttp(
  options: SceneMcpHttpOptions = {},
): Promise<{ app: express.Express; close: () => Promise<void> }> {
  const { app, sessions } = createSceneMcpApp(options);
  const port = options.port ?? Number(process.env.MCP_PORT ?? 3100);
  const host = options.host ?? "127.0.0.1";

  await new Promise<void>((resolve, reject) => {
    app.listen(port, host, (err?: Error) => {
      if (err) reject(err);
      else resolve();
    });
  });

  return {
    app,
    close: async () => {
      await sessions.closeAll();
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startSceneMcpHttp().then(({ close }) => {
    process.on("SIGINT", () => {
      void close().then(() => process.exit(0));
    });
  });
}
