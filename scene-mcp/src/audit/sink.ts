import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { AuditRecord } from "./audit-record.js";

export interface AuditSink {
  append(record: AuditRecord): Promise<void>;
  readAll(): Promise<readonly AuditRecord[]>;
  clearForTests(): Promise<void>;
}

const DEFAULT_AUDIT_SINK_PATH = "/var/lib/dept-canvas/audit/audit.ndjson";

class FileAuditSink implements AuditSink {
  constructor(private readonly filePath: string) {}

  async append(record: AuditRecord): Promise<void> {
    mkdirSync(dirname(this.filePath), { recursive: true });
    appendFileSync(this.filePath, `${JSON.stringify(record)}\n`, "utf8");
  }

  async readAll(): Promise<readonly AuditRecord[]> {
    try {
      const raw = readFileSync(this.filePath, "utf8");
      return raw
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as AuditRecord);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async clearForTests(): Promise<void> {
    if (process.env.NODE_ENV !== "test" && process.env.ALLOW_AUDIT_SINK_TRUNCATION !== "true") {
      throw new Error("clearForTests is only permitted in test environments");
    }
    writeFileSync(this.filePath, "", "utf8");
  }
}

/**
 * Writes NDJSON to disk and emits structured logs for the Cloud Logging → GCS
 * pipeline configured in infra/shared/observability.tf (audit_event=true).
 */
class DurableAuditSink implements AuditSink {
  constructor(
    private readonly fileSink: FileAuditSink,
    private readonly logFn: (line: string) => void = (line) => {
      process.stdout.write(`${line}\n`);
    },
  ) {}

  async append(record: AuditRecord): Promise<void> {
    await this.fileSink.append(record);
    this.logFn(
      JSON.stringify({
        severity: "INFO",
        audit_event: true,
        ...record,
      }),
    );
  }

  async readAll(): Promise<readonly AuditRecord[]> {
    return this.fileSink.readAll();
  }

  async clearForTests(): Promise<void> {
    await this.fileSink.clearForTests();
  }
}

let activeSink: AuditSink | undefined;

function resolveSinkPath(): string {
  if (process.env.AUDIT_SINK_PATH) {
    return process.env.AUDIT_SINK_PATH;
  }
  if (process.env.NODE_ENV === "test") {
    return join(tmpdir(), "dept-canvas-test-audit.ndjson");
  }
  return DEFAULT_AUDIT_SINK_PATH;
}

export function configureAuditSink(sink?: AuditSink): AuditSink {
  if (sink) {
    activeSink = sink;
    return sink;
  }

  activeSink = new DurableAuditSink(new FileAuditSink(resolveSinkPath()));
  return activeSink;
}

export function getAuditSink(): AuditSink {
  if (!activeSink) {
    return configureAuditSink();
  }
  return activeSink;
}

export function resetAuditSinkForTests(): void {
  activeSink = undefined;
}

export function defaultAuditSinkPath(): string {
  return resolveSinkPath();
}
