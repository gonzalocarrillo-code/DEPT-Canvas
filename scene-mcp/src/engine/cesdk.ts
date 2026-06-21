import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** CJS default export — static `init` / `version` not inferred by TS on the ESM import. */
export const CreativeEngine = require("@cesdk/node") as {
  init(config?: Record<string, unknown>): Promise<CreativeEngineInstance>;
  version: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CreativeEngineInstance = any;

export interface EngineInitOptions {
  license?: string;
  baseURL?: string;
}

export async function initCreativeEngine(
  options: EngineInitOptions = {},
): Promise<CreativeEngineInstance> {
  const license = options.license ?? process.env.CESDK_LICENSE;

  const config: Record<string, unknown> = { license };

  if (options.baseURL ?? process.env.IMGLY_LOCAL_ASSETS_URL) {
    const baseURL = options.baseURL ?? process.env.IMGLY_LOCAL_ASSETS_URL!;
    config.baseURL = baseURL;
    config.core = { baseURL };
  }

  return CreativeEngine.init(config);
}
