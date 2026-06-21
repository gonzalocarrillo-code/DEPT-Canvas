import { CreativeEngine, type CreativeEngineInstance } from "./cesdk-import.js";

export interface EngineInitOptions {
  license?: string;
  baseURL?: string;
}

export async function initEngine(
  options: EngineInitOptions = {},
): Promise<CreativeEngineInstance> {
  const license = options.license ?? process.env.CESDK_LICENSE;

  const config: Record<string, unknown> = { license };

  if (options.baseURL ?? process.env.IMGLY_LOCAL_ASSETS_URL) {
    const baseURL = options.baseURL ?? process.env.IMGLY_LOCAL_ASSETS_URL!;
    config.baseURL = baseURL;
    config.core = { baseURL };
  }

  const engine = await CreativeEngine.init(config);

  return engine;
}

export function assertNoKeyframeApi(engine: {
  block: Record<string, unknown>;
}): boolean {
  const block = engine.block;
  return (
    typeof block.setKeyframe !== "function" &&
    typeof block.addKeyframe !== "function" &&
    typeof block.createKeyframe !== "function"
  );
}

export { CreativeEngine };
