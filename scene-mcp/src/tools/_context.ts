import type { CallerContext } from "../auth/tenant-context.js";
import { assertCan, capabilityForTool } from "../auth/rbac.js";
import { writeAudit } from "../audit/audit-writer.js";
import { createJob, getJob } from "../engine/job-registry.js";

export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

export function requireJob(jobId: string, tenantId: string) {
  const job = getJob(jobId);
  if (!job) {
    throw new ToolError(`Unknown jobId: ${jobId}`);
  }
  if (job.tenantId !== tenantId) {
    throw new ToolError("Job does not belong to caller tenant");
  }
  return job;
}

export async function withToolAudit<T>(
  ctx: CallerContext,
  tool: string,
  args: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const cap = capabilityForTool(tool);
  if (cap) {
    assertCan(ctx, cap);
  }

  try {
    const result = await fn();
    await writeAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      tool,
      args,
      outcome: "ok",
    });
    return result;
  } catch (error) {
    await writeAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      tool,
      args,
      outcome: "error",
      detail: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function createSceneForTenant(
  ctx: CallerContext,
  input: { width: number; height: number; layout: string },
) {
  return withToolAudit(ctx, "create_scene", input, async () => {
    const job = await createJob(ctx.tenantId);
    const page = job.engine.block.create("page");
    job.engine.block.setWidth(page, input.width);
    job.engine.block.setHeight(page, input.height);
    job.engine.block.appendChild(job.sceneId, page);

    return {
      jobId: job.id,
      sceneId: job.sceneId,
      pageId: page,
    };
  });
}
