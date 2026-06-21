import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CreativeEngine, initEngine } from "./cesdk-import.js";

export interface NativeExportResult {
  success: boolean;
  mp4Bytes: number;
  error?: string;
  cesdkVersion: string;
  method: "exportVideo";
}

export async function tryNativeExport(
  outDir: string,
  scenePath?: string,
): Promise<NativeExportResult> {
  const engine = await initEngine();
  const cesdkVersion = CreativeEngine.version;

  try {
    if (scenePath) {
      await engine.scene.loadFromURL(`file://${scenePath}`);
    } else {
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
    }

    const [page] = engine.block.findByType("page");
    if (!page) {
      throw new Error("No page block found for export");
    }

    mkdirSync(outDir, { recursive: true });

    const mp4Blob = await engine.block.exportVideo(page, {
      mimeType: "video/mp4",
      framerate: 30,
      videoBitrate: 4_000_000,
      duration: 2.0,
      onProgress: (_rendered: number, encoded: number, total: number) => {
        if (encoded % 10 === 0 || encoded === total) {
          console.log(`exportVideo progress: ${encoded}/${total} frames`);
        }
      },
    });

    const buffer = Buffer.from(await mp4Blob.arrayBuffer());
    const outFile = path.join(outDir, "native-export.mp4");
    writeFileSync(outFile, buffer);

    return {
      success: true,
      mp4Bytes: buffer.length,
      cesdkVersion,
      method: "exportVideo",
    };
  } catch (err) {
    return {
      success: false,
      mp4Bytes: 0,
      error: err instanceof Error ? err.message : String(err),
      cesdkVersion,
      method: "exportVideo",
    };
  } finally {
    engine.dispose();
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const outDir = path.resolve(__dirname, "../../out/render-spike");
  const sceneArg = process.argv.find((a) => a.endsWith(".scene"));
  tryNativeExport(outDir, sceneArg).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
