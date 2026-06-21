import { randomUUID } from "node:crypto";
import {
  acquireJobSlot,
  releaseJobSlot,
} from "./engine-pool.js";
import {
  CreativeEngine,
  initCreativeEngine,
  type CreativeEngineInstance,
} from "./cesdk.js";

export interface LockManifest {
  templateId: string;
  version: string;
  frozen: Array<{
    selector: {
      blockId?: number;
      kind?: string;
      name?: string;
      role?: string;
    };
    properties: string[] | "*";
  }>;
}

export interface BrandKit {
  [key: string]: unknown;
}

export interface Job {
  id: string;
  tenantId: string;
  engine: CreativeEngineInstance;
  sceneId: number;
  lockManifest?: LockManifest;
  brandKit?: BrandKit;
}

const jobs = new Map<string, Job>();

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

export function listJobs(): Job[] {
  return [...jobs.values()];
}

export async function createJob(tenantId: string): Promise<Job> {
  acquireJobSlot();

  let engine: CreativeEngineInstance;
  try {
    engine = await initCreativeEngine();
  } catch (err) {
    releaseJobSlot();
    throw err;
  }

  try {
    const sceneId = engine.scene.create("Free");
    const job: Job = {
      id: randomUUID(),
      tenantId,
      engine,
      sceneId,
    };
    jobs.set(job.id, job);
    return job;
  } catch (err) {
    releaseJobSlot(engine);
    throw err;
  }
}

/** Remove job from registry and dispose its engine. */
export function releaseJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  if (!job) {
    return false;
  }
  jobs.delete(jobId);
  releaseJobSlot(job.engine);
  return true;
}

export function clearJobRegistry(): void {
  for (const job of jobs.values()) {
    releaseJobSlot(job.engine);
  }
  jobs.clear();
}

export { CreativeEngine };
