import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCapabilityReport } from "./capability-dump.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, "../src/engine/capability-report.json");

async function main() {
  const { report, engine, ownsEngine } = await buildCapabilityReport();
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`CreativeEngine.version: ${report.cesdkVersion}`);
  console.log(`hasKeyframeApi: ${report.hasKeyframeApi}`);
  console.log(`animationEasing (${report.animationEasing.length}): ${report.animationEasing.join(", ")}`);
  console.log(`animation types: ${report.animationTypes.length}`);
  console.log(`blur types: ${report.blurTypes.length}`);
  console.log(`fillColorKey: ${report.fillColorKey}`);
  console.log(`Wrote ${outPath}`);
  if (ownsEngine) {
    engine.dispose();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
