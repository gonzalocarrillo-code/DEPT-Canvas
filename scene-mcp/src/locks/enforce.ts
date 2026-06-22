import { writeAudit } from "../audit/audit-writer.js";
import type { Job } from "../engine/job-registry.js";
import { isLocked } from "./manifest.js";

export class LockViolation extends Error {
  readonly property: string;
  readonly blockId: number;

  constructor(property: string, blockId: number) {
    super(`Property "${property}" is locked on block ${blockId}`);
    this.name = "LockViolation";
    this.property = property;
    this.blockId = blockId;
  }
}

export interface LockAuditContext {
  tenantId: string;
  userId: string;
  tool: string;
  args?: Record<string, unknown>;
}

/** Properties motion intents typically mutate (position + animation timing). */
export const MOTION_POSITION_KEYS = ["position/x", "position/y"] as const;

/** Property stagger offsets write to on animated blocks. */
export const STAGGER_TIME_OFFSET_KEY = "playback/timeOffset";

export async function enforceWritable(
  job: Job,
  blockId: number,
  property: string,
  attempted: unknown,
  audit: LockAuditContext,
): Promise<void> {
  if (!isLocked(job, blockId, property)) {
    return;
  }

  await writeAudit({
    tenantId: audit.tenantId,
    userId: audit.userId,
    tool: audit.tool,
    args: audit.args ?? { blockId, property, attempted },
    lockDecision: { property, outcome: "rejected" },
    outcome: "error",
    detail: `Locked property write rejected: ${property}`,
  });

  throw new LockViolation(property, blockId);
}

export async function enforceWritableBatch(
  job: Job,
  blockId: number,
  properties: Array<{ key: string; value: unknown }>,
  audit: LockAuditContext,
): Promise<void> {
  for (const prop of properties) {
    await enforceWritable(job, blockId, prop.key, prop.value, audit);
  }
}

/** Choke point for motion ops — checks every property a motion write would touch. */
export async function enforceMotionWrite(
  job: Job,
  blockId: number,
  affectedProperties: string[],
  audit: LockAuditContext,
): Promise<void> {
  for (const property of affectedProperties) {
    await enforceWritable(job, blockId, property, undefined, audit);
  }
}
