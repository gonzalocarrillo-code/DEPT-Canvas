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

describe("audit-sink.test.ts", () => {
  let tempDir: string;
  let sinkPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "dept-canvas-audit-"));
    sinkPath = join(tempDir, "audit.ndjson");
    process.env.AUDIT_SINK_PATH = sinkPath;
    resetAuditSinkForTests();
    configureAuditSink();
  });

  afterEach(() => {
    delete process.env.AUDIT_SINK_PATH;
    resetAuditSinkForTests();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("persists_records_to_durable_append_only_sink", async () => {
    await writeAudit({
      tenantId: "tenant-a",
      userId: "user-1",
      tool: "create_scene",
      args: { width: 1080 },
      outcome: "ok",
    });

    resetAuditSinkForTests();
    configureAuditSink();

    const records = await readAuditLog();
    expect(records).toHaveLength(1);
    expect(records[0]?.tool).toBe("create_scene");
  });

  it("redacts_prompt_and_free_text_by_default", async () => {
    await writeAudit({
      tenantId: "tenant-a",
      userId: "user-1",
      tool: "generate_asset",
      args: {
        prompt: "secret creative brief text",
        brief: "launch campaign copy",
        width: 1080,
      },
      outcome: "ok",
    });

    const [record] = await readAuditLog();
    expect(record.argsRedacted.prompt).toBe("[REDACTED]");
    expect(record.argsRedacted.brief).toBe("[REDACTED]");
    expect(record.argsRedacted.width).toBe(1080);
  });

  it("lock_rejection_produces_immutable_record", async () => {
    await writeAudit({
      tenantId: "tenant-a",
      userId: "user-1",
      tool: "set_properties",
      args: { blockId: "logo", properties: { x: 10 } },
      lockDecision: { property: "x", outcome: "rejected" },
      outcome: "error",
      detail: "locked property",
    });

    const records = await readAuditLog();
    expect(records[0]?.lockDecision?.outcome).toBe("rejected");
    expect(records[0]?.outcome).toBe("error");
  });

  it("redactArgs_masks_prompt_keys", () => {
    const redacted = redactArgs({
      free_text: "do not store",
      message: "hello",
      jobId: "job-1",
    });
    expect(redacted.free_text).toBe("[REDACTED]");
    expect(redacted.message).toBe("[REDACTED]");
    expect(redacted.jobId).toBe("job-1");
  });

  it("append_only_no_update_or_delete_api", async () => {
    await clearAuditLogForTests();
    expect("updateAudit" in { writeAudit, readAuditLog }).toBe(false);
    expect("deleteAudit" in { writeAudit, readAuditLog }).toBe(false);
  });
});
