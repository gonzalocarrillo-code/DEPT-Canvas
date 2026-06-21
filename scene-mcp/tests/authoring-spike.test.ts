import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runAuthoringSpike } from "../spike/authoring-spike.js";
import { buildCapabilityReport } from "../spike/capability-dump.js";
import { CreativeEngine } from "../spike/cesdk-import.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reportPath = path.resolve(__dirname, "../src/engine/capability-report.json");

/** Tier-1 motion engine uses these four easings (MOTION_ENGINE.md); engine may expose more. */
const TIER1_CORE_EASINGS = ["Linear", "EaseIn", "EaseOut", "EaseInOut"] as const;

describe("authoring-spike", () => {
  it("scene saves, reloads, PNG > 0 bytes", async () => {
    const result = await runAuthoringSpike();
    expect(result.pngBytes).toBeGreaterThan(0);
    expect(result.reloaded).toBe(true);
    expect(result.sceneString.length).toBeGreaterThan(0);
    console.log(`CreativeEngine.version: ${CreativeEngine.version}`);
  });

  it("capability-report.json written with preset-only ground truth", async () => {
    const { report, engine, ownsEngine } = await buildCapabilityReport();
    mkdirSync(path.dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const onDisk = JSON.parse(readFileSync(reportPath, "utf8"));

    expect(onDisk.hasKeyframeApi).toBe(false);
    expect(onDisk.cesdkVersion).toBe(CreativeEngine.version);
    expect(onDisk.animationTypes.length).toBeGreaterThan(0);
    expect(onDisk.blurTypes.length).toBe(4);

    for (const easing of TIER1_CORE_EASINGS) {
      expect(onDisk.animationEasing).toContain(easing);
    }

    const slide = onDisk.animationTypes.find(
      (a: { shorthand: string }) => a.shorthand === "slide",
    );
    expect(slide?.properties.length).toBeGreaterThan(0);

    if (ownsEngine) {
      engine.dispose();
    }
  });
});
