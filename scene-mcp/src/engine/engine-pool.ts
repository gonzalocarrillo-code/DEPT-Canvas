import type { CreativeEngineInstance } from "./cesdk.js";

const DEFAULT_MAX_JOBS = 8;

function maxConcurrentJobs(): number {
  const raw = process.env.ENGINE_POOL_MAX_JOBS;
  if (!raw) {
    return DEFAULT_MAX_JOBS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_JOBS;
}

let activeJobs = 0;

export class EnginePoolCapacityError extends Error {
  constructor(max: number) {
    super(`Engine pool at capacity (${max} concurrent jobs)`);
    this.name = "EnginePoolCapacityError";
  }
}

export function getActiveJobCount(): number {
  return activeJobs;
}

export function getMaxConcurrentJobs(): number {
  return maxConcurrentJobs();
}

/** Reserve a slot before initializing an engine. */
export function acquireJobSlot(): void {
  const max = maxConcurrentJobs();
  if (activeJobs >= max) {
    throw new EnginePoolCapacityError(max);
  }
  activeJobs += 1;
}

/** Release a slot; dispose the engine when provided (save/timeout path). */
export function releaseJobSlot(engine?: CreativeEngineInstance): void {
  if (activeJobs > 0) {
    activeJobs -= 1;
  }
  if (engine && typeof engine.dispose === "function") {
    engine.dispose();
  }
}
