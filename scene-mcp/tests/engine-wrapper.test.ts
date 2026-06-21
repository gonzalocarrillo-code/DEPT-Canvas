import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { CreativeEngine } from "../src/engine/cesdk.js";
import {
  clearJobRegistry,
  createJob,
  releaseJob,
} from "../src/engine/job-registry.js";
import {
  getFillColor,
  getTypedProperty,
  resolveFillColorKey,
  setFillColor,
  setTypedProperty,
  type ColorValue,
} from "../src/engine/property-io.js";
import { queryAnimatable } from "../src/engine/query-animatable.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reportPath = path.resolve(__dirname, "../src/engine/capability-report.json");

const TEST_COLOR: ColorValue = { r: 0.2, g: 0.4, b: 0.9, a: 1 };

afterEach(() => {
  clearJobRegistry();
});

describe("engine-wrapper", () => {
  it("createJob initializes an engine with a scene per tenant", async () => {
    const job = await createJob("tenant-a");
    try {
      expect(job.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(job.tenantId).toBe("tenant-a");
      expect(typeof job.sceneId).toBe("number");
      expect(job.sceneId).toBeGreaterThanOrEqual(0);
      expect(job.engine.version).toBe(CreativeEngine.version);
    } finally {
      releaseJob(job.id);
    }
  });

  it("setTypedProperty writes fill/solid/color and reads it back equal", async () => {
    const job = await createJob("tenant-color");
    try {
      const { engine, sceneId } = job;
      const page = engine.block.create("page");
      engine.block.appendChild(sceneId, page);

      const graphic = engine.block.create("graphic");
      engine.block.appendChild(page, graphic);
      const fill = engine.block.createFill("color");
      engine.block.setFill(graphic, fill);

      const colorKey = resolveFillColorKey(engine);
      expect(colorKey).toBe("fill/solid/color");

      setTypedProperty(engine, graphic, colorKey, TEST_COLOR);
      const readBack = getTypedProperty(engine, graphic, colorKey) as ColorValue;

      expect(readBack.r).toBeCloseTo(TEST_COLOR.r, 5);
      expect(readBack.g).toBeCloseTo(TEST_COLOR.g, 5);
      expect(readBack.b).toBeCloseTo(TEST_COLOR.b, 5);
      expect(readBack.a).toBeCloseTo(TEST_COLOR.a, 5);

      setFillColor(engine, graphic, TEST_COLOR);
      const viaHelper = getFillColor(engine, graphic);
      expect(viaHelper.key).toBe(colorKey);
      expect(viaHelper.value.r).toBeCloseTo(TEST_COLOR.r, 5);
    } finally {
      releaseJob(job.id);
    }
  });

  it("queryAnimatable returns live engine easings and animation types", async () => {
    const job = await createJob("tenant-anim");
    try {
      const { engine, sceneId } = job;
      const page = engine.block.create("page");
      engine.block.appendChild(sceneId, page);
      const text = engine.block.create("text");
      engine.block.replaceText(text, "Motion");
      engine.block.appendChild(page, text);

      const liveEasings: string[] = engine.block.getEnumValues("animationEasing");
      const result = queryAnimatable(engine, text);

      const onDisk = JSON.parse(readFileSync(reportPath, "utf8")) as {
        animationEasing: string[];
      };

      expect(result.easingOptions).toEqual(liveEasings);
      expect(result.easingOptions.length).toBe(onDisk.animationEasing.length);
      expect(result.easingOptions.length).toBe(16);

      expect(result.animationTypes.length).toBeGreaterThanOrEqual(1);
      expect(
        result.animationTypes.some((entry) => entry.properties.length > 0),
      ).toBe(true);

      const slide = result.animationTypes.find((entry) =>
        entry.type.endsWith("/slide"),
      );
      expect(slide?.properties.some((p) => p.key === "animationEasing")).toBe(
        true,
      );
      expect(slide?.properties.find((p) => p.key === "animationEasing")?.enumValues).toEqual(
        liveEasings,
      );
    } finally {
      releaseJob(job.id);
    }
  });
});
