import type { IncomingMessage, ServerResponse } from "node:http";
import type { Express, Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpSessionStore } from "./session-store.js";

function sessionHeader(req: IncomingMessage): string | undefined {
  const raw = req.headers["mcp-session-id"];
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return raw;
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
      } else if (!sessionId && isInitializeRequest(req.body)) {
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
        return;
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        });
        return;
      }

      await transport!.handleRequest(req, res, req.body);
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
