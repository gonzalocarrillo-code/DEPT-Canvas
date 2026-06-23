import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAuditLogForTests, readAuditLog } from "../src/audit/audit-writer.js";
import {
  setOpenAiClientForTests,
  type OpenAiClient,
} from "../src/generation/openai-client.js";
import { generateAssetStandalone } from "../src/tools/generate-asset-standalone.js";
import type { CallerContext } from "../src/auth/tenant-context.js";

const ctx: CallerContext = {
  tenantId: "tenant-standalone",
  userId: "creator-standalone",
  role: "creator",
};

function mockClient(overrides: Partial<OpenAiClient> = {}): OpenAiClient {
  return {
    generateCopy: vi.fn(async (prompt: string, options) => ({
      text:
        options.characterLimit && prompt.length > options.characterLimit
          ? prompt.slice(0, options.characterLimit)
          : prompt,
      attempts: 1,
    })),
    generateImage: vi.fn(async () => ({ base64: "aGVsbG8=", mimeType: "image/png" })),
    moderateText: vi.fn(async () => false),
    moderateImage: vi.fn(async () => false),
    ...overrides,
  };
}

describe("generate_asset_standalone", () => {
  afterEach(async () => {
    await clearAuditLogForTests();
    setOpenAiClientForTests(undefined);
    delete process.env.OPENAI_API_KEY;
  });

  it("returns generated copy text (no key leak)", async () => {
    process.env.OPENAI_API_KEY = "sk-test-should-not-leak";
    setOpenAiClientForTests(mockClient());

    const out = await generateAssetStandalone(ctx, {
      assetType: "copy",
      prompt: "Summer sale headline",
      characterLimit: 40,
    });

    expect(out.kind).toBe("copy");
    expect(out.text).toBe("Summer sale headline");
    expect(out.dataUrl).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain("sk-test-should-not-leak");
  });

  it("returns an image data URL with tenant-scoped assetRef", async () => {
    setOpenAiClientForTests(mockClient());

    const out = await generateAssetStandalone(ctx, {
      assetType: "image",
      prompt: "penguins in many styles",
    });

    expect(out.kind).toBe("image");
    expect(out.dataUrl).toBe("data:image/png;base64,aGVsbG8=");
    expect(out.assetRef).toContain("tenant/tenant-standalone/assets/");
  });

  it("writes an audit record under the caller tenant", async () => {
    setOpenAiClientForTests(mockClient());
    await generateAssetStandalone(ctx, { assetType: "copy", prompt: "hi" });
    const log = await readAuditLog();
    const record = log.at(-1);
    expect(record?.tool).toBe("generate_asset_standalone");
    expect(record?.tenantId).toBe("tenant-standalone");
    expect(record?.outcome).toBe("ok");
  });

  it("blocks on input moderation (checkpoint 1) and audits the error", async () => {
    setOpenAiClientForTests(mockClient({ moderateText: vi.fn(async () => true) }));
    await expect(
      generateAssetStandalone(ctx, { assetType: "copy", prompt: "bad" }),
    ).rejects.toThrow(/Checkpoint 1/);
    const log = await readAuditLog();
    expect(log.at(-1)?.outcome).toBe("error");
  });

  it("blocks generated image on checkpoint 2", async () => {
    setOpenAiClientForTests(mockClient({ moderateImage: vi.fn(async () => true) }));
    await expect(
      generateAssetStandalone(ctx, { assetType: "image", prompt: "x" }),
    ).rejects.toThrow(/Checkpoint 2/);
  });

  it("denies a viewer (RBAC: needs scene:write)", async () => {
    setOpenAiClientForTests(mockClient());
    await expect(
      generateAssetStandalone({ ...ctx, role: "viewer" }, { assetType: "copy", prompt: "x" }),
    ).rejects.toThrow();
  });
});
