import { afterEach, describe, expect, it } from "vitest";
import { clearAuditLogForTests, readAuditLog } from "../src/audit/audit-writer.js";
import { importPsd } from "../src/tools/import-psd.js";
import type { CallerContext } from "../src/auth/tenant-context.js";

// The functional parse (CE.SDK engine) is license-gated — verified manually with
// CESDK_LICENSE + a real .psd (see RUN_LOCAL). Headlessly we verify the security
// boundary, which runs BEFORE the engine is touched.
describe("import_psd security boundary", () => {
  afterEach(async () => {
    await clearAuditLogForTests();
  });

  it("denies a viewer (needs scene:create) before any engine init, and audits it", async () => {
    const ctx: CallerContext = { tenantId: "tenant-a", userId: "u", role: "viewer" };
    await expect(importPsd(ctx, { psd: "AAAA" })).rejects.toThrow();
    const record = (await readAuditLog()).at(-1);
    expect(record?.tool).toBe("import_psd");
    expect(record?.outcome).toBe("error");
  });
});
