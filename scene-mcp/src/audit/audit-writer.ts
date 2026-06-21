import { randomUUID } from "node:crypto";
import type { AuditRecord } from "./audit-record.js";

const REDACT_KEYS = new Set([
  "authorization",
  "token",
  "password",
  "secret",
  "apiKey",
  "openai_api_key",
  "CESDK_LICENSE",
]);

function redactValue(key: string, value: unknown): unknown {
  if (REDACT_KEYS.has(key.toLowerCase())) {
    return "[REDACTED]";
  }
  if (typeof value === "string" && value.startsWith("dev:")) {
    return "[REDACTED]";
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => redactValue(String(index), item));
  }
  if (value && typeof value === "object") {
    return redactArgs(value as Record<string, unknown>);
  }
  return value;
}

export function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    out[key] = redactValue(key, value);
  }
  return out;
}

const auditLog: AuditRecord[] = [];

export function readAuditLog(): readonly AuditRecord[] {
  return auditLog;
}

export function clearAuditLogForTests(): void {
  auditLog.length = 0;
}

export async function writeAudit(
  rec: Omit<AuditRecord, "id" | "ts" | "argsRedacted"> & {
    args: Record<string, unknown>;
    argsRedacted?: Record<string, unknown>;
  },
): Promise<AuditRecord> {
  if (!rec.tenantId) {
    throw new Error("Audit record requires tenantId");
  }

  const entry: AuditRecord = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    tenantId: rec.tenantId,
    userId: rec.userId,
    tool: rec.tool,
    argsRedacted: rec.argsRedacted ?? redactArgs(rec.args),
    lockDecision: rec.lockDecision,
    outcome: rec.outcome,
    detail: rec.detail,
  };

  auditLog.push(entry);
  return entry;
}
