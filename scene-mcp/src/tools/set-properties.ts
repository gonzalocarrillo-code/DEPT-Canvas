import type { z } from "zod";
import type { CallerContext } from "../auth/tenant-context.js";
import { SetPropertiesInput, SetPropertiesOutput } from "./_schemas.js";
import { enforceWritableBatch, LockViolation } from "../locks/enforce.js";
import { setTypedProperty } from "../engine/property-io.js";
import { requireJob, ToolError, withToolAudit } from "./_context.js";

export async function setProperties(
  ctx: CallerContext,
  input: z.infer<typeof SetPropertiesInput>,
) {
  const parsed = SetPropertiesInput.parse(input);
  return withToolAudit(ctx, "set_properties", parsed, async () => {
    const job = requireJob(parsed.jobId, ctx.tenantId);
    const audit = {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      tool: "set_properties",
      args: parsed as unknown as Record<string, unknown>,
    };

    try {
      await enforceWritableBatch(job, parsed.blockId, parsed.properties, audit);
    } catch (error) {
      if (error instanceof LockViolation) {
        throw new ToolError(error.message);
      }
      throw error;
    }

    const applied: string[] = [];
    for (const prop of parsed.properties) {
      setTypedProperty(job.engine, parsed.blockId, prop.key, prop.value);
      applied.push(prop.key);
    }

    return SetPropertiesOutput.parse({ applied });
  });
}
