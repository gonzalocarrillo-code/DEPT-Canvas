import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AuditRecord } from "./audit-record.js";

export interface AuditSink {
  append(record: AuditRecord): Promise<void>;
  readAll(): Promise<readonly AuditRecord[]>;
  clearForTests(): Promise<void>;
}

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
    writeFileSync(this.filePath, "", "utf8");
  }
}

class InMemoryAuditSink implements AuditSink {
  private records: AuditRecord[] = [];

  async append(record: AuditRecord): Promise<void> {
    this.records.push(Object.freeze({ ...record }));
  }

  async readAll(): Promise<readonly AuditRecord[]> {
    return [...this.records];
  }

  async clearForTests(): Promise<void> {
    this.records.length = 0;
  }
}

let activeSink: AuditSink | undefined;

export function configureAuditSink(sink?: AuditSink): AuditSink {
  if (sink) {
    activeSink = sink;
    return sink;
  }

  const path = process.env.AUDIT_SINK_PATH;
  if (path) {
    activeSink = new FileAuditSink(path);
    return activeSink;
  }

  activeSink = new InMemoryAuditSink();
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
