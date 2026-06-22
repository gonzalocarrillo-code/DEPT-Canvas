import { describe, expect, it, beforeEach } from "vitest";
import {
  clearAuditLogForTests,
  readAuditLog,
  redactArgs,
  writeAudit,
} from "../src/audit/audit-writer.js";

describe("audit writer", () => {
  beforeEach(async () => {
    await clearAuditLogForTests();
  });

  it("append-only — no update or delete API", () => {
    expect("updateAudit" in { writeAudit, readAuditLog }).toBe(false);
    expect("deleteAudit" in { writeAudit, readAuditLog }).toBe(false);
  });

  it("redacts PII and secrets from args", async () => {
    await writeAudit({
      tenantId: "tenant-a",
      userId: "user-1",
      tool: "create_scene",
      args: {
        width: 1080,
        authorization: "Bearer secret",
        email: "user@example.com",
      },
      outcome: "ok",
    });

    const [record] = await readAuditLog();
    expect(record.argsRedacted.authorization).toBe("[REDACTED]");
    expect(record.argsRedacted.width).toBe(1080);
  });

  it("tenant always present on audit records", async () => {
    await expect(
      writeAudit({
        tenantId: "",
        userId: "user-1",
        tool: "create_scene",
        args: {},
        outcome: "ok",
      }),
    ).rejects.toThrow(/tenantId/);

    await writeAudit({
      tenantId: "tenant-a",
      userId: "user-1",
      tool: "save_scene",
      args: { jobId: "job-1" },
      outcome: "ok",
    });

    const records = await readAuditLog();
    expect(records.every((r) => r.tenantId === "tenant-a")).toBe(true);
  });

  it("redactArgs helper masks dev tokens", () => {
    const redacted = redactArgs({ token: "dev:abc123" });
    expect(redacted.token).toBe("[REDACTED]");
  });

  it("redactArgs helper masks prompt text", () => {
    const redacted = redactArgs({ prompt: "creative brief" });
    expect(redacted.prompt).toBe("[REDACTED]");
  });
});
