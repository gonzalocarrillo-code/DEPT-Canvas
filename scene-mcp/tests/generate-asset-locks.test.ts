import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAuditLogForTests, readAuditLog } from "../src/audit/audit-writer.js";
import { clearJobRegistry, getJob } from "../src/engine/job-registry.js";
import { setOpenAiClientForTests, type OpenAiClient } from "../src/generation/openai-client.js";
import { createScene } from "../src/tools/create-scene.js";
import { generateAsset } from "../src/tools/generate-asset.js";
import type { CallerContext } from "../src/auth/tenant-context.js";

const ctx: CallerContext = { tenantId: "tenant-lock", userId: "creator", role: "creator" };

function mockClient(): OpenAiClient {
  return {
    generateCopy: vi.fn(async (prompt: string) => ({ text: prompt, attempts: 1 })),
    generateImage: vi.fn(async () => ({ base64: "aGk=", mimeType: "image/png" })),
    moderateText: vi.fn(async () => false),
    moderateImage: vi.fn(async () => false),
  };
}

describe("generate_asset honors the lock manifest", () => {
  afterEach(async () => {
    clearJobRegistry();
    await clearAuditLogForTests();
    setOpenAiClientForTests(undefined);
  });

  it("rejects generating onto a frozen target block (no bypass of lock enforcement)", async () => {
    setOpenAiClientForTests(mockClient());
    const scene = await createScene(ctx, { width: 400, height: 400, layout: "Free" });
    const job = getJob(scene.jobId)!;
    const block = job.engine.block.create("text");
    job.engine.block.appendChild(scene.pageId, block);
    job.lockManifest = {
      templateId: "t",
      version: "1",
      frozen: [{ selector: { blockId: block }, properties: ["text/text"] }],
    };

    await expect(
      generateAsset(ctx, { jobId: scene.jobId, assetType: "copy", prompt: "overwrite", targetBlockId: block }),
    ).rejects.toThrow(/locked/i);

    const log = await readAuditLog();
    expect(log.some((r) => (r as { lockDecision?: { outcome?: string } }).lockDecision?.outcome === "rejected")).toBe(
      true,
    );
  });

  it("still generates onto a fresh unlocked block", async () => {
    setOpenAiClientForTests(mockClient());
    const scene = await createScene(ctx, { width: 400, height: 400, layout: "Free" });
    const out = await generateAsset(ctx, { jobId: scene.jobId, assetType: "copy", prompt: "hello" });
    expect(out.realizedAsFill).toBe(true);
    expect(out.appliedToBlockId).toBeDefined();
  });
});
