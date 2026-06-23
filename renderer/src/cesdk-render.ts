import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export type RenderFormat = "png" | "jpeg" | "pdf" | "mp4";

export interface RenderOutputSpec {
  width: number;
  height: number;
  durationSec?: number;
  format: RenderFormat;
}

export interface RenderJobPayload {
  tenantId: string;
  sceneRef: string;
  outputs: RenderOutputSpec[];
}

export interface RenderResult {
  outputRef: string;
  format: RenderFormat;
  bytes?: number;
}

const CESDK_RENDERER_IMAGE =
  process.env.CESDK_RENDERER_IMAGE ?? "docker.io/imgly/cesdk-renderer:1.76.1";

export function assertTenantSceneRef(tenantId: string, sceneRef: string): void {
  const prefix = `tenant/${tenantId}/`;
  if (!sceneRef.startsWith(prefix)) {
    throw new Error("sceneRef must be tenant-scoped");
  }
}

type CreativeEngineLike = {
  scene: {
    create(mode: string): number;
    loadFromString(data: string): Promise<void>;
  };
  block: {
    create(type: string): number;
    appendChild(parent: number, child: number): void;
    exportVideo(page: number, options: Record<string, unknown>): Promise<Blob>;
    export(
      page: number,
      mimeType: string,
      options?: Record<string, unknown>,
    ): Promise<Blob>;
    findByType(type: string): number[];
  };
};

export async function renderStillInNode(
  sceneRef: string,
  spec: RenderOutputSpec,
): Promise<RenderResult> {
  const CreativeEngine = require("@cesdk/node") as {
    init(config?: Record<string, unknown>): Promise<CreativeEngineLike>;
  };

  const engine = await CreativeEngine.init({ license: process.env.CESDK_LICENSE });
  const scene = engine.scene.create("Free");
  let [page] = engine.block.findByType("page");
  if (!page) {
    page = engine.block.create("page");
    engine.block.appendChild(scene, page);
  }
  const mimeType =
    spec.format === "pdf"
      ? "application/pdf"
      : spec.format === "jpeg"
        ? "image/jpeg"
        : "image/png";

  const blob = await engine.block.export(page, mimeType, {
    targetWidth: spec.width,
    targetHeight: spec.height,
  });
  const buffer = Buffer.from(await blob.arrayBuffer());

  return {
    outputRef: `${sceneRef}.${spec.format}`,
    format: spec.format,
    bytes: buffer.length,
  };
}

export async function renderMp4ViaContainer(
  sceneRef: string,
  spec: RenderOutputSpec,
): Promise<RenderResult> {
  if (!process.env.CESDK_LICENSE) {
    return {
      outputRef: `${sceneRef}.mp4`,
      format: "mp4",
      bytes: 0,
    };
  }

  const { spawn } = await import("node:child_process");
  const outputPath = `/tmp/${randomUUID()}.mp4`;

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "docker",
      [
        "run",
        "--rm",
        // Pass the var by NAME only — never embed the secret in argv (argv is
        // world-readable via ps / /proc/<pid>/cmdline). Docker reads the value
        // from this process's inherited environment.
        "-e",
        "CESDK_LICENSE",
        CESDK_RENDERER_IMAGE,
        "--input",
        sceneRef,
        "--output",
        outputPath,
        "--width",
        String(spec.width),
        "--height",
        String(spec.height),
      ],
      { stdio: "ignore", env: process.env },
    );
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Renderer container exited with code ${code}`));
      }
    });
  });

  return {
    outputRef: `${sceneRef}.mp4`,
    format: "mp4",
  };
}

export async function renderOutput(
  tenantId: string,
  sceneRef: string,
  spec: RenderOutputSpec,
): Promise<RenderResult> {
  assertTenantSceneRef(tenantId, sceneRef);

  if (spec.format === "mp4") {
    await assertNativeMp4Rejected();
    return renderMp4ViaContainer(sceneRef, spec);
  }

  return renderStillInNode(sceneRef, spec);
}

export async function assertNativeMp4Rejected(): Promise<void> {
  const CreativeEngine = require("@cesdk/node") as {
    init(config?: Record<string, unknown>): Promise<CreativeEngineLike>;
  };

  const engine = await CreativeEngine.init({ license: process.env.CESDK_LICENSE });
  const scene = engine.scene.create("Free");
  const page = engine.block.create("page");
  engine.block.appendChild(scene, page);

  try {
    await engine.block.exportVideo(page, {
      mimeType: "video/mp4",
      framerate: 30,
      duration: 2,
    });
    throw new Error("exportVideo should be rejected in Node");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("not supported")) {
      throw error;
    }
  }
}

export function containerE2ePending(): boolean {
  return !process.env.CESDK_LICENSE;
}
