import type { z } from "zod";
import type { CallerContext } from "../auth/tenant-context.js";
import { LockViolation } from "../locks/enforce.js";
import { getMotionEngine } from "../motion/engine-registry.js";
import { SequenceInput, SequenceOutput } from "./_schemas.js";
import { requireJob, ToolError, withToolAudit } from "./_context.js";

export async function sequence(
  ctx: CallerContext,
  input: z.infer<typeof SequenceInput>,
) {
  const parsed = SequenceInput.parse(input);
  return withToolAudit(ctx, "sequence", parsed, async () => {
    requireJob(parsed.jobId, ctx.tenantId);
    try {
      const result = await getMotionEngine().sequence(
        parsed.jobId,
        ctx.tenantId,
        ctx.userId,
        parsed.sceneIds,
        parsed.offsets,
      );
      return SequenceOutput.parse(result);
    } catch (error) {
      if (error instanceof LockViolation) {
        throw new ToolError(error.message);
      }
      throw error;
    }
  });
}
