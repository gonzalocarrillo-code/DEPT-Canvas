import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearAuditLogForTests,
  readAuditLog,
  redactArgs,
  writeAudit,
} from "../src/audit/audit-writer.js";
import {
  configureAuditSink,
  resetAuditSinkForTests,
} from "../src/audit/sink.js";

describe("audit writer", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "dept-canvas-audit-writer-"));
    process.env.AUDIT_SINK_PATH = join(tempDir, "audit.ndjson");
    resetAuditSinkForTests();
    configureAuditSink();
  });

  afterEach(async () => {
    await clearAuditLogForTests();
    delete process.env.AUDIT_SINK_PATH;
    resetAuditSinkForTests();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("redacts non-allowlisted args including email", async () => {
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
    expect(record.argsRedacted.email).toBe("[REDACTED]");
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

  it("redactArgs helper masks dev tokens and free text", () => {
    const redacted = redactArgs({ token: "dev:abc123", prompt: "creative brief" });
    expect(redacted.token).toBe("[REDACTED]");
    expect(redacted.prompt).toBe("[REDACTED]");
  });
});
