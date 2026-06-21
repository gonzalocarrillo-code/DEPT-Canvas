import type { z } from "zod";
import type { CallerContext } from "../auth/tenant-context.js";
import { CreateBlockInput, CreateBlockOutput } from "./_schemas.js";
import { requireJob, withToolAudit } from "./_context.js";

export async function createBlock(
  ctx: CallerContext,
  input: z.infer<typeof CreateBlockInput>,
) {
  const parsed = CreateBlockInput.parse(input);
  return withToolAudit(ctx, "create_block", parsed, async () => {
    const job = requireJob(parsed.jobId, ctx.tenantId);
    const blockId = job.engine.block.create(parsed.type);
    if (parsed.kind) {
      job.engine.block.setKind(blockId, parsed.kind);
    }
    job.engine.block.appendChild(parsed.parentId, blockId);
    return CreateBlockOutput.parse({ blockId });
  });
}
