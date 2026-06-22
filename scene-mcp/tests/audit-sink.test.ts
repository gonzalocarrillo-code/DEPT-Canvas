import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
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
  let logLines: string[];

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "dept-canvas-audit-"));
    sinkPath = join(tempDir, "audit.ndjson");
    process.env.AUDIT_SINK_PATH = sinkPath;
    logLines = [];
    resetAuditSinkForTests();
    configureAuditSink();
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      logLines.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.AUDIT_SINK_PATH;
    resetAuditSinkForTests();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("persists_records_across_process_restart", async () => {
    const first = await writeAudit({
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
    expect(records[0]?.id).toBe(first.id);
    expect(records[0]?.tool).toBe("create_scene");
  });

  it("delivers_structured_logs_for_cmek_bucket_pipeline", async () => {
    await writeAudit({
      tenantId: "tenant-a",
      userId: "user-1",
      tool: "save_scene",
      args: { jobId: "job-1" },
      outcome: "ok",
    });

    expect(logLines.some((line) => line.includes('"audit_event":true'))).toBe(
      true,
    );
    const fileBody = readFileSync(sinkPath, "utf8");
    expect(fileBody.trim().length).toBeGreaterThan(0);
  });

  it("redacts_free_text_values_under_allowlisted_key_names", async () => {
    const secretIntent = "secret creative brief phrase must not persist";
    await writeAudit({
      tenantId: "tenant-a",
      userId: "user-1",
      tool: "apply_intent",
      args: { intent: secretIntent, blockId: "block-1" },
      outcome: "ok",
    });

    const [record] = await readAuditLog();
    expect(record.argsRedacted.intent).toBe("[REDACTED]");
    expect(record.argsRedacted.blockId).toBe("block-1");

    const fileBody = readFileSync(sinkPath, "utf8");
    expect(fileBody.includes(secretIntent)).toBe(false);
  });

  it("redacts_unknown_keys_via_allow_list", async () => {
    await writeAudit({
      tenantId: "tenant-a",
      userId: "user-1",
      tool: "generate_asset",
      args: {
        prompt: "secret creative brief text",
        brief: "launch campaign copy",
        width: 1080,
        nested: { message: "nested secret", jobId: "job-1" },
      },
      outcome: "ok",
    });

    const [record] = await readAuditLog();
    expect(record.argsRedacted.prompt).toBe("[REDACTED]");
    expect(record.argsRedacted.brief).toBe("[REDACTED]");
    expect(record.argsRedacted.width).toBe(1080);
    expect((record.argsRedacted.nested as Record<string, unknown>).message).toBe(
      "[REDACTED]",
    );
    expect((record.argsRedacted.nested as Record<string, unknown>).jobId).toBe(
      "job-1",
    );
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

  it("append_only_sink_grows_monotonically", async () => {
    await writeAudit({
      tenantId: "tenant-a",
      userId: "user-1",
      tool: "create_scene",
      args: { width: 100 },
      outcome: "ok",
    });
    await writeAudit({
      tenantId: "tenant-a",
      userId: "user-2",
      tool: "save_scene",
      args: { jobId: "job-2" },
      outcome: "ok",
    });

    const beforeRestart = await readAuditLog();
    expect(beforeRestart).toHaveLength(2);

    resetAuditSinkForTests();
    configureAuditSink();
    const afterRestart = await readAuditLog();
    expect(afterRestart).toHaveLength(2);
    expect(afterRestart.map((r) => r.id)).toEqual(
      beforeRestart.map((r) => r.id),
    );
  });

  it("redactArgs_allow_list_keeps_structural_ids_and_dimensions", () => {
    const redacted = redactArgs({
      free_text: "do not store",
      message: "hello",
      jobId: "job-1",
      width: 1920,
      intent: "energetic launch copy",
      enabled: true,
    });
    expect(redacted.free_text).toBe("[REDACTED]");
    expect(redacted.message).toBe("[REDACTED]");
    expect(redacted.jobId).toBe("job-1");
    expect(redacted.width).toBe(1920);
    expect(redacted.intent).toBe("[REDACTED]");
    expect(redacted.enabled).toBe("[REDACTED]");
  });
});
