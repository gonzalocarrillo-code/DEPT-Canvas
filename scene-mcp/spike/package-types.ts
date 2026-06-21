import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function parseStringArrayFromDts(constName: string): string[] {
  const dtsPath = require.resolve("@cesdk/node/index.d.ts");
  const content = readFileSync(dtsPath, "utf8");
  const re = new RegExp(
    `${constName}: readonly \\[([^\\]]+)\\]`,
  );
  const match = content.match(re);
  if (!match) {
    throw new Error(`Could not parse ${constName} from @cesdk/node index.d.ts`);
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** Read candidate types from the installed @cesdk/node type definitions (not from memory). */
export function loadAnimationTypesFromPackage(): string[] {
  return parseStringArrayFromDts("ANIMATION_TYPES");
}

export function loadBlurTypesFromPackage(): string[] {
  return parseStringArrayFromDts("BLUR_TYPES");
}
