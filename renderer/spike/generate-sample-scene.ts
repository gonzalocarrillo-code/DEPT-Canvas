import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initEngine } from "./cesdk-import.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const engine = await initEngine();
  try {
    const scene = engine.scene.create("Free");
    engine.scene.setMode("Video");
    const page = engine.block.create("page");
    engine.block.setWidth(page, 1080);
    engine.block.setHeight(page, 1080);
    engine.block.appendChild(scene, page);

    const text = engine.block.create("text");
    engine.block.replaceText(text, "DEPT Canvas render spike");
    engine.block.setPositionX(text, 120);
    engine.block.setPositionY(text, 480);
    engine.block.appendChild(page, text);

    const anim = engine.block.createAnimation("fade");
    engine.block.setInAnimation(text, anim);
    engine.block.setDuration(anim, 0.5);
    engine.block.setDuration(page, 2.0);

    const sceneString = await engine.scene.saveToString();
    const outPath = path.join(__dirname, "sample.scene");
    writeFileSync(outPath, sceneString, "utf8");
    console.log(`Wrote ${outPath}`);
  } finally {
    engine.dispose();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
