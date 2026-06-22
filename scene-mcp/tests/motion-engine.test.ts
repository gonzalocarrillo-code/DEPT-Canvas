import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { clearAuditLogForTests, readAuditLog } from "../src/audit/audit-writer.js";
import { clearJobRegistry, createJob, releaseJob } from "../src/engine/job-registry.js";
import { CesdkMotionEngine } from "../src/motion/cesdk-motion-engine.js";
import { getMotionEngine, setMotionEngineForTests } from "../src/motion/engine-registry.js";
import { isTier2Candidate } from "../src/motion/motion-engine.js";
import {
  readTier2CandidateMetric,
  resetTier2CandidateMetricForTests,
} from "../src/motion/tier2-metric.js";
import type { CallerContext } from "../src/auth/tenant-context.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reportPath = path.resolve(__dirname, "../src/engine/capability-report.json");

const ctx: CallerContext = {
  tenantId: "tenant-motion",
  userId: "creator-motion",
  role: "creator",
};

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

describe("motion-engine.test.ts", () => {
  afterEach(() => {
    clearJobRegistry();
    clearAuditLogForTests();
    resetTier2CandidateMetricForTests();
    setMotionEngineForTests(undefined);
  });

  it("capabilities() reports keyframeTracks:false/customBezier:false and live easings", async () => {
    const job = await createJob(ctx.tenantId);
    try {
      setMotionEngineForTests(new CesdkMotionEngine());
      const caps = getMotionEngine().capabilities();
      const onDisk = JSON.parse(readFileSync(reportPath, "utf8")) as {
        animationEasing: string[];
      };

      expect(caps.keyframeTracks).toBe(false);
      expect(caps.customBezier).toBe(false);
      expect(caps.groupAnimation).toBe(false);
      expect(caps.transitions).toBe(false);
      expect(caps.easings.length).toBe(onDisk.animationEasing.length);
      expect(caps.easings).toEqual(onDisk.animationEasing);
      expect(caps.easings).toContain("EaseInBack");
      expect(caps.easings).toContain("EaseOutSpring");
    } finally {
      releaseJob(job.id);
    }
  });

  it("apply_intent('energetic_entrance') returns native|composed with a real preset", async () => {
    const job = await createJob(ctx.tenantId);
    try {
      setMotionEngineForTests(new CesdkMotionEngine());
      const page = job.engine.block.create("page");
      job.engine.block.appendChild(job.sceneId, page);
      const text = job.engine.block.create("text");
      job.engine.block.replaceText(text, "Headline");
      job.engine.block.appendChild(page, text);

      const result = await getMotionEngine().applyIntent(
        job.id,
        ctx.tenantId,
        ctx.userId,
        text,
        "energetic_entrance",
      );

      expect(isTier2Candidate(result)).toBe(false);
      if (!isTier2Candidate(result)) {
        expect(["native", "composed"]).toContain(result.realizedAs);
        expect(result.appliedPresets[0]).toContain("/animation/pop");
      }
    } finally {
      releaseJob(job.id);
    }
  });

  it("tier2_candidate_signalled_not_faked", async () => {
    const job = await createJob(ctx.tenantId);
    try {
      setMotionEngineForTests(new CesdkMotionEngine());
      const before = readTier2CandidateMetric();
      const page = job.engine.block.create("page");
      job.engine.block.appendChild(job.sceneId, page);
      const text = job.engine.block.create("text");
      job.engine.block.appendChild(page, text);

      const result = await getMotionEngine().applyIntent(
        job.id,
        ctx.tenantId,
        ctx.userId,
        text,
        "custom_bezier_motion",
        { customBezier: "0.1,0.2,0.3,0.4" },
      );

      expect(isTier2Candidate(result)).toBe(true);
      expect(readTier2CandidateMetric()).toBe(before + 1);
    } finally {
      releaseJob(job.id);
    }
  });

  it("motion_respects_locks", async () => {
    const job = await createJob(ctx.tenantId);
    try {
      setMotionEngineForTests(new CesdkMotionEngine());
      const page = job.engine.block.create("page");
      job.engine.block.appendChild(job.sceneId, page);
      const text = job.engine.block.create("text");
      job.engine.block.appendChild(page, text);

      job.lockManifest = {
        templateId: "t",
        version: "1",
        frozen: [
          {
            selector: { blockId: text },
            properties: ["position/x", "position/y"],
          },
        ],
      };

      await expect(
        getMotionEngine().applyIntent(
          job.id,
          ctx.tenantId,
          ctx.userId,
          text,
          "energetic_entrance",
        ),
      ).rejects.toThrow(/locked/i);

      const rejections = readAuditLog().filter(
        (entry) => entry.lockDecision?.outcome === "rejected",
      );
      expect(rejections.length).toBeGreaterThanOrEqual(1);
    } finally {
      releaseJob(job.id);
    }
  });

  it("no_engine_leak_above_interface", () => {
    const toolsDir = path.resolve(__dirname, "../src/tools");
    const orchestrationDir = path.resolve(__dirname, "../../orchestration");
    const forbidden = ["@cesdk/node", "cesdk-motion-engine"];
    const files = [
      ...collectSourceFiles(toolsDir),
      ...collectSourceFiles(orchestrationDir),
    ];

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        expect(content, `${file} must not import ${pattern}`).not.toMatch(
          new RegExp(`from\\s+['"]${pattern.replace("/", "\\/")}['"]`),
        );
      }
    }
  });
});
