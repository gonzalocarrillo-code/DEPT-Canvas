import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const CreativeEngine = require("@cesdk/node") as {
  init(config?: Record<string, unknown>): Promise<CreativeEngineInstance>;
  version: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CreativeEngineInstance = any;

export async function initEngine() {
  return CreativeEngine.init({ license: process.env.CESDK_LICENSE });
}
