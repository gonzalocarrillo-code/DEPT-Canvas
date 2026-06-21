import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** CJS default export — static `init` / `version` not inferred by TS on the ESM import. */
export const CreativeEngine = require("@cesdk/node") as {
  init(config?: Record<string, unknown>): Promise<CreativeEngineInstance>;
  version: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CreativeEngineInstance = any;
