import { readFileSync } from "node:fs";
import { getJob, listJobs } from "../engine/job-registry.js";
import { setTypedProperty } from "../engine/property-io.js";
import { queryAnimatable } from "../engine/query-animatable.js";
import {
  enforceMotionWrite,
  LockViolation,
  MOTION_POSITION_KEYS,
  STAGGER_TIME_OFFSET_KEY,
} from "../locks/enforce.js";
import {
  animationShorthandFromType,
  resolveIntentEntry,
} from "./intent-map.js";
import type {
  MotionCapabilities,
  MotionEngine,
  MotionResult,
  Tier2Candidate,
} from "./motion-engine.js";
import { recordTier2Candidate } from "./tier2-metric.js";

function tier2(reason: string): Tier2Candidate {
  recordTier2Candidate(reason);
  return { tier2Candidate: true, reason };
}

function requireJobForTenant(jobId: string, tenantId: string) {
  const job = getJob(jobId);
  if (!job) {
    throw new Error(`Unknown jobId: ${jobId}`);
  }
  if (job.tenantId !== tenantId) {
    throw new Error("Job does not belong to caller tenant");
  }
  return job;
}

function detectTier2Request(
  intent: string,
  params?: Record<string, number | string>,
): Tier2Candidate | undefined {
  const normalized = intent.toLowerCase();
  if (
    normalized.includes("transition") ||
    params?.transition === "true"
  ) {
    return tier2("Scene-to-scene transitions require Tier 2");
  }
  if (
    normalized.includes("group") ||
    params?.groupAnimation === "true" ||
    params?.group === "true"
  ) {
    return tier2("Group animation requires Tier 2");
  }
  if (
    params?.customBezier ||
    params?.bezierControlPoints ||
    params?.keyframeTracks ||
    normalized.includes("custom_bezier")
  ) {
    return tier2("Custom bezier / multi-keyframe tracks require Tier 2");
  }
  return undefined;
}

function loadEasingsFromReport(): string[] {
  const reportPath = new URL("../engine/capability-report.json", import.meta.url);
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
    animationEasing: string[];
  };
  return report.animationEasing;
}

export class CesdkMotionEngine implements MotionEngine {
  capabilities(): MotionCapabilities {
    const jobs = listJobs();
    const easings =
      jobs.length > 0
        ? queryAnimatable(jobs[0]!.engine, jobs[0]!.sceneId).easingOptions
        : loadEasingsFromReport();

    return {
      keyframeTracks: false,
      customBezier: false,
      easings,
      groupAnimation: false,
      transitions: false,
    };
  }

  async applyIntent(
    jobId: string,
    tenantId: string,
    userId: string,
    blockId: number,
    intent: string,
    params?: Record<string, number | string>,
  ): Promise<MotionResult | Tier2Candidate> {
    const tier2Signal = detectTier2Request(intent, params);
    if (tier2Signal) {
      return tier2Signal;
    }

    const entry = resolveIntentEntry(intent);
    if (!entry) {
      throw new Error(`Unknown motion intent: ${intent}`);
    }

    const job = requireJobForTenant(jobId, tenantId);
    const mergedParams = { ...entry.params, ...params };
    const affected = [
      ...MOTION_POSITION_KEYS,
      ...Object.keys(mergedParams),
      "animationEasing",
      "playback/duration",
    ];

    await enforceMotionWrite(job, blockId, affected, {
      tenantId,
      userId,
      tool: "apply_intent",
      args: { jobId, blockId, intent, params },
    });

    const shorthand = animationShorthandFromType(entry.animation_type);
    const animId = job.engine.block.createAnimation(shorthand);
    job.engine.block.setInAnimation(blockId, animId);

    for (const [key, value] of Object.entries(mergedParams)) {
      setTypedProperty(job.engine, animId, key, value);
    }

    const composed = entry.needs_review === true;
    return {
      realizedAs: composed ? "composed" : "native",
      appliedPresets: [entry.animation_type],
    };
  }

  async stagger(
    jobId: string,
    tenantId: string,
    userId: string,
    blockIds: number[],
    timing: { stepSec: number },
  ): Promise<MotionResult | Tier2Candidate> {
    const job = requireJobForTenant(jobId, tenantId);

    for (const blockId of blockIds) {
      await enforceMotionWrite(job, blockId, [STAGGER_TIME_OFFSET_KEY], {
        tenantId,
        userId,
        tool: "stagger",
        args: { blockIds, stepSec: timing.stepSec },
      });
    }

    blockIds.forEach((blockId, index) => {
      const offset = timing.stepSec * index;
      try {
        setTypedProperty(job.engine, blockId, STAGGER_TIME_OFFSET_KEY, offset);
      } catch {
        job.engine.block.setFloat(blockId, STAGGER_TIME_OFFSET_KEY, offset);
      }
    });

    return {
      realizedAs: "composed",
      appliedPresets: blockIds.map(() => "stagger-offset"),
    };
  }

  async setTiming(
    jobId: string,
    tenantId: string,
    userId: string,
    blockId: number,
    timing: { start: number; duration: number },
  ): Promise<MotionResult | Tier2Candidate> {
    const job = requireJobForTenant(jobId, tenantId);
    const keys = ["playback/timeOffset", "playback/duration"];

    await enforceMotionWrite(job, blockId, keys, {
      tenantId,
      userId,
      tool: "set_timing",
      args: { blockId, ...timing },
    });

    setTypedProperty(job.engine, blockId, "playback/timeOffset", timing.start);
    setTypedProperty(job.engine, blockId, "playback/duration", timing.duration);

    return {
      realizedAs: "native",
      appliedPresets: ["playback-timing"],
    };
  }

  async sequence(
    jobId: string,
    tenantId: string,
    userId: string,
    sceneIds: number[],
    offsets: number[],
  ): Promise<MotionResult | Tier2Candidate> {
    if (sceneIds.length > 1 && offsets.some((_, index) => index > 0)) {
      return tier2("Cross-scene transitions require Tier 2");
    }

    const job = requireJobForTenant(jobId, tenantId);
    for (let i = 0; i < sceneIds.length; i += 1) {
      const pageId = sceneIds[i]!;
      const offset = offsets[i] ?? 0;
      await enforceMotionWrite(job, pageId, ["playback/timeOffset"], {
        tenantId,
        userId,
        tool: "sequence",
        args: { sceneIds, offsets },
      });
      try {
        setTypedProperty(job.engine, pageId, "playback/timeOffset", offset);
      } catch {
        job.engine.block.setFloat(pageId, "playback/timeOffset", offset);
      }
    }

    return {
      realizedAs: "composed",
      appliedPresets: sceneIds.map(() => "sequence-offset"),
    };
  }

  async render(sceneRef: string, format: "mp4" | "png" | "pdf"): Promise<string> {
    const { renderOutput } = await import("@dept-canvas/renderer/cesdk-render");
    const tenantMatch = sceneRef.match(/^tenant\/([^/]+)\//);
    const tenantId = tenantMatch?.[1] ?? "unknown";
    const result = await renderOutput(tenantId, sceneRef, {
      width: 1080,
      height: 1080,
      format,
    });
    return result.outputRef;
  }
}

export { LockViolation };
