import type { z } from "zod";
import type { CallerContext } from "../auth/tenant-context.js";
import { LockViolation } from "../locks/enforce.js";
import { getMotionEngine } from "../motion/engine-registry.js";
import { StaggerInput, StaggerOutput } from "./_schemas.js";
import { requireJob, ToolError, withToolAudit } from "./_context.js";

export async function stagger(
  ctx: CallerContext,
  input: z.infer<typeof StaggerInput>,
) {
  const parsed = StaggerInput.parse(input);
  return withToolAudit(ctx, "stagger", parsed, async () => {
    requireJob(parsed.jobId, ctx.tenantId);
    try {
      const result = await getMotionEngine().stagger(
        parsed.jobId,
        ctx.tenantId,
        ctx.userId,
        parsed.blockIds,
        { stepSec: parsed.stepSec },
      );
      return StaggerOutput.parse(result);
    } catch (error) {
      if (error instanceof LockViolation) {
        throw new ToolError(error.message);
      }
      throw error;
    }
  });
}
