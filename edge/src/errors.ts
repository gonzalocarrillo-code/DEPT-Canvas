export class TenantRoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantRoutingError";
  }
}

export class RateLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitExceededError";
  }
}

export class EgressDeniedError extends Error {
  readonly host: string;

  constructor(host: string) {
    super(`Egress to host '${host}' is not allowed for MCP`);
    this.name = "EgressDeniedError";
    this.host = host;
  }
}

export class PathTraversalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathTraversalError";
  }
}
