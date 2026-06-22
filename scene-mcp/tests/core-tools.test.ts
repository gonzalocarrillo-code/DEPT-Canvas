import { afterEach, describe, expect, it } from "vitest";
import { clearAuditLogForTests } from "../src/audit/audit-writer.js";
import { clearJobRegistry } from "../src/engine/job-registry.js";
import { resolveFillColorKey } from "../src/engine/property-io.js";
import { createScene } from "../src/tools/create-scene.js";
import { createBlock } from "../src/tools/create-block.js";
import { setProperties } from "../src/tools/set-properties.js";
import { saveScene } from "../src/tools/save-scene.js";
import {
  assertNoForbiddenTools,
  CORE_TOOL_NAMES,
} from "../src/tools/registry.js";
import type { CallerContext } from "../src/auth/tenant-context.js";

const creatorCtx: CallerContext = {
  tenantId: "tenant-test",
  userId: "creator-1",
  role: "creator",
};

describe("core MCP tools", () => {
  afterEach(async () => {
    clearJobRegistry();
    await clearAuditLogForTests();
  });

  it("registers core tools without forbidden destructive/keyframe tools", () => {
    assertNoForbiddenTools([...CORE_TOOL_NAMES]);
    expect(CORE_TOOL_NAMES).not.toContain("delete");
    expect(CORE_TOOL_NAMES).not.toContain("publish");
    expect(CORE_TOOL_NAMES).not.toContain("set_keyframe");
    expect(CORE_TOOL_NAMES).not.toContain("add_animation");
  });

  it("round-trip create_scene → create_block → set_properties → save_scene", async () => {
    const scene = await createScene(creatorCtx, {
      width: 800,
      height: 600,
      layout: "Free",
    });

    const block = await createBlock(creatorCtx, {
      jobId: scene.jobId,
      parentId: scene.pageId,
      type: "graphic",
    });

    const fillKey = resolveFillColorKey();
    expect(fillKey).toBe("fill/solid/color");

    const job = (await import("../src/engine/job-registry.js")).getJob(
      scene.jobId,
    )!;
    const fill = job.engine.block.createFill("color");
    job.engine.block.setFill(block.blockId, fill);

    const props = await setProperties(creatorCtx, {
      jobId: scene.jobId,
      blockId: block.blockId,
      properties: [
        {
          key: fillKey,
          value: { r: 1, g: 0, b: 0, a: 1 },
        },
      ],
    });

    expect(props.applied).toContain(fillKey);

    const saved = await saveScene(creatorCtx, {
      jobId: scene.jobId,
      archive: false,
    });

    expect(saved.sceneRef).toMatch(/^tenant\/tenant-test\/scenes\/.+\.scene$/);
    expect(saved.sceneRef).not.toMatch(/[\n\r]/);
  });
});
