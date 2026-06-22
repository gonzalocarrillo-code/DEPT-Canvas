import { randomUUID } from "node:crypto";
import type { AuditRecord } from "./audit-record.js";
import { getAuditSink } from "./sink.js";

/** Keys known to be non-PII structural identifiers or numeric parameters. */
const SAFE_ARG_KEYS = new Set([
  "width",
  "height",
  "duration",
  "fps",
  "blockid",
  "jobid",
  "sceneid",
  "templateid",
  "version",
  "stepsec",
  "offsetsec",
  "intent",
  "x",
  "y",
  "opacity",
  "scale",
  "rotation",
  "count",
  "index",
  "key",
  "property",
  "outcome",
  "tool",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, "");
}

function isSafeKey(key: string): boolean {
  return SAFE_ARG_KEYS.has(normalizeKey(key));
}

function redactValue(key: string, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => redactValue(String(index), item));
  }
  if (value && typeof value === "object") {
    return redactArgs(value as Record<string, unknown>);
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  if (typeof value === "string") {
    if (value.startsWith("dev:") || value.startsWith("Bearer ")) {
      return "[REDACTED]";
    }
    if (!isSafeKey(key)) {
      return "[REDACTED]";
    }
    return value;
  }
  return "[REDACTED]";
}

export function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    out[key] = redactValue(key, value);
  }
  return out;
}

export async function readAuditLog(): Promise<readonly AuditRecord[]> {
  return getAuditSink().readAll();
}

export async function clearAuditLogForTests(): Promise<void> {
  await getAuditSink().clearForTests();
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

  await getAuditSink().append(entry);
  return entry;
}
