import type { Job, LockManifest } from "../engine/job-registry.js";

export type { LockManifest };

export interface LockSelector {
  blockId?: number;
  kind?: string;
  name?: string;
  role?: string;
}

export function normalizeManifest(manifest: LockManifest): LockManifest {
  return {
    templateId: manifest.templateId,
    version: manifest.version,
    frozen: manifest.frozen.map((entry) => ({
      selector: { ...entry.selector },
      properties: entry.properties,
    })),
  };
}

function blockMatchesSelector(
  job: Job,
  blockId: number,
  selector: LockSelector,
): boolean {
  const { engine } = job;

  if (selector.blockId !== undefined && selector.blockId !== blockId) {
    return false;
  }

  if (selector.kind !== undefined) {
    const kind = engine.block.getKind(blockId);
    if (kind !== selector.kind) {
      return false;
    }
  }

  if (selector.name !== undefined) {
    const name = engine.block.getName(blockId);
    if (name !== selector.name) {
      return false;
    }
  }

  if (selector.role !== undefined) {
    let role: string | undefined;
    try {
      role = engine.block.getString(blockId, "metadata/role");
    } catch {
      return false;
    }
    if (role !== selector.role) {
      return false;
    }
  }

  return true;
}

export function isLocked(
  job: Job,
  blockId: number,
  property: string,
): boolean {
  if (!job.lockManifest) {
    return false;
  }

  for (const entry of job.lockManifest.frozen) {
    if (!blockMatchesSelector(job, blockId, entry.selector)) {
      continue;
    }
    if (
      entry.properties === "*" ||
      entry.properties.includes(property)
    ) {
      return true;
    }
  }

  return false;
}

export function listLockedProperties(
  job: Job,
  blockId: number,
): string[] {
  if (!job.lockManifest) {
    return [];
  }

  const locked = new Set<string>();
  for (const entry of job.lockManifest.frozen) {
    if (!blockMatchesSelector(job, blockId, entry.selector)) {
      continue;
    }
    if (entry.properties === "*") {
      locked.add("*");
    } else {
      for (const property of entry.properties) {
        locked.add(property);
      }
    }
  }
  return [...locked];
}
