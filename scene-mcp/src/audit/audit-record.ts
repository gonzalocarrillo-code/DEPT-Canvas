export type AuditOutcome = "ok" | "error";

export type LockDecisionOutcome = "allowed" | "rejected";

export interface LockDecision {
  property: string;
  outcome: LockDecisionOutcome;
}

export interface AuditRecord {
  id: string;
  ts: string;
  tenantId: string;
  userId: string;
  tool: string;
  argsRedacted: Record<string, unknown>;
  lockDecision?: LockDecision;
  outcome: AuditOutcome;
  detail?: string;
}
