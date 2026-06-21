import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initEngine } from "./engine-config.js";

export interface AuthoringSpikeResult {
  cesdkVersion: string;
  sceneString: string;
  pngBytes: number;
  reloaded: boolean;
}

export async function runAuthoringSpike(
  outDir?: string,
): Promise<AuthoringSpikeResult> {
  const engine = await initEngine();

  try {
    const scene = engine.scene.create("Free");
    const page = engine.block.create("page");
    engine.block.setWidth(page, 1080);
    engine.block.setHeight(page, 1080);
    engine.block.appendChild(scene, page);

    const text = engine.block.create("text");
    engine.block.replaceText(text, "Hello");
    engine.block.setWidth(text, 400);
    engine.block.setHeight(text, 100);
    engine.block.setPositionX(text, 100);
    engine.block.setPositionY(text, 100);
    engine.block.appendChild(page, text);

    const anim = engine.block.createAnimation("slide");
    engine.block.setInAnimation(text, anim);
    engine.block.setDuration(anim, 0.6);

    const sceneString = await engine.scene.saveToString();
    await engine.scene.loadFromString(sceneString);

    const [reloadedPage] = engine.block.findByType("page");
    const pngBlob = await engine.block.export(reloadedPage, {
      mimeType: "image/png",
    });
    const pngBuffer = Buffer.from(await pngBlob.arrayBuffer());

    const result: AuthoringSpikeResult = {
      cesdkVersion: engine.version,
      sceneString,
      pngBytes: pngBuffer.length,
      reloaded: true,
    };

    if (outDir) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(path.join(outDir, "spike.scene"), sceneString, "utf8");
      writeFileSync(path.join(outDir, "spike.png"), pngBuffer);
    }

    return result;
  } finally {
    engine.dispose();
  }
}

if (import.meta.url === `file://${fileURLToPath(import.meta.url)}`) {
  const outDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../out",
  );
  runAuthoringSpike(outDir)
    .then((r) => {
      console.log(`CreativeEngine.version: ${r.cesdkVersion}`);
      console.log(`PNG bytes: ${r.pngBytes}`);
      console.log(`Scene saved to ${outDir}/spike.scene`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
