import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface IntentPrimitiveEntry {
  intent: string;
  animation_type: string;
  params: Record<string, string | number>;
  confidence?: number;
  needs_review?: boolean;
}

let cachedMap: IntentPrimitiveEntry[] | undefined;

export function loadIntentPrimitiveMap(): IntentPrimitiveEntry[] {
  if (cachedMap) {
    return cachedMap;
  }
  const mapPath = path.resolve(
    __dirname,
    "../../../orchestration/mapping/intent_primitive_map.json",
  );
  cachedMap = JSON.parse(readFileSync(mapPath, "utf8")) as IntentPrimitiveEntry[];
  return cachedMap;
}

export function resolveIntentEntry(intent: string): IntentPrimitiveEntry | undefined {
  return loadIntentPrimitiveMap().find((entry) => entry.intent === intent);
}

export function animationShorthandFromType(animationType: string): string {
  const prefix = "//ly.img.ubq/animation/";
  if (animationType.startsWith(prefix)) {
    return animationType.slice(prefix.length);
  }
  return animationType;
}
