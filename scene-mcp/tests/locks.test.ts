import { afterEach, describe, expect, it } from "vitest";
import { clearAuditLogForTests, readAuditLog } from "../src/audit/audit-writer.js";
import { clearJobRegistry, createJob, releaseJob } from "../src/engine/job-registry.js";
import {
  resolveFillColorKey,
  setTypedProperty,
} from "../src/engine/property-io.js";
import {
  enforceMotionWrite,
  MOTION_POSITION_KEYS,
  STAGGER_TIME_OFFSET_KEY,
} from "../src/locks/enforce.js";
import { applyLockManifest } from "../src/tools/apply-lock-manifest.js";
import { createScene } from "../src/tools/create-scene.js";
import { setProperties } from "../src/tools/set-properties.js";
import type { CallerContext } from "../src/auth/tenant-context.js";

const ctx: CallerContext = {
  tenantId: "tenant-locks",
  userId: "brand-owner-1",
  role: "brand_owner",
};

function discoverPositionKeys(
  engine: Awaited<ReturnType<typeof createJob>>["engine"],
  blockId: number,
): string[] {
  const props: string[] = engine.block.findAllProperties(blockId);
  const candidates = props.filter(
    (key) =>
      key === "position/x" ||
      key === "position/y" ||
      key.includes("/position/") ||
      key.endsWith("/x") ||
      key.endsWith("/y"),
  );
  if (candidates.length >= 2) {
    return candidates.slice(0, 2);
  }
  return [...MOTION_POSITION_KEYS];
}

async function setupLockedGraphic() {
  const scene = await createScene(ctx, {
    width: 800,
    height: 600,
    layout: "Free",
  });
  const job = (await import("../src/engine/job-registry.js")).getJob(
    scene.jobId,
  )!;

  const logo = job.engine.block.create("graphic");
  job.engine.block.setName(logo, "logo");
  job.engine.block.appendChild(scene.pageId, logo);
  const fill = job.engine.block.createFill("color");
  job.engine.block.setFill(logo, fill);

  const positionKeys = discoverPositionKeys(job.engine, logo);
  const fillKey = resolveFillColorKey(job.engine);

  await applyLockManifest(ctx, {
    jobId: scene.jobId,
    manifest: {
      templateId: "brand-master",
      version: "1",
      frozen: [
        {
          selector: { blockId: logo, name: "logo" },
          properties: [...positionKeys, fillKey],
        },
      ],
    },
  });

  return { scene, job, logo, positionKeys, fillKey };
}

describe("locks.test.ts guarantees", () => {
  afterEach(() => {
    clearJobRegistry();
    clearAuditLogForTests();
  });

  it("rejects_locked_logo_move", async () => {
    const { scene, logo, positionKeys } = await setupLockedGraphic();

    await expect(
      setProperties(ctx, {
        jobId: scene.jobId,
        blockId: logo,
        properties: [{ key: positionKeys[0]!, value: 120 }],
      }),
    ).rejects.toThrow(/locked/i);
  });

  it("rejects_locked_brand_colour_change", async () => {
    const { scene, logo, fillKey } = await setupLockedGraphic();

    await expect(
      setProperties(ctx, {
        jobId: scene.jobId,
        blockId: logo,
        properties: [
          { key: fillKey, value: { r: 0, g: 1, b: 0, a: 1 } },
        ],
      }),
    ).rejects.toThrow(/locked/i);
  });

  it("rejects_motion_intent_moving_locked_position", async () => {
    const { scene, job, logo, positionKeys } = await setupLockedGraphic();

    await expect(
      enforceMotionWrite(job, logo, positionKeys, {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        tool: "apply_intent",
        args: { intent: "energetic_entrance", blockId: logo },
      }),
    ).rejects.toThrow(/locked/i);
  });

  it("rejects_stagger_moving_locked_position", async () => {
    const { scene, job, logo } = await setupLockedGraphic();

    await applyLockManifest(ctx, {
      jobId: scene.jobId,
      manifest: {
        templateId: "brand-master",
        version: "1",
        frozen: [
          {
            selector: { blockId: logo },
            properties: [STAGGER_TIME_OFFSET_KEY],
          },
        ],
      },
    });

    await expect(
      enforceMotionWrite(job, logo, [STAGGER_TIME_OFFSET_KEY], {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        tool: "stagger",
        args: { blockIds: [logo], stepSec: 0.2 },
      }),
    ).rejects.toThrow(/locked/i);
  });

  it("every_rejection_writes_audit", async () => {
    const { scene, logo, positionKeys } = await setupLockedGraphic();
    clearAuditLogForTests();

    await expect(
      setProperties(ctx, {
        jobId: scene.jobId,
        blockId: logo,
        properties: [{ key: positionKeys[0]!, value: 50 }],
      }),
    ).rejects.toThrow();

    const rejections = readAuditLog().filter(
      (entry) => entry.lockDecision?.outcome === "rejected",
    );
    expect(rejections.length).toBeGreaterThanOrEqual(1);
    expect(rejections[0]?.tenantId).toBe(ctx.tenantId);
    expect(rejections[0]?.lockDecision?.property).toBe(positionKeys[0]);
  });

  it("lock_cannot_be_overridden_by_prompt_text", async () => {
    const { scene, logo, fillKey } = await setupLockedGraphic();

    await expect(
      setProperties(ctx, {
        jobId: scene.jobId,
        blockId: logo,
        properties: [
          {
            key: fillKey,
            value: { r: 1, g: 0, b: 0, a: 1 },
          },
        ],
      }),
    ).rejects.toThrow(/locked/i);

    const job = (await import("../src/engine/job-registry.js")).getJob(
      scene.jobId,
    )!;
    const current = job.engine.block.getColor(logo, fillKey);
    expect(current.r).not.toBe(1);
  });

  it("atomic_reject_when_any_property_locked", async () => {
    const job = await createJob(ctx.tenantId);
    try {
      const page = job.engine.block.create("page");
      job.engine.block.appendChild(job.sceneId, page);
      const block = job.engine.block.create("graphic");
      job.engine.block.appendChild(page, block);
      const fillKey = resolveFillColorKey(job.engine);
      const fill = job.engine.block.createFill("color");
      job.engine.block.setFill(block, fill);
      setTypedProperty(job.engine, block, fillKey, {
        r: 0.1,
        g: 0.2,
        b: 0.3,
        a: 1,
      });

      job.lockManifest = {
        templateId: "t",
        version: "1",
        frozen: [
          { selector: { blockId: block }, properties: [fillKey] },
        ],
      };

      const positionKeys = discoverPositionKeys(job.engine, block);
      await expect(
        enforceMotionWrite(job, block, [positionKeys[0]!, fillKey], {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          tool: "set_properties",
        }),
      ).rejects.toThrow();

      const after = job.engine.block.getColor(block, fillKey);
      expect(after.r).toBeCloseTo(0.1, 3);
    } finally {
      releaseJob(job.id);
    }
  });
});
