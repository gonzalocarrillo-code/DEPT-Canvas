import type { z } from "zod";
import type { CallerContext } from "../auth/tenant-context.js";
import { LockViolation } from "../locks/enforce.js";
import { getMotionEngine } from "../motion/engine-registry.js";
import { SetTimingInput, SetTimingOutput } from "./_schemas.js";
import { requireJob, ToolError, withToolAudit } from "./_context.js";

export async function setTiming(
  ctx: CallerContext,
  input: z.infer<typeof SetTimingInput>,
) {
  const parsed = SetTimingInput.parse(input);
  return withToolAudit(ctx, "set_timing", parsed, async () => {
    requireJob(parsed.jobId, ctx.tenantId);
    try {
      const result = await getMotionEngine().setTiming(
        parsed.jobId,
        ctx.tenantId,
        ctx.userId,
        parsed.blockId,
        { start: parsed.start, duration: parsed.duration },
      );
      return SetTimingOutput.parse(result);
    } catch (error) {
      if (error instanceof LockViolation) {
        throw new ToolError(error.message);
      }
      throw error;
    }
  });
}
