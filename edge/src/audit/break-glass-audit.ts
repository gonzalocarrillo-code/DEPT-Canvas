import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface BreakGlassAuditRecord {
  readonly timestamp: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly reason: string;
  readonly actorIp?: string;
}

const inMemoryRecords: BreakGlassAuditRecord[] = [];

export function writeBreakGlassAudit(record: BreakGlassAuditRecord): void {
  const frozen = Object.freeze({ ...record });
  inMemoryRecords.push(frozen);

  const sinkPath = process.env.BREAK_GLASS_AUDIT_SINK_PATH;
  if (sinkPath) {
    mkdirSync(dirname(sinkPath), { recursive: true });
    appendFileSync(sinkPath, `${JSON.stringify(frozen)}\n`, "utf8");
  }
}

export function getBreakGlassAuditRecordsForTests(): readonly BreakGlassAuditRecord[] {
  return [...inMemoryRecords];
}

export function clearBreakGlassAuditForTests(): void {
  inMemoryRecords.length = 0;
}
