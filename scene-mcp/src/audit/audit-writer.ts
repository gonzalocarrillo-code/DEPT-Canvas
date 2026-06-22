import { randomUUID } from "node:crypto";
import type { AuditRecord } from "./audit-record.js";
import { getAuditSink } from "./sink.js";

const SECRET_KEYS = new Set([
  "authorization",
  "token",
  "password",
  "secret",
  "apikey",
  "openai_api_key",
  "cesdk_license",
]);

/** User-supplied free text that must never land verbatim in the immutable sink. */
const FREE_TEXT_KEYS = new Set([
  "prompt",
  "brief",
  "message",
  "content",
  "text",
  "description",
  "user_input",
  "freetext",
  "free_text",
  "instructions",
  "body",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, "");
}

function shouldRedactKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (SECRET_KEYS.has(normalized)) {
    return true;
  }
  if (FREE_TEXT_KEYS.has(normalized)) {
    return true;
  }
  return normalized.includes("prompt") || normalized.includes("freetext");
}

function redactValue(key: string, value: unknown): unknown {
  if (shouldRedactKey(key)) {
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
