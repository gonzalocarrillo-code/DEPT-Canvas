import type { z } from "zod";
import type { CallerContext } from "../auth/tenant-context.js";
import { queryAnimatable } from "../engine/query-animatable.js";
import { QueryAnimatableInput, QueryAnimatableOutput } from "./_schemas.js";
import { requireJob, withToolAudit } from "./_context.js";

export async function queryAnimatableTool(
  ctx: CallerContext,
  input: z.infer<typeof QueryAnimatableInput>,
) {
  const parsed = QueryAnimatableInput.parse(input);
  return withToolAudit(ctx, "query_animatable", parsed, async () => {
    const job = requireJob(parsed.jobId, ctx.tenantId);
    const result = queryAnimatable(job.engine, parsed.blockId);
    return QueryAnimatableOutput.parse(result);
  });
}
