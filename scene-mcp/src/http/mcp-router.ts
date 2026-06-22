import type { IncomingMessage, ServerResponse } from "node:http";
import type { Express, Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AuthError } from "../auth/verify-token.js";
import { contextFromRequest } from "../auth/tenant-context.js";
import { requestContextStorage } from "../auth/request-context.js";
import { McpSessionStore } from "./session-store.js";

function sessionHeader(req: IncomingMessage): string | undefined {
  const raw = req.headers["mcp-session-id"];
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return raw;
}

async function runWithRequestAuth<T>(
  req: Request,
  res: Response,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    const ctx = await contextFromRequest(req);
    return await requestContextStorage.run(ctx, fn);
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: error.message },
        id: null,
      });
      return undefined;
    }
    throw error;
  }
}

export function mountMcpRoutes(
  app: Express,
  createServer: () => McpServer,
  sessions: McpSessionStore,
): void {
  const handlePost = async (req: Request, res: Response) => {
    const sessionId = sessionHeader(req);

    try {
      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionId && sessions.has(sessionId)) {
        transport = sessions.get(sessionId);
        const handled = await runWithRequestAuth(req, res, async () => {
          await transport!.handleRequest(req, res, req.body);
        });
        if (handled === undefined) {
          return;
        }
        return;
      }

      if (!sessionId && isInitializeRequest(req.body)) {
        const handled = await runWithRequestAuth(req, res, async () => {
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => sessions.createSessionId(),
            onsessioninitialized: (id) => {
              if (transport) {
                sessions.set(id, transport);
              }
            },
          });

          transport.onclose = () => {
            const sid = transport?.sessionId;
            if (sid) {
              sessions.delete(sid);
            }
          };

          const server = createServer();
          await server.connect(transport);
          await transport.handleRequest(req, res, req.body);
        });
        if (handled === undefined) {
          return;
        }
        return;
      }

      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message:
              error instanceof Error ? error.message : "Internal server error",
          },
          id: null,
        });
      }
    }
  };

  const handleGet = async (req: Request, res: Response) => {
    const sessionId = sessionHeader(req);
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    const transport = sessions.get(sessionId)!;
    await transport.handleRequest(req, res);
  };

  const handleDelete = async (req: Request, res: Response) => {
    const sessionId = sessionHeader(req);
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(404).send("Session not found");
      return;
    }
    const transport = sessions.get(sessionId)!;
    await transport.handleRequest(req, res);
    sessions.delete(sessionId);
  };

  app.post("/mcp", handlePost);
  app.get("/mcp", handleGet);
  app.delete("/mcp", handleDelete);
}

export async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  body: unknown,
  createServer: () => McpServer,
  sessions: McpSessionStore,
): Promise<void> {
  const sessionId = sessionHeader(req);

  if (sessionId && sessions.has(sessionId)) {
    await sessions.get(sessionId)!.handleRequest(req, res, body);
    return;
  }

  if (!sessionId && isInitializeRequest(body)) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessions.createSessionId(),
      onsessioninitialized: (id) => {
        sessions.set(id, transport);
      },
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) {
        sessions.delete(sid);
      }
    };

    const server = createServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
    return;
  }

  res.statusCode = 400;
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Bad Request: No valid session ID provided",
      },
      id: null,
    }),
  );
}
