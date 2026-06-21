import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";

export interface ToolRegistration {
  name: string;
  description: string;
  inputSchema: ZodRawShapeCompat;
  handler: ToolCallback<ZodRawShapeCompat>;
}

export function createMcpServer(tools: ToolRegistration[] = []): McpServer {
  const server = new McpServer(
    { name: "dept-canvas-scene-mcp", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );

  if (tools.length === 0) {
    // McpServer registers tools/list only after the first registerTool call.
    const bootstrap = server.registerTool(
      "__bootstrap__",
      {
        description: "Internal bootstrap — initializes tools/list handler",
        inputSchema: {},
      },
      async () => ({
        content: [{ type: "text", text: "ok" }],
      }),
    );
    bootstrap.update({ enabled: false });
  }

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      tool.handler,
    );
  }

  return server;
}
