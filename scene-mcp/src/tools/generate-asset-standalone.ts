import type { z } from "zod";
import type { CallerContext } from "../auth/tenant-context.js";
import { withToolAudit, ToolError } from "./_context.js";
import { GenerateAssetStandaloneInput, GenerateAssetStandaloneOutput } from "./_schemas.js";
import { getOpenAiClient } from "../generation/openai-client.js";
import {
  generateCopyWithCap,
  runAssetModeration,
  runBrandLegalCheck,
} from "../generation/safety-pipeline.js";
import { readAuditLog } from "../audit/audit-writer.js";

// Standalone generation through the SAME safety + audit + tenancy pipeline as
// generate_asset, but returning the moderated bytes/text directly instead of
// applying a fill to a job block. No engine/CE.SDK needed — the moderation
// checkpoints (not the block application) are the safety boundary.
export async function generateAssetStandalone(
  ctx: CallerContext,
  input: z.infer<typeof GenerateAssetStandaloneInput>,
) {
  const parsed = GenerateAssetStandaloneInput.parse(input);

  return withToolAudit(ctx, "generate_asset_standalone", parsed, async () => {
    const client = getOpenAiClient();

    // Checkpoint 1: input moderation
    if (await client.moderateText(parsed.prompt)) {
      throw new ToolError("Checkpoint 1: input moderation blocked");
    }

    const auditId = async () => (await readAuditLog()).at(-1)?.id ?? "pending";
    const checkpoints = { input: "pass", asset: "pass", brandLegal: "pass" } as const;

    if (parsed.assetType === "copy") {
      const { text } = await generateCopyWithCap(
        client,
        parsed.prompt,
        parsed.characterLimit,
        parsed.tone,
      );
      // Checkpoint 2: output moderation
      if (await runAssetModeration(client, "copy", text)) {
        throw new ToolError("Checkpoint 2: generated copy blocked");
      }
      // Checkpoint 3: brand/legal
      if (!(await runBrandLegalCheck(ctx.tenantId, "copy"))) {
        throw new ToolError("Checkpoint 3: brand/legal blocked");
      }
      const output = GenerateAssetStandaloneOutput.parse({
        kind: "copy",
        text,
        checkpoints,
        auditId: await auditId(),
      });
      assertNoOpenAiKeyLeaks(output);
      return output;
    }

    const image = await client.generateImage(parsed.prompt);
    if (await runAssetModeration(client, parsed.assetType, image.base64)) {
      throw new ToolError("Checkpoint 2: generated image blocked");
    }
    if (!(await runBrandLegalCheck(ctx.tenantId, parsed.assetType))) {
      throw new ToolError("Checkpoint 3: brand/legal blocked");
    }
    const output = GenerateAssetStandaloneOutput.parse({
      kind: "image",
      dataUrl: `data:${image.mimeType};base64,${image.base64}`,
      assetRef: `tenant/${ctx.tenantId}/assets/${Date.now()}.png`,
      checkpoints,
      auditId: await auditId(),
    });
    assertNoOpenAiKeyLeaks(output);
    return output;
  });
}

function assertNoOpenAiKeyLeaks(output: z.infer<typeof GenerateAssetStandaloneOutput>): void {
  const key = process.env.OPENAI_API_KEY;
  if (key && JSON.stringify(output).includes(key)) {
    throw new Error("OpenAI key leaked into tool result");
  }
}
