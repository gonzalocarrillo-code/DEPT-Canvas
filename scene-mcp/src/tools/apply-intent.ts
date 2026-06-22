import type { z } from "zod";
import type { CallerContext } from "../auth/tenant-context.js";
import { LockViolation } from "../locks/enforce.js";
import { getMotionEngine } from "../motion/engine-registry.js";
import { ApplyIntentInput, ApplyIntentOutput } from "./_schemas.js";
import { requireJob, ToolError, withToolAudit } from "./_context.js";

export async function applyIntent(
  ctx: CallerContext,
  input: z.infer<typeof ApplyIntentInput>,
) {
  const parsed = ApplyIntentInput.parse(input);
  return withToolAudit(ctx, "apply_intent", parsed, async () => {
    requireJob(parsed.jobId, ctx.tenantId);
    try {
      const result = await getMotionEngine().applyIntent(
        parsed.jobId,
        ctx.tenantId,
        ctx.userId,
        parsed.blockId,
        parsed.intent,
        parsed.params,
      );
      return ApplyIntentOutput.parse(result);
    } catch (error) {
      if (error instanceof LockViolation) {
        throw new ToolError(error.message);
      }
      throw error;
    }
  });
}
