import type { z } from "zod";
import type { CallerContext } from "../auth/tenant-context.js";
import { requireJob, withToolAudit, ToolError } from "../tools/_context.js";
import { GenerateAssetInput, GenerateAssetOutput } from "./_schemas.js";
import {
  getOpenAiClient,
  setOpenAiClientForTests,
  type OpenAiClient,
} from "../generation/openai-client.js";
import {
  generateCopyWithCap,
  runAssetModeration,
  runBrandLegalCheck,
} from "../generation/safety-pipeline.js";
import { readAuditLog } from "../audit/audit-writer.js";

export { setOpenAiClientForTests };

export async function generateAsset(
  ctx: CallerContext,
  input: z.infer<typeof GenerateAssetInput>,
) {
  const parsed = GenerateAssetInput.parse(input);

  return withToolAudit(ctx, "generate_asset", parsed, async () => {
    const job = requireJob(parsed.jobId, ctx.tenantId);
    const client = getClient();

    const inputFlagged = await client.moderateText(parsed.prompt);
    if (inputFlagged) {
      throw new ToolError("Checkpoint 1: input moderation blocked");
    }

    let appliedToBlockId = parsed.targetBlockId;
    let assetRef: string | undefined;

    if (parsed.assetType === "copy") {
      const blockId =
        parsed.targetBlockId ?? job.engine.block.create("text");
      if (!parsed.targetBlockId) {
        const [page] = job.engine.block.findByType("page");
        job.engine.block.appendChild(page, blockId);
      }

      const { text } = await generateCopyWithCap(
        client,
        parsed.prompt,
        parsed.characterLimit,
        parsed.tone,
      );

      if (await runAssetModeration(client, "copy", text)) {
        throw new ToolError("Checkpoint 2: generated copy blocked");
      }

      job.engine.block.replaceText(blockId, text);
      appliedToBlockId = blockId;
    } else {
      const image = await client.generateImage(parsed.prompt);
      assetRef = `tenant/${ctx.tenantId}/assets/${Date.now()}.png`;

      if (await runAssetModeration(client, parsed.assetType, image.base64)) {
        throw new ToolError("Checkpoint 2: generated image blocked");
      }

      const blockId =
        parsed.targetBlockId ?? job.engine.block.create("graphic");
      if (!parsed.targetBlockId) {
        const [page] = job.engine.block.findByType("page");
        job.engine.block.appendChild(page, blockId);
      }

      const fill = job.engine.block.createFill("image");
      job.engine.block.setString(
        fill,
        "fill/image/imageFileURI",
        `data:${image.mimeType};base64,${image.base64}`,
      );
      job.engine.block.setFill(blockId, fill);
      appliedToBlockId = blockId;
    }

    if (!(await runBrandLegalCheck(ctx.tenantId, parsed.assetType))) {
      throw new ToolError("Checkpoint 3: brand/legal blocked");
    }

    const output = GenerateAssetOutput.parse({
      realizedAsFill: true,
      appliedToBlockId,
      assetRef,
      checkpoints: {
        input: "pass",
        asset: "pass",
        brandLegal: "pass",
      },
      auditId: readAuditLog().at(-1)?.id ?? "pending",
    });

    assertNoOpenAiKeyLeaks(output);
    return output;
  });
}

function getClient(): OpenAiClient {
  return getOpenAiClient();
}

function assertNoOpenAiKeyLeaks(
  output: z.infer<typeof GenerateAssetOutput>,
): void {
  const serialized = JSON.stringify(output);
  const key = process.env.OPENAI_API_KEY;
  if (key && serialized.includes(key)) {
    throw new Error("OpenAI key leaked into tool result");
  }
}
