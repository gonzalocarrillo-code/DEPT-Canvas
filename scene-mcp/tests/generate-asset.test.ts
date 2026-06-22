import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAuditLogForTests } from "../src/audit/audit-writer.js";
import { clearJobRegistry } from "../src/engine/job-registry.js";
import {
  setOpenAiClientForTests,
  type OpenAiClient,
} from "../src/generation/openai-client.js";
import { createScene } from "../src/tools/create-scene.js";
import { generateAsset } from "../src/tools/generate-asset.js";
import type { CallerContext } from "../src/auth/tenant-context.js";

const ctx: CallerContext = {
  tenantId: "tenant-gen",
  userId: "creator-gen",
  role: "creator",
};

function mockClient(overrides: Partial<OpenAiClient>): OpenAiClient {
  return {
    generateCopy: vi.fn(async (prompt, options) => ({
      text:
        options.characterLimit && prompt.length > options.characterLimit
          ? prompt.slice(0, options.characterLimit)
          : prompt,
      attempts: 1,
    })),
    generateImage: vi.fn(async () => ({
      base64: "aGVsbG8=",
      mimeType: "image/png",
    })),
    moderateText: vi.fn(async () => false),
    moderateImage: vi.fn(async () => false),
    ...overrides,
  };
}

describe("generate_asset", () => {
  afterEach(async () => {
    clearJobRegistry();
    await clearAuditLogForTests();
    setOpenAiClientForTests(undefined);
    delete process.env.OPENAI_API_KEY;
  });

  it("returns a fill on a block for copy generation", async () => {
    process.env.OPENAI_API_KEY = "sk-test-should-not-leak";
    setOpenAiClientForTests(mockClient({}));

    const scene = await createScene(ctx, {
      width: 400,
      height: 400,
      layout: "Free",
    });

    const result = await generateAsset(ctx, {
      jobId: scene.jobId,
      assetType: "copy",
      prompt: "Summer sale headline",
      characterLimit: 40,
    });

    expect(result.realizedAsFill).toBe(true);
    expect(result.appliedToBlockId).toBeDefined();
    expect(JSON.stringify(result)).not.toContain("sk-test-should-not-leak");
  });

  it("regenerates until within characterLimit", async () => {
    const generateCopy = vi
      .fn()
      .mockResolvedValueOnce({ text: "x".repeat(50), attempts: 1 })
      .mockResolvedValueOnce({ text: "Short headline", attempts: 2 });

    setOpenAiClientForTests(mockClient({ generateCopy }));

    const scene = await createScene(ctx, {
      width: 400,
      height: 400,
      layout: "Free",
    });

    await generateAsset(ctx, {
      jobId: scene.jobId,
      assetType: "copy",
      prompt: "Long prompt",
      characterLimit: 20,
    });

    expect(generateCopy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("blocks unsafe generated asset at checkpoint 2 and audits", async () => {
    setOpenAiClientForTests(
      mockClient({
        moderateImage: vi.fn(async () => true),
      }),
    );

    const scene = await createScene(ctx, {
      width: 400,
      height: 400,
      layout: "Free",
    });

    await expect(
      generateAsset(ctx, {
        jobId: scene.jobId,
        assetType: "background",
        prompt: "Generated background",
      }),
    ).rejects.toThrow(/Checkpoint 2/);
  });
});
