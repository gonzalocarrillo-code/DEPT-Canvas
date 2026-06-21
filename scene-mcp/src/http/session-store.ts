import { randomUUID } from "node:crypto";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export interface SessionStoreOptions {
  allowedHosts?: string[];
}

export class McpSessionStore {
  private readonly transports = new Map<string, StreamableHTTPServerTransport>();

  constructor(private readonly options: SessionStoreOptions = {}) {}

  get allowedHosts(): string[] | undefined {
    return this.options.allowedHosts;
  }

  has(sessionId: string): boolean {
    return this.transports.has(sessionId);
  }

  get(sessionId: string): StreamableHTTPServerTransport | undefined {
    return this.transports.get(sessionId);
  }

  set(sessionId: string, transport: StreamableHTTPServerTransport): void {
    this.transports.set(sessionId, transport);
  }

  delete(sessionId: string): void {
    this.transports.delete(sessionId);
  }

  createSessionId(): string {
    return randomUUID();
  }

  async closeSession(sessionId: string): Promise<void> {
    const transport = this.transports.get(sessionId);
    if (transport) {
      await transport.close();
      this.transports.delete(sessionId);
    }
  }

  async closeAll(): Promise<void> {
    for (const [sessionId, transport] of this.transports) {
      await transport.close();
      this.transports.delete(sessionId);
    }
  }
}
