import { randomUUID } from "node:crypto";
import type { AuditRecord } from "./audit-record.js";
import { getAuditSink } from "./sink.js";

/** Numeric structural parameters safe to persist verbatim. */
const NUMERIC_STRUCTURAL_KEYS = new Set([
  "width",
  "height",
  "duration",
  "fps",
  "x",
  "y",
  "opacity",
  "scale",
  "rotation",
  "count",
  "index",
  "stepsec",
  "offsetsec",
]);

/** Identifier keys — string values kept only when they match structural id shape. */
const ID_STRUCTURAL_KEYS = new Set([
  "blockid",
  "jobid",
  "sceneid",
  "templateid",
]);

/** Allow-listed key names whose string values are never free-text safe. */
const REDACT_STRING_VALUE_KEYS = new Set([
  "intent",
  "tool",
  "outcome",
  "key",
  "property",
  "version",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, "");
}

function isStructuralId(value: string): boolean {
  return /^[a-zA-Z0-9._:-]{1,128}$/.test(value) && !/\s/.test(value);
}

function redactValue(key: string, value: unknown): unknown {
  const normalizedKey = normalizeKey(key);

  if (Array.isArray(value)) {
    return value.map((item, index) => redactValue(String(index), item));
  }
  if (value && typeof value === "object") {
    return redactArgs(value as Record<string, unknown>);
  }

  if (typeof value === "number") {
    return NUMERIC_STRUCTURAL_KEYS.has(normalizedKey) ? value : "[REDACTED]";
  }

  if (typeof value === "boolean" || value === null) {
    return "[REDACTED]";
  }

  if (typeof value === "string") {
    if (value.startsWith("dev:") || value.startsWith("Bearer ")) {
      return "[REDACTED]";
    }
    if (REDACT_STRING_VALUE_KEYS.has(normalizedKey)) {
      return "[REDACTED]";
    }
    if (
      ID_STRUCTURAL_KEYS.has(normalizedKey) &&
      isStructuralId(value)
    ) {
      return value;
    }
    if (NUMERIC_STRUCTURAL_KEYS.has(normalizedKey)) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return "[REDACTED]";
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
