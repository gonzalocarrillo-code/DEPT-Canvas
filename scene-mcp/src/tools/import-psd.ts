import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { CallerContext } from "../auth/tenant-context.js";
import { createJob, releaseJob } from "../engine/job-registry.js";
import { getSceneStorage } from "../storage/index.js";
import { ImportPsdInput, ImportPsdOutput } from "./_schemas.js";
import { withToolAudit } from "./_context.js";

// Authoritative server-side PSD import: CE.SDK's @imgly/psd-importer turns a .psd
// into a NATIVE editable scene (text → editable text blocks, rasters → image
// blocks, shapes, groups). Runs in an ephemeral per-tenant job (engine isolated
// by createJob(ctx.tenantId)); the result persists through the same storage seam
// as save_scene and is returned as a tenant-scoped sceneRef. The packages are
// dynamically imported so the heavy ESM importer only loads when used.
export async function importPsd(
  ctx: CallerContext,
  input: z.infer<typeof ImportPsdInput>,
) {
  const parsed = ImportPsdInput.parse(input);

  return withToolAudit(ctx, "import_psd", { bytes: parsed.psd.length }, async () => {
    const buf = Buffer.from(parsed.psd, "base64");
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

    const { PSDParser, createPNGJSEncodeBufferToPNG, addGfontsAssetLibrary } = await import(
      "@imgly/psd-importer"
    );
    const { PNG } = await import("pngjs");

    const job = await createJob(ctx.tenantId);
    try {
      const engine = job.engine as unknown as Parameters<typeof PSDParser.fromFile>[0];
      try {
        await addGfontsAssetLibrary(engine as unknown as Parameters<typeof addGfontsAssetLibrary>[0]);
      } catch {
        // Google-Fonts asset library is best-effort; unresolved fonts fall back.
      }

      const encoder = createPNGJSEncodeBufferToPNG(
        PNG as unknown as Parameters<typeof createPNGJSEncodeBufferToPNG>[0],
      );
      const parser = await PSDParser.fromFile(engine, arrayBuffer, encoder);
      await parser.parse();

      // NOTE: saveToString persists buffer:// references; relocating transient
      // image resources to per-tenant storage (findAllTransientResources →
      // getBufferData → relocateResource) is a documented follow-up so reloaded
      // scenes keep their raster fills.
      const sceneString = await job.engine.scene.saveToString();
      const sceneId = randomUUID();
      const sceneRef = await getSceneStorage().saveScene(
        ctx.tenantId,
        sceneId,
        Buffer.from(sceneString, "utf8"),
      );
      return ImportPsdOutput.parse({ sceneRef });
    } finally {
      releaseJob(job.id);
    }
  });
}
