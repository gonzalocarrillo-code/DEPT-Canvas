import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { CreativeEngineInstance } from "./cesdk.js";

const require = createRequire(import.meta.url);

export interface AnimatablePropertyInfo {
  key: string;
  type: string;
  enumValues?: string[];
}

export interface AnimationTypeInfo {
  type: string;
  properties: AnimatablePropertyInfo[];
}

export interface QueryAnimatableResult {
  properties: AnimatablePropertyInfo[];
  easingOptions: string[];
  animationTypes: AnimationTypeInfo[];
}

function loadAnimationTypesFromPackage(): string[] {
  const dtsPath = require.resolve("@cesdk/node/index.d.ts");
  const content = readFileSync(dtsPath, "utf8");
  const match = content.match(/ANIMATION_TYPES: readonly \[([^\]]+)\]/);
  if (!match) {
    throw new Error("Could not parse ANIMATION_TYPES from @cesdk/node index.d.ts");
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function introspectProperties(
  engine: CreativeEngineInstance,
  blockId: number,
): AnimatablePropertyInfo[] {
  const keys: string[] = engine.block.findAllProperties(blockId);
  return keys.map((key) => {
    const info: AnimatablePropertyInfo = {
      key,
      type: engine.block.getPropertyType(key),
    };
    if (info.type === "Enum") {
      info.enumValues = engine.block.getEnumValues(key);
    }
    return info;
  });
}

function introspectAnimationTypes(
  engine: CreativeEngineInstance,
): AnimationTypeInfo[] {
  const animationTypes: AnimationTypeInfo[] = [];

  for (const shorthand of loadAnimationTypesFromPackage()) {
    let animId: number | null = null;
    try {
      animId = engine.block.createAnimation(shorthand);
      animationTypes.push({
        type: `//ly.img.ubq/animation/${shorthand}`,
        properties: introspectProperties(engine, animId as number),
      });
    } catch {
      // Skip types the running engine rejects.
    } finally {
      if (animId !== null) {
        engine.block.destroy(animId);
      }
    }
  }

  return animationTypes;
}

/**
 * Read animation capabilities from the live engine — never from a hardcoded list.
 */
export function queryAnimatable(
  engine: CreativeEngineInstance,
  blockId: number,
): QueryAnimatableResult {
  const properties = introspectProperties(engine, blockId).filter(
    (prop) =>
      engine.block.isPropertyReadable(prop.key) ||
      engine.block.isPropertyWritable(prop.key),
  );

  const easingOptions: string[] = engine.block.getEnumValues("animationEasing");
  const animationTypes = introspectAnimationTypes(engine);

  return {
    properties,
    easingOptions,
    animationTypes,
  };
}
